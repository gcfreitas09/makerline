import { setActivePage } from '../../core/ui.js?v=20260301g';

const STEPS = [
  {
    page: 'dashboard',
    selector: '.sidebar .nav',
    selectorMobile: '.menu-toggle',
    title: 'Menu',
    text: 'Aqui você troca de área: campanhas, marcas, roteiros, métricas...',
    textMobile: 'No celular, toca em “Menu” pra abrir e trocar de área.'
  },
  {
    page: 'dashboard',
    selector: '.focus-card',
    title: 'Foco da semana',
    text: 'Um objetivo simples pra semana. Quando rolar, clica em “Marcar +1”.'
  },
  {
    page: 'dashboard',
    selector: '[data-missions]',
    title: 'Missões diárias',
    text: 'Todo dia tem 3 missões. Faz coisas reais no app e ganha XP automaticamente.'
  },
  {
    page: 'campaigns',
    selector: '[data-action="new-campaign"]',
    title: 'Campanhas',
    text: 'Cria uma campanha e acompanha o status. Dica: o status muda direto no chip colorido.'
  },
  {
    page: 'brands',
    selector: '[data-action="new-brand"]',
    title: 'Envio p/ marcas',
    text: 'Centraliza seus contatos e o status da conversa. As dicas ficam lá embaixo pra você usar quando quiser.'
  },
  {
    page: 'scripts',
    selector: '#script-form',
    title: 'Roteiros (IA)',
    text: 'Preenche o briefing e gera o roteiro. Depois ele cai no histórico pra reutilizar.'
  },
  {
    page: 'metrics',
    selector: '[data-metric-hero]',
    title: 'Métricas',
    text: 'Um resumão do que tá rolando. Só o que importa, sem cara de planilha.'
  },
  {
    page: 'achievements',
    selector: '[data-achievements]',
    title: 'Conquistas',
    text: 'Aqui você vê todas as conquistas (até as bloqueadas). Vai liberando conforme joga.'
  },
  {
    page: 'settings',
    selector: '.settings-grid',
    title: 'Configurações',
    text: 'Liga/desliga coisas úteis (resumo semanal, alertas...) e ajusta sua conta.'
  },
  {
    page: 'dashboard',
    selector: '.nav-item.logout',
    selectorMobile: '.nav-item.logout',
    title: 'Sair',
    text: 'Quando terminar, usa o botão Sair pra voltar pro login com segurança.',
    textMobile: 'No celular, abre o menu e clica em “Sair” lá embaixo.'
  }
];

let currentIndex = 0;
let highlighted = null;

const isMobileTour = () => {
  return Boolean(window.matchMedia && window.matchMedia('(max-width: 1100px)').matches);
};

const getUserTourKey = () => {
  try {
    const id = sessionStorage.getItem('ugcQuestUserId') || sessionStorage.getItem('ugcQuestUserEmail') || 'guest';
    return `ugcQuestTourDone:${id}`;
  } catch (e) {
    return 'ugcQuestTourDone:guest';
  }
};

const getUserTourCompletedKey = () => {
  return String(getUserTourKey()).replace('ugcQuestTourDone:', 'ugcQuestTourCompleted:');
};

const getEls = () => ({
  overlay: document.getElementById('tour'),
  title: document.getElementById('tour-title'),
  text: document.getElementById('tour-text'),
  progress: document.getElementById('tour-progress'),
  nextBtn: document.querySelector('[data-action="tour-next"]'),
  prevBtn: document.querySelector('[data-action="tour-prev"]')
});

const isOpen = () => {
  const { overlay } = getEls();
  return Boolean(overlay && overlay.classList.contains('open'));
};

const clearHighlight = () => {
  if (!highlighted) return;
  highlighted.classList.remove('tour-highlight');
  highlighted = null;
};

const highlightTarget = (target) => {
  clearHighlight();
  if (!target) return;
  highlighted = target;
  highlighted.classList.add('tour-highlight');
};

const getStepText = (step) => {
  if (isMobileTour() && step?.textMobile) return step.textMobile;
  return step?.text || '';
};

const updatePanel = () => {
  const step = STEPS[currentIndex];
  const { title, text, progress, nextBtn, prevBtn } = getEls();
  if (title) title.textContent = step?.title || '';
  if (text) text.textContent = getStepText(step);
  if (progress) progress.textContent = `${currentIndex + 1} de ${STEPS.length}`;
  if (prevBtn) prevBtn.disabled = currentIndex === 0;
  if (nextBtn) nextBtn.textContent = currentIndex === STEPS.length - 1 ? 'Finalizar' : 'Próximo';
};

