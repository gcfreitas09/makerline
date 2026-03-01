  import { state, saveState, replaceState, enableRemoteSave } from './core/state.js';
  import { renderAll } from './core/renderers.js?v=20260301p';
  import { setActivePage } from './core/ui.js?v=20260301h';
  import { initActions } from './core/actions.js?v=20260301p';
  import { initOnboardingQuiz } from './features/onboarding/quiz.js?v=20260301s';
  import { initAdminTrackerCard } from './features/settings/admin_tracker.js?v=20260217b';

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
      (remoteState.gamification && remoteState.gamification.xp > 0)
    );

    // Se o estado remoto tem dados válidos, usar ele
    // Caso contrário, manter o estado local
    if (hasValidRemoteData) {
      console.log('[Sync] Carregando estado do servidor:', {
        campanhas: remoteState.campaigns?.length || 0,
        xp: remoteState.gamification?.xp || 0,
        level: remoteState.gamification?.level || 1
      });
      replaceState(remoteState);
    } else {
      console.log('[Sync] Estado remoto vazio, mantendo estado local');
    }
  } catch (e) {
    console.warn('[Sync] Erro ao carregar estado:', e);
  }
};

  // Renderizar imediatamente se houver sessão
  if (hasSession) {
    initProfileFromSession();
    renderAll();
    setActivePage('dashboard');
    initAdminTrackerCard();
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (!hasSession) return;
    initSessionTimeTracking();
    
    (async () => {
      // Carregar estado do servidor APÓS inicialização
      await hydrateStateFromServer();

      // Habilitar salvamento remoto somente após hidratação
      enableRemoteSave();
      
      // Inicializar quiz de onboarding
      initOnboardingQuiz();
      
      // Re-renderizar com dados do servidor
      renderAll();
      
      // Debug
      window.state = state;
      console.log('[App] Estado do servidor carregado');
      
      // Inicializar features
      setActivePage('dashboard');
      initActions();
    })();
  window.__ugcAppLoaded = true;
});

window.addEventListener('pageshow', () => {
  if (sessionStorage.getItem('ugcQuestLoggedIn') !== '1') {
    window.location.replace('index.html');
  }
});
