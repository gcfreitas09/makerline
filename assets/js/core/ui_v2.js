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

const showToast = (message) => {
  // Apenas notificação nativa
  showNativeNotification('Makerline UGC Quest', message);
};

const requestNotificationPermission = () => {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
};

const showNativeNotification = (title, body) => {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      icon: 'assets/img/logo.png',
      badge: 'assets/img/logo.png',
      tag: 'ugc-xp-' + Date.now(),
      silent: false
    });
  } catch (e) {}
};

const showXpToast = (xp, title, text) => {
  const safeXp = Number.isFinite(xp) ? Math.round(xp) : parseInt(String(xp || ''), 10) || 0;
  
  // Apenas notificação nativa
  showNativeNotification(`+${safeXp} XP — ${title || 'Boa!'}`, text || 'Continue evoluindo!');
};

const setScriptOutput = (text) => {
  const output = document.getElementById('script-output');
  if (output) {
    output.textContent = text || 'Preencha o briefing e gere seu primeiro roteiro.';
  }
};

export { setActivePage, showToast, showXpToast, setScriptOutput, requestNotificationPermission };
