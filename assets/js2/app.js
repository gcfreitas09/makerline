import { state, saveState, replaceState, enableRemoteSave } from './core/state.js';
import { renderAll } from './core/renderers.js?v=20260304c';
import { setActivePage } from './core/ui.js?v=20260304b';
import { initActions } from './core/actions.js?v=20260314a';
import { initOnboardingQuiz } from './features/onboarding/quiz.js?v=20260314b';
import { initAdminTrackerCard } from './features/settings/admin_tracker.js?v=20260304c';

  const sessionToken = sessionStorage.getItem('ugcQuestToken') || '';
  const sessionUserId = sessionStorage.getItem('ugcQuestUserId') || '';
  const hasSession = sessionStorage.getItem('ugcQuestLoggedIn') === '1' && Boolean(sessionToken) && Boolean(sessionUserId);

  if (!hasSession) {
    window.location.replace('index.html');
  }

  const initProfileFromSession = () => {
    const name = sessionStorage.getItem('ugcQuestUserName') || '';
    const email = sessionStorage.getItem('ugcQuestUserEmail') || '';
    if (name) state.profile.name = name;
    if (email) state.profile.email = email;
    saveState();
  };

const ACTIVE_PAGES = new Set(['dashboard', 'brands', 'campaigns', 'finance', 'metrics', 'settings']);

const getSafeProfileName = () => {
  const sessionName = String(sessionStorage.getItem('ugcQuestUserName') || '').trim();
  const persistedName = String(state.profile?.name || '').trim();
  if (persistedName && persistedName.toLowerCase() !== 'criador') return persistedName;
  return sessionName || 'Criador';
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
        </div>
      `;
    }

    const avatar = profileCard.querySelector('[data-profile-avatar]');
    const name = profileCard.querySelector('[data-profile-name]');
    const safeInitial = getSafeProfileInitial();
    const safeName = getSafeProfileName();
    if (avatar && avatar.textContent !== safeInitial) avatar.textContent = safeInitial;
    if (name && name.textContent !== safeName) name.textContent = safeName;
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
  const token = sessionStorage.getItem('ugcQuestToken') || '';
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
  const token = sessionStorage.getItem('ugcQuestToken') || '';
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

    // Verificar se o estado remoto tem dados válidos (não é um estado vazio/default)
    const remoteState = data.state;
    const hasValidRemoteData = (
      (remoteState.campaigns && remoteState.campaigns.length > 0) ||
      (remoteState.brands && remoteState.brands.length > 0) ||
      Boolean(String(remoteState.meta?.updatedAt || '').trim())
    );

    // Se o estado remoto tem dados válidos, usar ele
    // Caso contrário, manter o estado local
    if (hasValidRemoteData) {
      console.log('[Sync] Carregando estado do servidor:', {
        campanhas: remoteState.campaigns?.length || 0,
        marcas: remoteState.brands?.length || 0
      });
      replaceState(remoteState);
      initProfileFromSession();
      sanitizeActiveUiState();
    } else {
      console.log('[Sync] Estado remoto vazio, mantendo estado local');
    }
  } catch (e) {
    console.warn('[Sync] Erro ao carregar estado:', e);
  }
};

  // Renderizar imediatamente se houver sessão
  if (hasSession) {
    safeRun('initProfileFromSession', initProfileFromSession);
    safeRun('sanitizeActiveUiState', sanitizeActiveUiState);
    safeRun('enforceModernShell', enforceModernShell);
    safeRun('startShellGuard', startShellGuard);
    safeRun('renderAll', renderAll);
    safeRun('setActivePage(dashboard)', () => setActivePage('dashboard'));
    safeRun('initActions', initActions);
    safeRun('initAdminTrackerCard', initAdminTrackerCard);
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!hasSession) return;
    safeRun('initSessionTimeTracking', initSessionTimeTracking);
    
    (async () => {
      safeRun('initActions', initActions);
      // Carregar estado do servidor APÓS inicialização
      await hydrateStateFromServer();

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
      safeRun('setActivePage(dashboard)', () => setActivePage('dashboard'));
      safeRun('initAdminTrackerCard', initAdminTrackerCard);
    })();
    window.__ugcAppLoaded = true;
  });

window.addEventListener('pageshow', () => {
  if (sessionStorage.getItem('ugcQuestLoggedIn') !== '1') {
    window.location.replace('index.html');
  }
});
