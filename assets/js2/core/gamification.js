const awardXp = () => 0;

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
