import { state, saveState, replaceState, enableRemoteSave } from './core/state.js';
import { renderAll } from './core/renderers.js?v=20260710a';
import { setActivePage, showToast } from './core/ui.js?v=20260711a';
import { initActions } from './core/actions.js?v=20260728a';
import { initOnboardingQuiz } from './features/onboarding/quiz.js?v=20260728a';
import { initFeedbackWidget, initAdminFeedback } from './features/feedback/feedback.js?v=20260711c';
import { initClarity, identifyClarityUser } from './core/clarity.js?v=20260727e';
import {
  initPushRuntime,
  enablePushNotifications,
  disablePushNotifications,
  isPushActive,
  isSupported as isPushSupported,
  isIosNeedsInstall,
} from './core/push.js?v=20260721a';
import { applyOptimisticBillingPlanFromPending, clearPendingCheckoutPlan, getBillingSnapshot, refreshBillingStatus, waitForBillingActivation, writeCachedBilling } from './features/settings/billing.js?v=20260628a';

const applyTheme = (theme) => {
  const safeTheme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.dataset.theme = safeTheme;
  document.body.dataset.theme = safeTheme;
  const toggle = document.querySelector('[data-theme-toggle]');
  if (toggle) {
    toggle.setAttribute('aria-label', safeTheme === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro');
    toggle.setAttribute('aria-pressed', safeTheme === 'light' ? 'true' : 'false');
  }
  try {
    localStorage.setItem('makerlineTheme', safeTheme);
  } catch (error) {}
};

const initThemeToggle = () => {
  let stored = '';
  try {
    stored = localStorage.getItem('makerlineTheme') || '';
  } catch (error) {}
  applyTheme(stored === 'light' ? 'light' : 'dark');

  const toggle = document.querySelector('[data-theme-toggle]');
  if (!toggle || toggle.dataset.bound === '1') return;
  toggle.dataset.bound = '1';
  toggle.addEventListener('click', () => {
    applyTheme(document.body.dataset.theme === 'light' ? 'dark' : 'light');
  });
};

const setAuthMode = (enabled) => {
  const authGate = document.getElementById('auth-gate');
  const appShell = document.getElementById('app-shell');
  const themeToggle = document.getElementById('theme-toggle');
  document.body.classList.toggle('auth-mode', enabled);
  if (authGate) authGate.hidden = !enabled;
  if (appShell) appShell.hidden = enabled;
  if (themeToggle) themeToggle.hidden = enabled;
};

const persistSession = ({ token, user }) => {
  const safeToken = String(token || '').trim();
  const safeUserId = String(user?.id || '').trim();
  const safeEmail = String(user?.email || '').trim();
  const safeName = String(user?.name || '').trim();
  const clarityExcluded = user?.clarityExcluded === true;
  if (!safeToken || !safeUserId) return false;

  try {
    sessionStorage.setItem('ugcQuestLoggedIn', '1');
    sessionStorage.setItem('ugcQuestToken', safeToken);
    sessionStorage.setItem('ugcQuestUserId', safeUserId);
    if (safeEmail) sessionStorage.setItem('ugcQuestUserEmail', safeEmail);
    if (safeName) sessionStorage.setItem('ugcQuestUserName', safeName);
    sessionStorage.setItem('ugcQuestClarityExcluded', clarityExcluded ? '1' : '0');
  } catch (error) {}

  try {
    localStorage.setItem('ugcQuestSessionLoggedIn', '1');
    localStorage.setItem('ugcQuestSessionToken', safeToken);
    localStorage.setItem('ugcQuestSessionUserId', safeUserId);
    if (safeEmail) localStorage.setItem('ugcQuestSessionUserEmail', safeEmail);
    if (safeName) localStorage.setItem('ugcQuestSessionUserName', safeName);
    localStorage.setItem('ugcQuestSessionClarityExcluded', clarityExcluded ? '1' : '0');
  } catch (error) {}

  if (user && typeof user.billing === 'object' && user.billing) {
    try {
      writeCachedBilling(user.billing);
    } catch (error) {}
  }

  return true;
};

const normalizeReferralCode = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const persistReferralFromUrl = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const referralCode = normalizeReferralCode(
      params.get('ref') || params.get('referralCode') || params.get('referral_code') || ''
    );
    if (!referralCode) return '';
    sessionStorage.setItem('makerlineReferralCode', referralCode);
    localStorage.setItem('makerlineReferralCode', referralCode);
    return referralCode;
  } catch (error) {
    return '';
  }
};

