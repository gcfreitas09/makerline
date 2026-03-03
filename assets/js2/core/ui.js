import { saveState, state } from './state.js';

const ACTIVE_PAGES = new Set(['dashboard', 'brands', 'campaigns', 'finance', 'settings']);

const setActivePage = (page) => {
  const navItems = document.querySelectorAll('.nav-item[data-target]');
  const sections = document.querySelectorAll('.page-section');
  const validPages = new Set(
    Array.from(sections)
      .map((section) => String(section.dataset.section || '').trim())
      .filter((section) => ACTIVE_PAGES.has(section))
  );
  const requestedPage = ACTIVE_PAGES.has(page) ? page : 'dashboard';
  const targetPage = validPages.has(requestedPage)
    ? requestedPage
    : validPages.has('dashboard')
      ? 'dashboard'
      : Array.from(validPages)[0] || 'dashboard';

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

const showToast = () => {};

const showXpToast = () => {};

const requestNotificationPermission = () => {};

const setScriptOutput = (text) => {
  const output = document.getElementById('script-output');
  if (output) {
    output.textContent = text || 'Preencha o briefing e gere seu primeiro roteiro.';
  }
};

export { setActivePage, showToast, showXpToast, setScriptOutput, requestNotificationPermission };
