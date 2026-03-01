import { saveState, state } from './state.js';

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
