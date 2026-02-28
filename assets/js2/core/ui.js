import { saveState, state } from './state.js';

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const setActivePage = (page) => {
  const navItems = document.querySelectorAll('.nav-item[data-target]');
  const sections = document.querySelectorAll('.page-section');
  const validPages = Array.from(sections).map((s) => s.dataset.section);
  const targetPage = validPages.includes(page) ? page : 'dashboard';

  navItems.forEach((item) => {
    item.classList.toggle('active', item.dataset.target === targetPage);
  });

  sections.forEach((section) => {
    section.classList.toggle('active', section.dataset.section === targetPage);
  });

  state.ui.activePage = targetPage;
  saveState();
  document.body.classList.remove('sidebar-open');
};

const playNotificationSound = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;

    // Nota 1: tom suave
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1).connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Nota 2: tom mais alto (intervalo de terça)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1108, now + 0.12);
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.setValueAtTime(0.12, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc2.connect(gain2).connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.45);

    setTimeout(() => ctx.close(), 600);
  } catch (e) {}
};

/* ── Rate limiter: máx 5 notificações a cada 2 min ── */
const NOTIF_MAX = 5;
const NOTIF_WINDOW_MS = 2 * 60 * 1000; // 2 minutos
const notifTimestamps = [];

const showInAppToast = (title, body) => {
  const existing = document.getElementById('in-app-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'in-app-toast';
  toast.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      <img src="assets/img/logo.png" alt="" style="width:28px;height:28px;border-radius:6px;flex-shrink:0;">
      <div>
        <div style="font-weight:600;font-size:13px;color:#fff;margin-bottom:2px;">${title}</div>
        <div style="font-size:12px;color:rgba(255,255,255,.75);line-height:1.3;">${body}</div>
      </div>
    </div>
  `;
  Object.assign(toast.style, {
    position: 'fixed',
    top: '16px',
    right: '16px',
    left: '16px',
    maxWidth: '380px',
    marginLeft: 'auto',
    marginRight: 'auto',
    padding: '12px 16px',
    borderRadius: '12px',
    background: 'rgba(30, 30, 40, 0.95)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.12)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    zIndex: '99999',
    opacity: '0',
    transform: 'translateY(-20px)',
    transition: 'opacity 0.3s, transform 0.3s'
  });

  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
};

const showToast = (message) => {
  showNativeNotification('Makerline UGC Quest', message);
};

const requestNotificationPermission = () => {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
};

const showNativeNotification = (title, body) => {
  // Rate limit: descarta se já atingiu 5 notificações nos últimos 2 min
  const now = Date.now();
  while (notifTimestamps.length && notifTimestamps[0] <= now - NOTIF_WINDOW_MS) {
    notifTimestamps.shift();
  }
  if (notifTimestamps.length >= NOTIF_MAX) {
    // Ainda mostra in-app toast silencioso (sem som/notificação nativa)
    showInAppToast(title, body);
    return;
  }
  notifTimestamps.push(now);

  playNotificationSound();
  // Tentar notificação nativa primeiro
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: 'assets/img/logo.png',
        badge: 'assets/img/logo.png',
        tag: 'ugc-xp-' + Date.now(),
        silent: false
      });
      return;
    } catch (e) {}
  }
  // Fallback: toast in-app (para iOS e quando permissão negada)
  showInAppToast(title, body);
};

const showXpToast = (xp, title, text) => {
  const safeXp = Number.isFinite(xp) ? Math.round(xp) : parseInt(String(xp || ''), 10) || 0;
  showNativeNotification(`+${safeXp} XP — ${title || 'Boa!'}`, text || 'Continue evoluindo!');
};

const setScriptOutput = (text) => {
  const output = document.getElementById('script-output');
  if (output) {
    output.textContent = text || 'Preencha o briefing e gere seu primeiro roteiro.';
  }
};

export { setActivePage, showToast, showXpToast, setScriptOutput, requestNotificationPermission };