const getPersistedReferralCode = () => {
  persistReferralFromUrl();
  try {
    return normalizeReferralCode(
      sessionStorage.getItem('makerlineReferralCode') ||
        localStorage.getItem('makerlineReferralCode') ||
        ''
    );
  } catch (error) {
    return '';
  }
};

const initAuthGate = () => {
  if (window.__ugcAuthGateBound) return;

  const loginTab = document.getElementById('auth-tab-login');
  const signupTab = document.getElementById('auth-tab-signup');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const loginMsg = document.getElementById('login-msg');
  const signupMsg = document.getElementById('signup-msg');
  const loginSubmit = document.getElementById('login-submit');
  const signupSubmit = document.getElementById('signup-submit');
  const forgotPasswordBtn = document.getElementById('forgot-password-btn');
  if (!loginTab || !signupTab || !loginForm || !signupForm || !loginMsg || !signupMsg || !loginSubmit || !signupSubmit) {
    return;
  }

  const setTab = (tab) => {
    const loginActive = tab !== 'signup';
    loginTab.classList.toggle('active', loginActive);
    loginTab.setAttribute('aria-selected', loginActive ? 'true' : 'false');
    signupTab.classList.toggle('active', !loginActive);
    signupTab.setAttribute('aria-selected', !loginActive ? 'true' : 'false');
    loginForm.classList.toggle('active', loginActive);
    signupForm.classList.toggle('active', !loginActive);
    loginMsg.textContent = '';
    signupMsg.textContent = '';
  };

  document.querySelectorAll('[data-auth-tab]').forEach((button) => {
    button.addEventListener('click', () => setTab(String(button.dataset.authTab || 'login')));
  });

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginMsg.textContent = 'Entrando...';
    loginSubmit.disabled = true;

    const formData = new FormData(loginForm);
    const payload = {
      action: 'login',
      email: String(formData.get('email') || '').trim(),
      password: String(formData.get('password') || '')
    };

    try {
      const response = await fetch('api/auth.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || data.ok !== true || !persistSession(data)) {
        loginMsg.textContent = (data && data.error) || 'Não consegui fazer login agora.';
        return;
      }
      window.location.replace('app.html');
    } catch (error) {
      loginMsg.textContent = 'Não consegui fazer login agora.';
    } finally {
      loginSubmit.disabled = false;
    }
  });

  signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    signupMsg.textContent = 'Criando conta...';
    signupSubmit.disabled = true;

    const formData = new FormData(signupForm);
    const payload = {
      action: 'signup',
      name: String(formData.get('name') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      password: String(formData.get('password') || ''),
      referralCode: getPersistedReferralCode(),
    };

    try {
      const response = await fetch('api/auth.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || data.ok !== true || !persistSession(data)) {
        signupMsg.textContent = (data && data.error) || 'Não consegui criar sua conta agora.';
        return;
      }
      window.location.replace('app.html');
    } catch (error) {
      signupMsg.textContent = 'Não consegui criar sua conta agora.';
    } finally {
      signupSubmit.disabled = false;
    }
  });

  if (forgotPasswordBtn) {
    forgotPasswordBtn.addEventListener('click', () => {
      const email = String((document.getElementById('login-email')?.value || '')).trim().toLowerCase();
      try {
        if (email) {
          sessionStorage.setItem('ugcQuestResetEmail', email);
          sessionStorage.removeItem('ugcQuestResetCode');
        }
      } catch (error) {}
      window.location.href = email ? `verify.html?email=${encodeURIComponent(email)}` : 'verify.html';
    });
  }

  setTab('login');
  window.__ugcAuthGateBound = true;
};

