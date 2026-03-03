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
import { showToast } from './ui.js';

const showXpToast = () => {};

const updateMission = () => {};

const updateChallenge = () => {};

const ensureDailyMissions = () => {};

const ensureWeeklyChallenges = () => {};

const ensureWeeklyFocus = () => {};

const ensureOnboarding = () => {};

const progressWeeklyFocus = () => ({
  ok: false,
  completed: false,
  gainedXp: 0,
  newFocus: null,
  disabled: true
});

const isUnlocked = () => false;

const trackEvent = () => {};

const syncAchievements = () => {};

export {
  awardXp,
  updateMission,
  updateChallenge,
  ensureDailyMissions,
  ensureWeeklyChallenges,
  ensureWeeklyFocus,
  ensureOnboarding,
  progressWeeklyFocus,
  isUnlocked,
  trackEvent,
  syncAchievements
};