const getStepSelector = (step) => {
  if (!step) return '';
  if (isMobileTour() && step.selectorMobile) return step.selectorMobile;
  return step.selector || '';
};

const ensureMobileMenuForStep = (step) => {
  if (!isMobileTour()) return;
  const selector = getStepSelector(step);
  const needsSidebar = selector.includes('.nav-item.logout') || selector.includes('.sidebar');

  if (needsSidebar) {
    document.body.classList.add('sidebar-open');
  } else {
    document.body.classList.remove('sidebar-open');
  }
};

const findTarget = (step) => {
  if (!step) return null;
  const selector = getStepSelector(step);
  const direct = selector ? document.querySelector(selector) : null;
  if (direct) return direct;
  return step.page ? document.querySelector(`[data-section="${step.page}"]`) : null;
};

const scrollTargetVisible = (target) => {
  if (!target) return;

  const panel = document.querySelector('.tour-panel');
  const behavior = isMobileTour() ? 'auto' : 'smooth';

  try {
    target.scrollIntoView({ block: 'center', behavior });
  } catch (e) {}

  if (!panel) return;

  window.setTimeout(() => {
    try {
      const rect = target.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const padding = 14;

      if (rect.bottom > panelRect.top - padding) {
        const delta = rect.bottom - (panelRect.top - padding);
        window.scrollBy({ top: delta, behavior });
      }

      if (rect.top < padding) {
        const delta = rect.top - padding;
        window.scrollBy({ top: delta, behavior });
      }
    } catch (e) {}
  }, 120);
};

const showStep = (index) => {
  currentIndex = Math.min(Math.max(index, 0), STEPS.length - 1);
  const step = STEPS[currentIndex];

  if (step?.page) {
    setActivePage(step.page);
  }

  updatePanel();

  window.requestAnimationFrame(() => {
    ensureMobileMenuForStep(step);
    const target = findTarget(step);
    if (target) {
      highlightTarget(target);
      scrollTargetVisible(target);
    } else {
      clearHighlight();
    }
  });
};

const openTour = ({ force = false } = {}) => {
  const { overlay } = getEls();
  if (!overlay) return;
  if (isOpen()) return;

  const key = getUserTourKey();
  const done = !force && (() => {
    try {
      return localStorage.getItem(key) === '1';
    } catch (e) {
      return false;
    }
  })();

  if (done) return;

  overlay.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  showStep(0);
};

const closeTour = ({ markDone = true, completed = false } = {}) => {
  const { overlay } = getEls();
  if (!overlay) return;
  overlay.classList.remove('open');
  overlay.setAttribute('aria-hidden', 'true');
  clearHighlight();
  document.body.classList.remove('sidebar-open');

  if (markDone) {
    const key = getUserTourKey();
    let alreadyDone = false;
    try {
      alreadyDone = localStorage.getItem(key) === '1';
    } catch (e) {}

    try {
      localStorage.setItem(key, '1');
    } catch (e) {}

    if (completed) {
      const completedKey = getUserTourCompletedKey();
      let alreadyCompleted = false;
      try {
        alreadyCompleted = localStorage.getItem(completedKey) === '1';
      } catch (e) {}

      try {
        localStorage.setItem(completedKey, '1');
      } catch (e) {}

      if (!alreadyCompleted) {
        try {
          document.dispatchEvent(new CustomEvent('ugcQuest:tourCompleted'));
        } catch (e) {}
      }
    }
  }
};

const nextTour = () => {
  if (!isOpen()) return;
  if (currentIndex >= STEPS.length - 1) {
    closeTour({ markDone: true, completed: true });
    return;
  }
  showStep(currentIndex + 1);
};

const prevTour = () => {
  if (!isOpen()) return;
  showStep(currentIndex - 1);
};

const skipTour = () => {
  if (!isOpen()) return;
  closeTour({ markDone: true });
};

const initTour = () => {
  const { overlay } = getEls();
  if (!overlay) return;
  if (overlay.dataset.bound === '1') return;
  overlay.dataset.bound = '1';

  document.addEventListener('keydown', (event) => {
    if (!isOpen()) return;
    if (event.key === 'Escape') {
      closeTour({ markDone: true });
    }
    if (event.key === 'ArrowRight') nextTour();
    if (event.key === 'ArrowLeft') prevTour();
  });
};

export { initTour, openTour, closeTour, nextTour, prevTour, skipTour };