const getStoredAuth = (key, fallbackKey = '') => {
  try {
    const sessionValue = sessionStorage.getItem(key) || '';
    if (sessionValue) return sessionValue;
  } catch (error) {}
  try {
    return fallbackKey ? localStorage.getItem(fallbackKey) || '' : '';
  } catch (error) {
    return '';
  }
};

const restoreSessionFromPersistentStorage = () => {
  const token = getStoredAuth('ugcQuestToken', 'ugcQuestSessionToken');
  const userId = getStoredAuth('ugcQuestUserId', 'ugcQuestSessionUserId');
  const email = getStoredAuth('ugcQuestUserEmail', 'ugcQuestSessionUserEmail');
  const name = getStoredAuth('ugcQuestUserName', 'ugcQuestSessionUserName');
  const clarityExcluded = getStoredAuth('ugcQuestClarityExcluded', 'ugcQuestSessionClarityExcluded');
  const loggedIn = getStoredAuth('ugcQuestLoggedIn', 'ugcQuestSessionLoggedIn') === '1';
  if (!loggedIn || !token || !userId) return false;

  try {
    sessionStorage.setItem('ugcQuestLoggedIn', '1');
    sessionStorage.setItem('ugcQuestToken', token);
    sessionStorage.setItem('ugcQuestUserId', userId);
    if (email) sessionStorage.setItem('ugcQuestUserEmail', email);
    if (name) sessionStorage.setItem('ugcQuestUserName', name);
    if (clarityExcluded) sessionStorage.setItem('ugcQuestClarityExcluded', clarityExcluded);
  } catch (error) {}

  return true;
};

  restoreSessionFromPersistentStorage();
  const sessionToken = getStoredAuth('ugcQuestToken', 'ugcQuestSessionToken');
  const sessionUserId = getStoredAuth('ugcQuestUserId', 'ugcQuestSessionUserId');
  const hasSession = getStoredAuth('ugcQuestLoggedIn', 'ugcQuestSessionLoggedIn') === '1' && Boolean(sessionToken) && Boolean(sessionUserId);

  const isPlaceholderProfileName = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return !normalized || normalized === 'perfil' || normalized === 'criador';
  };

  const initProfileFromSession = () => {
    const name = String(getStoredAuth('ugcQuestUserName', 'ugcQuestSessionUserName') || '').trim();
    const email = String(getStoredAuth('ugcQuestUserEmail', 'ugcQuestSessionUserEmail') || '').trim();
    const currentName = String(state.profile.name || '').trim();
    if (name && !isPlaceholderProfileName(name)) state.profile.name = name;
    if (email) state.profile.email = email;
    if (isPlaceholderProfileName(state.profile.name) && currentName && !isPlaceholderProfileName(currentName)) {
      state.profile.name = currentName;
    }
    saveState();
  };

const ACTIVE_PAGES = new Set(['dashboard', 'brands', 'campaigns', 'prospeccao', 'finance', 'metrics', 'plans', 'settings', 'feedback']);

const getRequestedPage = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const section = String(params.get('section') || '').trim();
    if (ACTIVE_PAGES.has(section)) return section;
    if (String(params.get('billing') || '').trim()) return 'settings';
  } catch (error) {}

  const saved = String(state.ui.activePage || '').trim();
  return ACTIVE_PAGES.has(saved) ? saved : 'dashboard';
};

const getBillingReturnCode = () => {
  try {
    return String(new URLSearchParams(window.location.search).get('billing') || '').trim();
  } catch (error) {
    return '';
  }
};

const getBillingReturnSessionId = () => {
  try {
    return String(new URLSearchParams(window.location.search).get('session_id') || '').trim();
  } catch (error) {
    return '';
  }
};

const getBillingPlanLabel = (billing = {}) => {
  const plan = String(billing.plan || '').trim();
  if (plan === 'annual') return 'Plano Anual';
  if (plan === 'monthly') return 'Plano Mensal';
  if (plan === 'internal') return 'Plano Interno';
  return 'Plano Premium';
};

const getBillingCelebrationKey = () => {
  if (getBillingReturnCode() !== 'success') return '';
  const sessionId = getBillingReturnSessionId();
  return sessionId ? `ugcQuestBillingCelebration:${sessionId}` : '';
};

