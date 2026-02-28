import {
  saveState,
  state,
  xpForLevel,
  missionPool,
  weeklyChallengePool,
  focusPool,
  todayKey,
  weekKey,
  campaignStatusOrder,
  getCampaignStageOptions,
  isCampaignActive,
  achievementCatalog,
  achievementOptionsByLevel,
  getAchievementById,
  hairItems,
  outfitItems,
  shoeItems
} from './state.js';
import { showToast, showXpToast } from './ui.js';

const MAX_LEVEL = 10;
const DAILY_BONUS_XP = 20;
const ACHIEVEMENTS_VERSION = 2;
const WELCOME_XP = 30;

const getUserSeed = () => {
  try {
    return (
      sessionStorage.getItem('ugcQuestUserId') ||
      sessionStorage.getItem('ugcQuestUserEmail') ||
      state.profile?.email ||
      'guest'
    );
  } catch (e) {
    return state.profile?.email || 'guest';
  }
};

const fnv1a = (value) => {
  const text = String(value || '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffleInPlace = (list, random = Math.random) => {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
  return list;
};

const seededShuffle = (list, seed) => shuffleInPlace(list, mulberry32(fnv1a(seed)));

const pickSeeded = (list, seed) => {
  if (!Array.isArray(list) || list.length === 0) return null;
  const rand = mulberry32(fnv1a(seed));
  return list[Math.floor(rand() * list.length)];
};

const ensureActiveAchievements = () => {
  if (!state.progress?.achievements || typeof state.progress.achievements !== 'object') return;

  if (!Array.isArray(state.progress.achievements.active)) {
    state.progress.achievements.active = [];
  }

  const storedVersion = Number.isFinite(state.progress.achievements.version)
    ? state.progress.achievements.version
    : parseInt(state.progress.achievements.version, 10) || 0;

  let changedByVersion = false;
  if (storedVersion !== ACHIEVEMENTS_VERSION) {
    state.progress.achievements.version = ACHIEVEMENTS_VERSION;
    state.progress.achievements.active = [];
    changedByVersion = true;
  }

  const catalogIds = new Set((Array.isArray(achievementCatalog) ? achievementCatalog : []).map((item) => item.id));
  if (!catalogIds.size) return;

  const existing = Array.isArray(state.progress.achievements.active) ? state.progress.achievements.active : [];
  const cleaned = existing.filter((id) => catalogIds.has(id));

  let changed = changedByVersion || cleaned.length !== existing.length;

  if (cleaned.length !== MAX_LEVEL) {
    const used = new Set();
    const chosenByLevel = new Map();

    cleaned.forEach((id) => {
      const def = getAchievementById(id);
      const level = parseInt(def?.unlockLevel, 10) || 0;
      if (level < 1 || level > MAX_LEVEL) return;
      if (chosenByLevel.has(level)) return;
      chosenByLevel.set(level, id);
      used.add(id);
    });

    const unlocked = Array.isArray(state.progress.achievements.unlocked) ? state.progress.achievements.unlocked : [];
    unlocked.forEach((id) => {
      const def = getAchievementById(id);
      const level = parseInt(def?.unlockLevel, 10) || 0;
      if (level < 1 || level > MAX_LEVEL) return;
      if (chosenByLevel.has(level)) return;
      const options = achievementOptionsByLevel?.[level] || [];
      if (!options.includes(def.id)) return;
      chosenByLevel.set(level, def.id);
      used.add(def.id);
    });

    const seed = getUserSeed();
    const next = [];

    for (let level = 1; level <= MAX_LEVEL; level += 1) {
      const locked = chosenByLevel.get(level);
      if (locked) {
        next.push(locked);
        continue;
      }

      const options = (achievementOptionsByLevel?.[level] || []).filter((id) => catalogIds.has(id) && !used.has(id));
      const pick = pickSeeded(options, `${seed}|achievements|level:${level}`) || options[0];
      if (!pick) continue;
      used.add(pick);
      next.push(pick);
    }

    if (next.length === MAX_LEVEL) {
      state.progress.achievements.active = next;
      changed = true;
    }
  } else if (changed) {
    state.progress.achievements.active = cleaned;
  }

  if (changed) saveState();
};

const ensureProgressState = () => {
  let shouldSave = false;
  if (!state.progress || typeof state.progress !== 'object') {
    state.progress = {};
    shouldSave = true;
  }

  if (!state.progress.daily || typeof state.progress.daily !== 'object') {
    state.progress.daily = { date: todayKey(), bonusDate: null, lastCompleteDate: null, unique: {} };
    shouldSave = true;
  }
  if (!state.progress.daily.unique || typeof state.progress.daily.unique !== 'object') {
    state.progress.daily.unique = {};
    shouldSave = true;
  }

  if (!state.progress.weekly || typeof state.progress.weekly !== 'object') {
    state.progress.weekly = {
      date: weekKey(),
      challengeId: null,
      dailyCompleteDays: [],
      campaignUpdateDays: [],
      organizedCampaignIds: [],
      finishedCampaignIds: []
    };
    shouldSave = true;
  }
  if (state.progress.weekly.challengeId === undefined) {
    state.progress.weekly.challengeId = null;
    shouldSave = true;
  }

  if (!state.progress.streak || typeof state.progress.streak !== 'object') {
    state.progress.streak = { lastSeenDate: null };
    shouldSave = true;
  }
  if (state.progress.streak.lastSeenDate === undefined) {
    state.progress.streak.lastSeenDate = null;
    shouldSave = true;
  }

  if (!state.progress.achievements || typeof state.progress.achievements !== 'object') {
    state.progress.achievements = { unlocked: [], active: [] };
    shouldSave = true;
  }
  if (!Array.isArray(state.progress.achievements.unlocked)) {
    state.progress.achievements.unlocked = [];
    shouldSave = true;
  }
  if (!Array.isArray(state.progress.achievements.active)) {
    state.progress.achievements.active = [];
    shouldSave = true;
  }

  ensureActiveAchievements();

  const today = todayKey();
  if (state.progress.daily.date !== today) {
    state.progress.daily.date = today;
    state.progress.daily.unique = {};
    shouldSave = true;
  }

  const currentWeek = weekKey();
  if (state.progress.weekly.date !== currentWeek) {
    state.progress.weekly.date = currentWeek;
    state.progress.weekly.dailyCompleteDays = [];
    state.progress.weekly.campaignUpdateDays = [];
    state.progress.weekly.organizedCampaignIds = [];
    state.progress.weekly.finishedCampaignIds = [];
    shouldSave = true;
  }

  const safeLevel = Number.isFinite(state.profile?.level)
    ? Math.floor(state.profile.level)
    : parseInt(state.profile?.level, 10) || 1;
  state.profile.level = Math.min(Math.max(safeLevel, 1), MAX_LEVEL);
  state.profile.xp = Number.isFinite(state.profile?.xp) ? Math.max(state.profile.xp, 0) : 0;
  state.profile.streak = Number.isFinite(state.profile?.streak) ? Math.max(state.profile.streak, 0) : 0;

  const dateKeyFromDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayLocal = todayKey();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayLocal = dateKeyFromDate(yesterday);
  const lastSeen = state.progress.streak.lastSeenDate;

  if (lastSeen !== todayLocal) {
    if (lastSeen === yesterdayLocal) {
      state.profile.streak = (state.profile.streak || 0) + 1;
    } else {
      state.profile.streak = 1;
    }
    state.progress.streak.lastSeenDate = todayLocal;
    shouldSave = true;
  } else if (state.profile.streak < 1) {
    state.profile.streak = 1;
    shouldSave = true;
  }

  if (shouldSave) saveState();
};

const awardXp = (amount) => {
  if (!Number.isFinite(amount) || amount <= 0) return;
  const startLevel = state.profile.level;
  let remaining = amount;

  while (remaining > 0) {
    if (state.profile.level >= MAX_LEVEL) {
      state.profile.level = MAX_LEVEL;
      state.profile.xp += remaining;
      remaining = 0;
      break;
    }

    const goal = xpForLevel(state.profile.level);
    const space = goal - state.profile.xp;

    if (space <= 0) {
      state.profile.xp = 0;
      state.profile.level = Math.min(state.profile.level + 1, MAX_LEVEL);
      showToast('Subiu de nível!');
      grantLevelRewards(state.profile.level);
      continue;
    }

    if (remaining >= space) {
      state.profile.xp = 0;
      state.profile.level = Math.min(state.profile.level + 1, MAX_LEVEL);
      remaining -= space;
      showToast('Subiu de nível!');
      grantLevelRewards(state.profile.level);
    } else {
      state.profile.xp += remaining;
      remaining = 0;
    }
  }

};

const ensureOnboarding = () => {
  ensureProgressState();

  if (!state.progress.onboarding || typeof state.progress.onboarding !== 'object') {
    state.progress.onboarding = {};
  }

  const onboarding = state.progress.onboarding;

  if (onboarding.welcomeGranted !== true) {
    const campaigns = Array.isArray(state.campaigns) ? state.campaigns : [];
    const brands = Array.isArray(state.brands) ? state.brands : [];
    const scripts = Array.isArray(state.scripts) ? state.scripts : [];

    const fresh =
      state.profile.level === 1 &&
      state.profile.xp === 0 &&
      campaigns.length === 0 &&
      brands.length === 0 &&
      scripts.length === 0;

    onboarding.welcomeGranted = true;
    onboarding.welcomeXp = WELCOME_XP;
    onboarding.welcomeAwarded = fresh;
    onboarding.welcomeAt = new Date().toISOString();

    if (fresh) {
      awardXp(WELCOME_XP);
      showXpToast(WELCOME_XP, 'Missão concluída', 'Conta criada');
    }

    saveState();
  }

  if (onboarding.tourRewardGranted === undefined) {
    onboarding.tourRewardGranted = false;
    onboarding.tourXp = 30;
    saveState();
  }
};

const grantTourReward = () => {
  ensureOnboarding();
  const onboarding = state.progress?.onboarding;
  if (!onboarding || onboarding.tourRewardGranted === true) return { ok: false, already: true };

  const xp = Number.isFinite(onboarding.tourXp) ? Math.max(0, Math.round(onboarding.tourXp)) : 30;
  onboarding.tourRewardGranted = true;
  onboarding.tourRewardAt = new Date().toISOString();

  if (xp > 0) {
    awardXp(xp);
    showXpToast(xp, 'Tutorial completo', 'Boa! Você já começou.');
  }

  saveState();
  return { ok: true, xp };
};

const recordDailyCompletion = () => {
  ensureProgressState();
  const today = todayKey();
  const last = state.progress.daily.lastCompleteDate;

  if (last === today) return;

  state.progress.daily.lastCompleteDate = today;
  countWeeklyDay('dailyCompleteDays', today, 'w-consistent');
};

const maybeGrantDailyBonus = () => {
  ensureProgressState();
  const today = todayKey();
  if (!Array.isArray(state.missions) || state.missions.length !== 3) return;
  const allDone = state.missions.every((mission) => mission.progress >= mission.total);
  if (!allDone) return;
  if (state.progress.daily.bonusDate === today) return;

  state.progress.daily.bonusDate = today;
  awardXp(DAILY_BONUS_XP);
  showXpToast(DAILY_BONUS_XP, 'Bônus do dia', 'Você fechou as 3 missões.');
  recordDailyCompletion();
};

const updateMission = (id, value) => {
  const mission = state.missions.find((item) => item.id === id);
  if (!mission) return;
  if (mission.progress >= mission.total) return;
  mission.progress = Math.min(mission.progress + value, mission.total);
  if (mission.progress >= mission.total) {
    awardXp(mission.xp);
    showXpToast(mission.xp, 'Missão concluída', mission.label);
  }
  maybeGrantDailyBonus();
};

const updateChallenge = (id, value) => {
  const challenge = state.challenges.find((item) => item.id === id);
  if (!challenge) return;
  if (challenge.progress >= challenge.total) return;
  challenge.progress = Math.min(challenge.progress + value, challenge.total);
  if (challenge.progress >= challenge.total) {
    awardXp(challenge.xp);
    showXpToast(challenge.xp, 'Desafio concluído', challenge.label);
  }
};

const countDailyUnique = (missionId, uniqueId) => {
  if (!missionId || uniqueId === undefined || uniqueId === null) return;
  ensureProgressState();
  const store = state.progress.daily.unique;
  const key = String(missionId);
  const id = String(uniqueId);
  const list = Array.isArray(store[key]) ? store[key] : [];
  if (list.includes(id)) return;
  list.push(id);
  store[key] = list;
  updateMission(missionId, 1);
};

const countWeeklyUnique = (listKey, uniqueId, challengeId) => {
  if (!listKey || uniqueId === undefined || uniqueId === null) return;
  ensureProgressState();
  const id = String(uniqueId);
  const list = Array.isArray(state.progress.weekly[listKey]) ? state.progress.weekly[listKey] : [];
  if (list.includes(id)) return;
  list.push(id);
  state.progress.weekly[listKey] = list;
  if (challengeId) updateChallenge(challengeId, 1);
};

const countWeeklyDay = (listKey, dateKey, challengeId) => {
  if (!listKey || !dateKey) return;
  ensureProgressState();
  const day = String(dateKey);
  const list = Array.isArray(state.progress.weekly[listKey]) ? state.progress.weekly[listKey] : [];
  if (list.includes(day)) return;
  list.push(day);
  state.progress.weekly[listKey] = list;
  if (challengeId) updateChallenge(challengeId, 1);
};

const recordCampaignUpdateDay = () => {
  const hasCampaigns = Array.isArray(state.campaigns) && state.campaigns.length > 0;
  if (!hasCampaigns) return;
  const hasActive = state.campaigns.some(isCampaignActive);
  if (!hasActive) return;
  countWeeklyDay('campaignUpdateDays', todayKey(), 'w-clean-week');
};

const isDailyMissionAvailable = (mission) => {
  const campaigns = Array.isArray(state.campaigns) ? state.campaigns : [];
  const scripts = Array.isArray(state.scripts) ? state.scripts : [];
  const hasCampaigns = campaigns.length > 0;
  const activeCampaigns = campaigns.filter(isCampaignActive);
  const hasActiveCampaigns = activeCampaigns.length > 0;
  const hasOpenScripts = scripts.some((script) => !script?.finalized);

  const daysSince = (isoOrDate) => {
    const date = isoOrDate ? new Date(isoOrDate) : null;
    if (!date || Number.isNaN(date.getTime())) return Infinity;
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const now = new Date();
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    return Math.floor((end - start) / 86400000);
  };

  const hasStaleCampaign = campaigns.some((campaign) => {
    if (campaign?.paused || campaign?.archived) return true;
    const days = daysSince(campaign?.updatedAt || campaign?.createdAt);
    return Number.isFinite(days) && days >= 7;
  });

  switch (mission.id) {
    case 'd-create-campaign':
    case 'd-create-scripts':
    case 'd-brand-contacts':
      return true;
    case 'd-organize-pipeline':
      return campaigns.length >= 2;
    case 'd-advance-stage':
      return campaigns.length >= 2;
    case 'd-deadlines':
      return campaigns.length >= 2;
    case 'd-production':
      return hasCampaigns && campaigns.some((campaign) => !campaign.archived && campaign.status === 'prospeccao');
    case 'd-pause-archive':
    case 'd-complete-campaign':
      return hasCampaigns;
    case 'd-update-status':
      return campaigns.length >= 3;
    case 'd-resume-stale':
      return hasStaleCampaign;
    case 'd-finish-campaign':
      return hasCampaigns && campaigns.some((c) => c.status !== 'concluida' && !c.archived);
    case 'd-review-active':
      return hasActiveCampaigns;
    case 'd-finish-script':
      return hasOpenScripts;
    case 'd-linked-script':
      return hasCampaigns;
    default:
      return true;
  }
};

const ensureDailyMissions = () => {
  ensureProgressState();
  const today = todayKey();
  if (state.ui.missionDate === today && state.missions.length) {
    const poolIds = new Set(missionPool.map((mission) => mission.id));
    const allValid = state.missions.every((mission) => poolIds.has(mission.id));
    if (allValid && state.missions.length === 3) {
      return;
    }
  }

  const available = missionPool.filter((mission) => isDailyMissionAvailable(mission));
  const source = available.length >= 3 ? available : missionPool;
  const shuffled = seededShuffle([...source], `${getUserSeed()}|${today}|daily`);
  const selected = shuffled.slice(0, 3).map((mission) => ({
    ...mission,
    progress: 0
  }));

  state.missions = selected;
  state.ui.missionDate = today;
  state.progress.daily.date = today;
  state.progress.daily.unique = {};
  saveState();
};

const ensureWeeklyChallenges = () => {
  ensureProgressState();
  const currentWeek = weekKey();
  const poolIds = new Set(weeklyChallengePool.map((challenge) => challenge.id));
  const storedId = state.progress.weekly.challengeId;
  const storedValid = Boolean(storedId && poolIds.has(storedId));

  const sameWeek = state.ui.weeklyDate === currentWeek && state.progress.weekly.date === currentWeek;
  if (sameWeek && Array.isArray(state.challenges) && state.challenges.length) {
    const valid = state.challenges.filter((challenge) => poolIds.has(challenge.id));
    let active = storedValid ? valid.find((challenge) => challenge.id === storedId) : null;
    if (!active) active = valid[0];
    if (active) {
      const poolItem = weeklyChallengePool.find((challenge) => challenge.id === active.id);
      state.progress.weekly.challengeId = active.id;
      state.challenges = [
        poolItem ? { ...poolItem, progress: active.progress || 0 } : { ...active, progress: active.progress || 0 }
      ];
      saveState();
      return;
    }
  }

  const pick = weeklyChallengePool[Math.floor(Math.random() * weeklyChallengePool.length)];
  const seededPick = pickSeeded(weeklyChallengePool, `${getUserSeed()}|${currentWeek}|weekly`);
  const pickFinal = seededPick || pick;
  state.challenges = [{ ...pickFinal, progress: 0 }];
  state.ui.weeklyDate = currentWeek;
  state.progress.weekly.date = currentWeek;
  state.progress.weekly.challengeId = pickFinal.id;
  state.progress.weekly.dailyCompleteDays = [];
  state.progress.weekly.campaignUpdateDays = [];
  state.progress.weekly.organizedCampaignIds = [];
  state.progress.weekly.finishedCampaignIds = [];
  saveState();
};

const applyFocusFromPool = (focusItem, week, roll) => {
  if (!focusItem) return;
  state.focus = state.focus && typeof state.focus === 'object' ? state.focus : {};
  state.focus.id = focusItem.id;
  state.focus.label = focusItem.label;
  state.focus.current = 0;
  state.focus.target = focusItem.target;
  state.focus.xp = focusItem.xp;
  state.focus.week = week;
  state.focus.roll = roll;
};

const pickNextFocus = (excludeId, week, roll) => {
  const pool = Array.isArray(focusPool) ? focusPool : [];
  if (!pool.length) return null;
  const shuffled = seededShuffle([...pool], `${getUserSeed()}|${week}|focus|${roll}`);
  return shuffled.find((item) => item.id !== excludeId) || shuffled[0];
};

const ensureWeeklyFocus = () => {
  const pool = Array.isArray(focusPool) ? focusPool : [];
  if (!pool.length) return;

  const currentWeek = weekKey();
  state.focus = state.focus && typeof state.focus === 'object' ? state.focus : {};

  const roll = Number.isFinite(state.focus.roll) ? Math.max(0, Math.floor(state.focus.roll)) : 0;
  const storedWeek = state.focus.week;
  const currentId = state.focus.id;
  const poolById = new Map(pool.map((item) => [item.id, item]));
  const item = currentId ? poolById.get(currentId) : null;

  if (storedWeek !== currentWeek || !item) {
    const next = pickNextFocus(null, currentWeek, 0);
    applyFocusFromPool(next, currentWeek, 0);
    saveState();
    return;
  }

  const safeCurrent = Number.isFinite(state.focus.current) ? Math.max(0, Math.floor(state.focus.current)) : 0;
  state.focus.current = Math.min(safeCurrent, item.target);
  state.focus.target = item.target;
  state.focus.xp = item.xp;
  state.focus.label = item.label;
  state.focus.week = currentWeek;
  state.focus.roll = roll;
};

const progressWeeklyFocus = () => {
  ensureWeeklyFocus();
  const pool = Array.isArray(focusPool) ? focusPool : [];
  const poolById = new Map(pool.map((item) => [item.id, item]));
  const item = poolById.get(state.focus?.id);
  if (!item) {
    return { ok: false, error: 'focus_missing' };
  }

  const before = Number.isFinite(state.focus.current) ? state.focus.current : 0;
  if (before >= item.target) {
    showToast('Você já fechou o foco da semana. Semana que vem tem outro.');
    return { ok: true, completed: true, gainedXp: 0, newFocus: null, alreadyCompleted: true };
  }

  const nextValue = Math.min(before + 1, item.target);
  state.focus.current = nextValue;

  let completed = false;
  let gainedXp = 0;
  let newFocus = null;

  if (nextValue >= item.target) {
    completed = true;
    gainedXp = Number.isFinite(item.xp) ? item.xp : 0;
    if (gainedXp > 0) awardXp(gainedXp);
    showXpToast(gainedXp, 'Foco da semana concluído', item.label);
  }

  saveState();
  return { ok: true, completed, gainedXp, newFocus };
};

const isUnlocked = (itemId) => state.avatar.unlocked.includes(itemId);

const unlockItemsForLevel = (items, level, unlockedList, canUnlockPremium) =>
  items.filter(
    (item) =>
      item.level <= level &&
      !unlockedList.includes(item.id) &&
      (!item.premium || canUnlockPremium)
  );

const grantLevelRewards = (level) => {
  const rewards = [
    ...unlockItemsForLevel(hairItems, level, state.avatar.unlocked, state.avatar.premium),
    ...unlockItemsForLevel(outfitItems, level, state.avatar.unlocked, state.avatar.premium),
    ...unlockItemsForLevel(shoeItems, level, state.avatar.unlocked, state.avatar.premium)
  ];

  if (!rewards.length) return;

  rewards.forEach((item) => state.avatar.unlocked.push(item.id));
  saveState();
  const names = rewards.map((item) => item.name).join(', ');
  showToast(`Nova recompensa de nível: ${names}`);
};

let syncingAchievements = false;
const syncAchievements = () => {
  ensureProgressState();
  if (syncingAchievements) return;
  syncingAchievements = true;

  try {
    const catalogIds = new Set((Array.isArray(achievementCatalog) ? achievementCatalog : []).map((item) => item.id));
    const before = Array.isArray(state.progress.achievements.unlocked) ? state.progress.achievements.unlocked : [];

    const cleaned = [];
    const seen = new Set();
    before.forEach((id) => {
      if (!catalogIds.has(id)) return;
      if (seen.has(id)) return;
      seen.add(id);
      cleaned.push(id);
    });

    const unlocked = new Set(cleaned);
    const changedUnlocked = cleaned.length !== before.length;
    state.progress.achievements.unlocked = cleaned;

    let changed = changedUnlocked;
    let guard = 0;

    while (guard < 12) {
      const activeIds = Array.isArray(state.progress.achievements.active) ? state.progress.achievements.active : [];
      const active = activeIds.map((id) => getAchievementById(id)).filter(Boolean);

      const available = active
        .filter((item) => (parseInt(item.unlockLevel, 10) || 1) <= state.profile.level)
        .sort((a, b) => (a.unlockLevel || 1) - (b.unlockLevel || 1));

      let addedThisPass = false;

      available.forEach((achievement) => {
        if (unlocked.has(achievement.id)) return;
        if (!achievement.isUnlocked(state)) return;
        unlocked.add(achievement.id);
        state.progress.achievements.unlocked.push(achievement.id);
        awardXp(achievement.xp);
        showXpToast(achievement.xp, 'Conquista desbloqueada', achievement.title);
        addedThisPass = true;
        changed = true;
      });

      if (!addedThisPass) break;
      guard += 1;
    }

    if (changed) saveState();
  } finally {
    syncingAchievements = false;
  }
};

const isCampaignFieldsComplete = (campaign) => {
  if (!campaign || typeof campaign !== 'object') return false;
  const brandOk = Boolean(String(campaign.brand || '').trim());
  const barterOk = Boolean(campaign.barter);
  const valueOk = (Number.isFinite(campaign.value) && campaign.value > 0) || barterOk;
  const statusSafe = String(campaign.status || '').trim();
  const statusOk = campaignStatusOrder.includes(statusSafe);
  const stageSafe = String(campaign.stage || '').trim();
  const stageOk = statusOk && getCampaignStageOptions(statusSafe).some((opt) => opt.id === stageSafe);
  const dueOk = Boolean(campaign.dueDate);
  return brandOk && valueOk && statusOk && stageOk && dueOk;
};

const willCompleteMission = (missionId, delta = 1) => {
  if (!missionId) return false;
  const mission = Array.isArray(state.missions) ? state.missions.find((item) => item.id === missionId) : null;
  if (!mission) return false;
  const current = Number.isFinite(mission.progress) ? mission.progress : 0;
  const total = Number.isFinite(mission.total) ? mission.total : parseInt(String(mission.total || ''), 10) || 1;
  const add = Number.isFinite(delta) ? delta : parseInt(String(delta || ''), 10) || 0;
  if (current >= total) return false;
  return current + add >= total;
};

const trackEvent = (eventName, payload = {}) => {
  ensureDailyMissions();
  ensureWeeklyChallenges();
  ensureProgressState();

  const type = String(eventName || '');

  if (type === 'campaign_created') {
    updateMission('d-create-campaign', 1);
    recordCampaignUpdateDay();
  }

  if (type === 'campaign_updated') {
    countDailyUnique('d-organize-pipeline', payload.campaignId);
    countWeeklyUnique('organizedCampaignIds', payload.campaignId, 'w-organize-pipeline');
    recordCampaignUpdateDay();
  }

  if (type === 'campaign_due_set') {
    countDailyUnique('d-deadlines', payload.campaignId);
    recordCampaignUpdateDay();
  }

  if (type === 'campaign_paused' || type === 'campaign_archived') {
    countDailyUnique('d-pause-archive', payload.campaignId);
    recordCampaignUpdateDay();
  }

  if (type === 'campaign_resumed') {
    countDailyUnique('d-resume-stale', payload.campaignId);
    recordCampaignUpdateDay();
  }

  if (type === 'campaign_stage_changed') {
    const statusSafe = String(payload.status || payload.campaign?.status || '').trim();
    const options = getCampaignStageOptions(statusSafe);
    const previousStage = String(payload.previousStage || '').trim();
    const stage = String(payload.stage || '').trim();

    const prevIndex = options.findIndex((opt) => opt.id === previousStage);
    const nextIndex = options.findIndex((opt) => opt.id === stage);

    if (prevIndex >= 0 && nextIndex >= 0 && nextIndex > prevIndex) {
      const effortXp = 5;
      const completesMission = willCompleteMission('d-advance-stage', 1);

      // Sempre adiciona XP ao avançar etapa
      awardXp(effortXp);
      if (!completesMission) {
        showXpToast(effortXp, 'Etapa avançada', 'Mais um passo na campanha.');
      }

      countDailyUnique('d-advance-stage', payload.campaignId);
    }

    recordCampaignUpdateDay();
  }

  if (type === 'campaign_status_changed') {
    countDailyUnique('d-update-status', payload.campaignId);

    const rank = { prospeccao: 0, producao: 1, finalizacao: 2, concluida: 3 };
    const prevRank = rank[payload.previousStatus] ?? 0;
    const nextRank = rank[payload.status] ?? 0;
    if (nextRank > prevRank) {
      countDailyUnique('d-advance-stage', payload.campaignId);
    }

    if (payload.status === 'producao' && payload.previousStatus !== 'producao') {
      countDailyUnique('d-production', payload.campaignId);
    }

    const finishedNow =
      ['finalizacao', 'concluida'].includes(payload.status) && !['finalizacao', 'concluida'].includes(payload.previousStatus);
    if (finishedNow) {
      countDailyUnique('d-finish-campaign', payload.campaignId);
      countWeeklyUnique('finishedCampaignIds', payload.campaignId, 'w-finish-campaigns');
    }
    recordCampaignUpdateDay();
  }

  if (type === 'campaigns_viewed') {
    const hasActive = Array.isArray(state.campaigns) && state.campaigns.some(isCampaignActive);
    if (hasActive) {
      countDailyUnique('d-review-active', 'seen');
    }
  }

  if (type === 'script_created') {
    const effortXp = 5;
    const completesMission = willCompleteMission('d-create-scripts', 1);
    if (effortXp > 0) {
      awardXp(effortXp);
      if (!completesMission) {
        showXpToast(effortXp, 'Roteiro gerado', 'Boa. Ideia na mão.');
      }
    }
    updateMission('d-create-scripts', 1);
    updateChallenge('w-scripts', 1);
    if (payload.campaignId) {
      updateMission('d-linked-script', 1);
    }
  }

  if (type === 'script_finalized') {
    countDailyUnique('d-finish-script', payload.scriptId || payload.id || 'script');
  }

  if (type === 'brand_created') {
    const effortXp = 5;
    const completesMission = willCompleteMission('d-brand-contacts', 1);
    if (effortXp > 0) {
      awardXp(effortXp);
      if (!completesMission) {
        showXpToast(effortXp, 'Contato salvo', 'Seu pipeline tá nascendo.');
      }
    }
    updateMission('d-brand-contacts', 1);
    updateChallenge('w-contacts', 1);
  }

  if (payload.campaign) {
    const campaign = payload.campaign;
    if (isCampaignFieldsComplete(campaign) && !campaign.fieldsComplete) {
      campaign.fieldsComplete = true;
      countDailyUnique('d-complete-campaign', campaign.id);
    }
  }

  syncAchievements();
};

export {
  awardXp,
  updateMission,
  updateChallenge,
  ensureDailyMissions,
  ensureWeeklyChallenges,
  ensureWeeklyFocus,
  ensureOnboarding,
  grantTourReward,
  progressWeeklyFocus,
  isUnlocked,
  trackEvent,
  syncAchievements
};
