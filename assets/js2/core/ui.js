import { saveState, state } from './state.js';

const ACTIVE_PAGES = new Set(['dashboard', 'brands', 'campaigns', 'prospeccao', 'pricing', 'finance', 'metrics', 'plans', 'settings', 'feedback']);

const setActivePage = (page) => {
  const navItems = document.querySelectorAll('.nav-item[data-target]');
  const sections = document.querySelectorAll('.page-section');
  const validPages = Array.from(sections).map((section) => section.dataset.section);
  let targetPage = validPages.includes(page) ? page : 'dashboard';
  try {
    const billing = window.__ugcBilling.getBillingSnapshot();
    const locked = billing.trialExpired && !billing.hasFullAccess;
    if (locked && !['plans', 'settings'].includes(targetPage)) {
      targetPage = 'plans';
    }
  } catch (error) {}

  navItems.forEach((item) => {
    const target = String(item.dataset.target || '').trim();
    if (!ACTIVE_PAGES.has(target)) {
      item.classList.remove('active');
      return;
    }
    item.classList.toggle('active', target === targetPage);
  });

  sections.forEach((section) => {
    const target = String(section.dataset.section || '').trim();
    if (!ACTIVE_PAGES.has(target)) {
      section.classList.remove('active');
      return;
    }
    section.classList.toggle('active', target === targetPage);
  });

  state.ui.activePage = targetPage;
  saveState();
  document.body.classList.remove('sidebar-open');
};

let toastTimer = null;

const showToast = (message, options = {}) => {
  const text = String(message || '').trim();
  if (!text || typeof document === 'undefined') return;

  const duration = Math.max(500, Number(options?.duration || 2400) || 2400);
  let toast = document.getElementById('in-app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'in-app-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    Object.assign(toast.style, {
      position: 'fixed',
      top: '18px',
      left: '50%',
      transform: 'translate(-50%, -12px)',
      zIndex: '100000',
      padding: '12px 16px',
      borderRadius: '12px',
      background: 'rgba(13, 24, 36, 0.96)',
      border: '1px solid rgba(111, 232, 214, 0.35)',
      boxShadow: '0 18px 50px rgba(0, 0, 0, 0.35)',
      color: '#f7fbff',
      fontWeight: '800',
      fontSize: '14px',
      lineHeight: '1.25',
      opacity: '0',
      pointerEvents: 'none',
      transition: 'opacity 180ms ease, transform 180ms ease',
      maxWidth: 'min(360px, calc(100vw - 32px))',
      textAlign: 'center'
    });
    document.body.appendChild(toast);
  }

  toast.textContent = text;
  toast.hidden = false;
  if (toastTimer) window.clearTimeout(toastTimer);

  window.requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translate(-50%, 0)';
  });

  toastTimer = window.setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translate(-50%, -12px)';
    window.setTimeout(() => {
      if (toast) toast.hidden = true;
    }, 200);
  }, duration);
};

const showXpToast = () => {};

const requestNotificationPermission = () => {};

const setScriptOutput = (text) => {
  const output = document.getElementById('script-output');
  if (output) {
    output.textContent = text || 'Preencha o briefing e gere seu primeiro roteiro.';
  }
};

export { setActivePage, showToast, showXpToast, setScriptOutput, requestNotificationPermission };