const hasSeenBillingCelebration = () => {
  const key = getBillingCelebrationKey();
  if (!key) return false;
  try {
    return sessionStorage.getItem(key) === '1';
  } catch (error) {
    return false;
  }
};

const markBillingCelebrationSeen = () => {
  const key = getBillingCelebrationKey();
  if (!key) return;
  try {
    sessionStorage.setItem(key, '1');
  } catch (error) {}
};

const spawnBillingConfetti = (layer) => {
  if (!layer) return;
  const colors = ['#6ee7b7', '#34d399', '#fbbf24', '#60a5fa', '#f472b6', '#a78bfa'];
  const pieces = Array.from({ length: 26 }, (_, index) => {
    const piece = document.createElement('span');
    piece.className = 'billing-confetti';
    piece.style.setProperty('--confetti-left', `${6 + Math.random() * 88}%`);
    piece.style.setProperty('--confetti-size', `${8 + Math.random() * 8}px`);
    piece.style.setProperty('--confetti-height', `${14 + Math.random() * 14}px`);
    piece.style.setProperty('--confetti-color', colors[index % colors.length]);
    piece.style.setProperty('--confetti-rise', `-${44 + Math.random() * 42}vh`);
    piece.style.setProperty('--confetti-drift', `${-120 + Math.random() * 240}px`);
    piece.style.setProperty('--confetti-rotate-start', `${Math.round(Math.random() * 180)}deg`);
    piece.style.setProperty('--confetti-rotate-end', `${180 + Math.round(Math.random() * 540)}deg`);
    piece.style.setProperty('--confetti-duration', `${2100 + Math.round(Math.random() * 700)}ms`);
    piece.style.animationDelay = `${Math.round(Math.random() * 260)}ms`;
    return piece;
  });
  layer.replaceChildren(...pieces);
  layer.hidden = false;
  layer.classList.remove('is-active');
  void layer.offsetWidth;
  layer.classList.add('is-active');
};

const showBillingSuccessCelebration = (billing = {}) => {
  const plan = String(billing.plan || '').trim();
  const hasPremium = Boolean(billing.hasPremiumAccess) || plan === 'monthly' || plan === 'annual' || plan === 'internal';
  if (!hasPremium || window.__ugcBillingCelebrationActive || hasSeenBillingCelebration()) return false;

  const toast = document.getElementById('billing-success-toast');
  const layer = document.getElementById('billing-confetti-layer');
  if (!toast || !layer) return false;

  const pill = toast.querySelector('.billing-success-toast__pill');
  const title = toast.querySelector('.billing-success-toast__title');
  const planLabel = getBillingPlanLabel(billing);

  if (pill) pill.textContent = 'Assinatura confirmada';
  if (title) title.textContent = `Você agora faz parte do ${planLabel}.`;

  markBillingCelebrationSeen();
  window.__ugcBillingCelebrationActive = true;

  spawnBillingConfetti(layer);
  toast.hidden = false;
  toast.classList.remove('is-visible');
  void toast.offsetWidth;
  toast.classList.add('is-visible');

  window.setTimeout(() => {
    toast.classList.remove('is-visible');
    toast.hidden = true;
    layer.classList.remove('is-active');
    layer.replaceChildren();
    layer.hidden = true;
    window.__ugcBillingCelebrationActive = false;
  }, 2900);

  return true;
};

const primeBillingUiFromReturn = () => {
  const returnCode = getBillingReturnCode();
  if (returnCode === 'success') {
    applyOptimisticBillingPlanFromPending();
    return;
  }
  if (returnCode === 'cancel') {
    clearPendingCheckoutPlan();
  }
};

const clearBillingParamsFromUrl = () => {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('billing') && !url.searchParams.has('session_id')) return;
    url.searchParams.delete('billing');
    url.searchParams.delete('session_id');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  } catch (error) {}
};

const shouldHidePlansNav = (billing = {}) => {
  const plan = String(billing.plan || '').trim();
  return (
    Boolean(billing.isInternalAccess) ||
    plan === 'internal' ||
    plan === 'monthly' ||
    plan === 'annual'
  );
};

const enforceBillingAccess = () => {
  const billing = getBillingSnapshot();
  const locked = Boolean(billing.trialExpired && !billing.hasFullAccess);
  const hidePlans = shouldHidePlansNav(billing) && !locked;
  document.body.classList.toggle('billing-locked', locked);
  document.body.classList.toggle('hide-plans-nav', hidePlans);
  document.querySelectorAll('.nav-item[data-target]').forEach((item) => {
    const target = String(item.dataset.target || '').trim();
    const allowed = !locked || target === 'plans' || target === 'settings';
    if (target === 'plans') {
      item.hidden = hidePlans;
      item.setAttribute('aria-hidden', hidePlans ? 'true' : 'false');
      if (hidePlans) {
        item.style.setProperty('display', 'none', 'important');
      } else {
        item.style.removeProperty('display');
      }
    }
    item.classList.toggle('is-disabled', !allowed);
    item.disabled = !allowed;
  });
  if (locked && !['plans', 'settings'].includes(String(state.ui.activePage || ''))) {
    setActivePage('plans');
  } else if (!locked && hidePlans && String(state.ui.activePage || '') === 'plans') {
    setActivePage('settings');
  }
};

const getSafeProfileName = () => {
  const sessionName = String(getStoredAuth('ugcQuestUserName', 'ugcQuestSessionUserName') || '').trim();
  const persistedName = String(state.profile.name || '').trim();
  if (!isPlaceholderProfileName(persistedName)) return persistedName;
  if (!isPlaceholderProfileName(sessionName)) return sessionName;
  return 'Criador';
};

const getSafeProfileInitial = () => getSafeProfileName().charAt(0).toUpperCase() || 'C';

const safeRun = (label, fn) => {
  try {
    fn();
  } catch (error) {
    console.warn(`[app] ${label} falhou`, error);
  }
};

  const sanitizeActiveUiState = () => {
  if (!state.ui || typeof state.ui !== 'object') state.ui = {};
  const activePage = String(state.ui.activePage || 'dashboard').trim();
  state.ui.activePage = ACTIVE_PAGES.has(activePage) ? activePage : 'dashboard';
  if (typeof state.ui.campaignDashboardFilter !== 'string') state.ui.campaignDashboardFilter = '';
  if (typeof state.ui.dashboardPipelineOpen !== 'string') state.ui.dashboardPipelineOpen = '';
  if (typeof state.ui.prospectionSearch !== 'string') state.ui.prospectionSearch = '';
  const financeRangeDays = Number(state.ui.financeRangeDays);
  state.ui.financeRangeDays = [0, 15, 30, 45, 90].includes(financeRangeDays) ? financeRangeDays : 30;
  if (typeof state.ui.financeExpandedCampaignId !== 'string') state.ui.financeExpandedCampaignId = '';
  const metricsRangeDays = Number(state.ui.metricsRangeDays);
  state.ui.metricsRangeDays = [0, 15, 30, 45, 90].includes(metricsRangeDays) ? metricsRangeDays : 30;
  if (typeof state.ui.metricsStatusOpen !== 'string') state.ui.metricsStatusOpen = '';
};

const enforceModernShell = () => {
  document.querySelectorAll('.nav-item[data-target]').forEach((item) => {
    const target = String(item.dataset.target || '').trim();
    if (!ACTIVE_PAGES.has(target)) item.remove();
  });

  document.querySelectorAll('.page-section').forEach((section) => {
    const target = String(section.dataset.section || '').trim();
    if (!ACTIVE_PAGES.has(target)) section.remove();
  });

  document
    .querySelectorAll(
      '.brand-user-chip, .brand-tag, [data-missions], [data-challenges], [data-performance-summary], [data-performance-content], [data-performance-tabs], [data-script-history], #xp-toast, #toast-root'
    )
    .forEach((node) => node.remove());

  const brand = document.querySelector('.brand');
  if (brand) {
    const brandNeedsReset =
      Boolean(brand.querySelector('.brand-user-chip, .brand-tag')) ||
      !brand.querySelector('.brand-name') ||
      !brand.querySelector('.brand-icon img');

    if (brandNeedsReset) {
      brand.innerHTML = `
        <div class="brand-icon">
          <img src="assets/img/logo.png" alt="Makerline" />
        </div>
        <div>
          <div class="brand-name">Makerline</div>
        </div>
      `;
    }

    const brandName = brand.querySelector('.brand-name');
    if (brandName && brandName.textContent !== 'Makerline') brandName.textContent = 'Makerline';
  }

  const profileCard = document.querySelector('.profile-card');
  if (profileCard) {
    const profileNeedsReset =
      profileCard.classList.contains('profile-card--account') ||
      Boolean(profileCard.querySelector('.profile-value, .progress-track, [data-profile-name-sidebar], [data-profile-initial]')) ||
      !profileCard.querySelector('[data-profile-avatar]') ||
      !profileCard.querySelector('[data-profile-name]');

    if (profileNeedsReset) {
      profileCard.className = 'profile-card';
      profileCard.innerHTML = `
        <div class="profile-avatar" data-profile-avatar>${getSafeProfileInitial()}</div>
        <div class="profile-card-copy">
          <div class="profile-card-name" data-profile-name>${getSafeProfileName()}</div>
          <div class="profile-card-plan" data-profile-plan>Plano</div>
        </div>
      `;
    }

    const avatar = profileCard.querySelector('[data-profile-avatar]');
    const name = profileCard.querySelector('[data-profile-name]');
    let plan = profileCard.querySelector('[data-profile-plan]');
    const safeInitial = getSafeProfileInitial();
    const safeName = getSafeProfileName();
    if (avatar && avatar.textContent !== safeInitial) avatar.textContent = safeInitial;
    if (name && name.textContent !== safeName) name.textContent = safeName;
    if (!plan) {
      plan = document.createElement('div');
      plan.className = 'profile-card-plan';
      plan.dataset.profilePlan = '';
      plan.textContent = 'Plano';
      const copy = profileCard.querySelector('.profile-card-copy');
      if (copy) copy.appendChild(plan);
    }
  }
};

const startShellGuard = () => {
  if (window.__ugcShellGuardStarted || !document.body) return;
  const observer = new MutationObserver(() => {
    enforceModernShell();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.__ugcShellGuardStarted = true;
};

const parseIso = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 0;
  return date.getTime();
};

const initSessionTimeTracking = () => {
  if (window.location.protocol === 'file:') return;
  const token = getStoredAuth('ugcQuestToken', 'ugcQuestSessionToken');
  if (!token) return;

  const startedAt = Date.now();
  let lastActiveAt = startedAt;
  let pendingSeconds = 0;
  let stopped = false;

  const sendSeconds = (seconds) => {
    const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    if (safeSeconds <= 0) return;

    const payload = JSON.stringify({ token, seconds: safeSeconds });

    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('api/track_time.php', new Blob([payload], { type: 'application/json' }));
        return;
      }
    } catch (e) {}

    fetch('api/track_time.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true
    }).catch(() => {});
  };

  const accumulate = (force) => {
    const now = Date.now();
    const delta = Math.max(0, Math.floor((now - lastActiveAt) / 1000));
    lastActiveAt = now;
    if (document.hidden && !force) return;
    pendingSeconds += delta;
  };

  const flush = (force) => {
    if (stopped) return;
    accumulate(force);

    const seconds = Math.floor(pendingSeconds);
    if (seconds <= 0) return;

    // Evita ficar batendo na API por qualquer coisinha, mas não perde tempo.
    if (!force && seconds < 30) return;

    pendingSeconds -= seconds;
    sendSeconds(seconds);
  };

  const stop = () => {
    if (stopped) return;
    flush(true);
    stopped = true;
  };

  const interval = window.setInterval(() => flush(false), 30000);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) flush(true);
  });

  window.addEventListener('pagehide', () => {
    window.clearInterval(interval);
    stop();
  });
};

const hydrateStateFromServer = async () => {
  if (window.location.protocol === 'file:') return;
  const token = getStoredAuth('ugcQuestToken', 'ugcQuestSessionToken');
  if (!token) return;

  try {
    const res = await fetch('api/state.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'load', token })
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data || typeof data !== 'object') return;
    if (!data.state || typeof data.state !== 'object') return;

    const remoteState = data.state;

    // Quanto trabalho real existe de cada lado. Isso e a protecao contra o caso em que
    // o salvamento no servidor falhou (sessao expirada, rede caindo): o navegador tem a
    // campanha recem-criada e o servidor nao. Antes bastava o estado remoto ter um
    // meta.updatedAt -- que toda gravacao escreve, mesmo vazia -- pra ele ser considerado
    // "valido" e sobrescrever o local, apagando o trabalho de vez.
    const contentWeight = (candidate) => {
      if (!candidate || typeof candidate !== 'object') return 0;
      const count = (key) => (Array.isArray(candidate[key]) ? candidate[key].length : 0);
      return count('campaigns') + count('brands') + count('prospections') + count('scripts');
    };

    const remoteWeight = contentWeight(remoteState);
    const localWeight = contentWeight(state);
    const remoteUpdatedAt = String(remoteState.meta?.updatedAt || '').trim();
    const localUpdatedAt = String(state.meta?.updatedAt || '').trim();

    // So aceita o remoto quando ele nao representa perda: ou tem tanto conteudo quanto o
    // local, ou o local esta vazio. Empatou em conteudo, decide quem foi salvo por ultimo.
    const remoteIsSafe =
      remoteWeight > localWeight ||
      (remoteWeight === localWeight && remoteUpdatedAt >= localUpdatedAt);

    if (remoteIsSafe) {
      replaceState(remoteState);
      initProfileFromSession();
      sanitizeActiveUiState();
    } else {
      console.warn('[Sync] Estado local tem mais dados que o servidor. Mantendo o local e reenviando.', {
        local: localWeight,
        servidor: remoteWeight,
      });
      // O que esta aqui ainda nao chegou no servidor: forca um novo envio.
      saveState();
    }
  } catch (e) {
    console.warn('[Sync] Erro ao carregar estado:', e);
  }
};

/**
 * Liga o botão de avisos no celular. No iPhone, push só existe depois que a pessoa
 * adiciona o app à tela de início, então nesse caso mostramos a instrução em vez de
 * pedir uma permissão que o navegador recusaria em silêncio.
 */
const initPushToggle = async () => {
  const row = document.querySelector('[data-push-row]');
  const input = document.getElementById('push-toggle');
  const hint = document.querySelector('[data-push-hint]');
  if (!row || !input) return;

  if (!isPushSupported()) {
    row.hidden = true;
    return;
  }

  row.hidden = false;

  if (isIosNeedsInstall()) {
    input.disabled = true;
    if (hint) {
      hint.textContent =
        'No iPhone: toque em Compartilhar e depois em "Adicionar à Tela de Início". Depois disso, volte aqui para ativar os avisos.';
    }
    return;
  }

  input.checked = await isPushActive();

  input.addEventListener('change', async () => {
    input.disabled = true;
    try {
      if (input.checked) {
        const result = await enablePushNotifications();
        if (!result.ok) {
          input.checked = false;
          const mensagens = {
            denied: 'Você bloqueou as notificações. Libere nas configurações do navegador para ativar.',
            'no-session': 'Entre na sua conta para ativar os avisos.',
            unsupported: 'Este navegador não suporta notificações.',
          };
          showToast(mensagens[result.reason] || 'Não consegui ativar os avisos agora.');
        } else {
          showToast('Pronto! Você vai receber avisos de entregas e pagamentos.');
        }
      } else {
        await disablePushNotifications();
        showToast('Avisos desativados.');
      }
    } finally {
      input.disabled = false;
    }
  });
};

  safeRun('initThemeToggle', initThemeToggle);
  if (!hasSession) {
    safeRun('setAuthMode(true)', () => setAuthMode(true));
    safeRun('initAuthGate', initAuthGate);
  } else {
    safeRun('setAuthMode(false)', () => setAuthMode(false));
    safeRun('primeBillingUiFromReturn', primeBillingUiFromReturn);
    safeRun('initProfileFromSession', initProfileFromSession);
    safeRun('sanitizeActiveUiState', sanitizeActiveUiState);
    safeRun('enforceModernShell', enforceModernShell);
    safeRun('startShellGuard', startShellGuard);
    safeRun('renderAll', renderAll);
    safeRun('setActivePage(initial)', () => setActivePage(getRequestedPage()));
    safeRun('enforceBillingAccess', enforceBillingAccess);
    safeRun('initActions', initActions);
    safeRun('initFeedbackWidget', initFeedbackWidget);
    safeRun('initAdminFeedback', initAdminFeedback);
    safeRun('initClarity', () => {
      // Sessões antigas sem essa flag ficam fora por segurança até o próximo login.
      const excluded = getStoredAuth('ugcQuestClarityExcluded', 'ugcQuestSessionClarityExcluded') !== '0';
      if (excluded) return;
      initClarity();
      identifyClarityUser(getStoredAuth('ugcQuestUserId', 'ugcQuestSessionUserId'));
    });
    safeRun('initPushRuntime', initPushRuntime);
    safeRun('initPushToggle', initPushToggle);
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!hasSession) {
      window.__ugcAppLoaded = true;
      return;
    }
    safeRun('initSessionTimeTracking', initSessionTimeTracking);
    
    (async () => {
      safeRun('initActions', initActions);
      // Carregar estado do servidor APÓS inicialização
      await hydrateStateFromServer();
      if (getBillingReturnCode() === 'success') {
        const activatedBilling = await waitForBillingActivation();
        const celebrationBilling =
          activatedBilling && (activatedBilling.hasPremiumAccess || ['monthly', 'annual', 'internal'].includes(String(activatedBilling.plan || '').trim()))
            ? activatedBilling
            : getBillingSnapshot();
        safeRun('showBillingSuccessCelebration', () => showBillingSuccessCelebration(celebrationBilling));
        clearBillingParamsFromUrl();
        clearPendingCheckoutPlan();
      } else {
        await refreshBillingStatus();
        if (getBillingReturnCode() === 'cancel') {
          clearPendingCheckoutPlan();
        }
      }
      safeRun('enforceBillingAccess', enforceBillingAccess);

      // Habilitar salvamento remoto somente após hidratação
      safeRun('enableRemoteSave', enableRemoteSave);
      safeRun('sanitizeActiveUiState', sanitizeActiveUiState);
      safeRun('enforceModernShell', enforceModernShell);
      safeRun('startShellGuard', startShellGuard);

      // Inicializar quiz de onboarding
      safeRun('initOnboardingQuiz', initOnboardingQuiz);
      
      // Re-renderizar com dados do servidor
      safeRun('initProfileFromSession', initProfileFromSession);
      safeRun('enforceModernShell', enforceModernShell);
      safeRun('renderAll', renderAll);
      
      // Debug
      window.state = state;
      console.log('[App] Estado do servidor carregado');
      
      // Inicializar features
      safeRun('setActivePage(initial)', () => setActivePage(getRequestedPage()));
      safeRun('enforceBillingAccess', enforceBillingAccess);
      safeRun('initFeedbackWidget', initFeedbackWidget);
      safeRun('initAdminFeedback', initAdminFeedback);
    })();
    window.__ugcAppLoaded = true;
  });

window.addEventListener('pageshow', () => {
  restoreSessionFromPersistentStorage();
  if (!getStoredAuth('ugcQuestToken', 'ugcQuestSessionToken')) return;
  if (String(window.location.search || '').includes('billing=')) {
    const returnCode = getBillingReturnCode();
    primeBillingUiFromReturn();
    const loader = returnCode === 'success' ? waitForBillingActivation : refreshBillingStatus;
    loader().then((billingSnapshot) => {
      if (returnCode === 'success') {
        const celebrationBilling =
          billingSnapshot && (billingSnapshot.hasPremiumAccess || ['monthly', 'annual', 'internal'].includes(String(billingSnapshot.plan || '').trim()))
            ? billingSnapshot
            : getBillingSnapshot();
        showBillingSuccessCelebration(celebrationBilling);
      }
      clearBillingParamsFromUrl();
      if (returnCode === 'success' || returnCode === 'cancel') {
        clearPendingCheckoutPlan();
      }
      renderAll();
      setActivePage(getRequestedPage());
      enforceBillingAccess();
    }).catch(() => {});
  }
});
