import { state } from '../../core/state.js';
import { renderAll } from '../../core/renderers.js';
import { showToast } from '../../core/ui.js?v=20260301g';
import { ensureWeeklyFocus, progressWeeklyFocus } from '../../core/gamification.js?v=20260301g';

const getFocusModal = () => ({
  modal: document.getElementById('focus-modal'),
  label: document.querySelector('[data-focus-modal-label]'),
  current: document.querySelector('[data-focus-modal-current]'),
  target: document.querySelector('[data-focus-modal-target]'),
  xp: document.querySelector('[data-focus-modal-xp]'),
  bar: document.querySelector('[data-focus-modal-bar]'),
  msg: document.getElementById('focus-modal-msg')
});

const calcProgress = () => {
  const current = Number.isFinite(state.focus?.current) ? state.focus.current : 0;
  const target = Number.isFinite(state.focus?.target) ? state.focus.target : 0;
  if (!target) return 0;
  return Math.min(Math.max(current / target, 0), 1);
};

const openFocusModal = () => {
  ensureWeeklyFocus();
  const { modal, label, current, target, xp, bar, msg } = getFocusModal();
  if (!modal) return;

  if (label) label.textContent = state.focus?.label || 'Foco';
  if (current) current.textContent = String(state.focus?.current ?? 0);
  if (target) target.textContent = String(state.focus?.target ?? 0);
  if (xp) xp.textContent = String(state.focus?.xp ?? 0);
  if (bar) bar.style.width = `${calcProgress() * 100}%`;
  if (msg) msg.textContent = '';

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
};

const closeFocusModal = () => {
  const { modal, msg } = getFocusModal();
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  if (msg) msg.textContent = '';
};

const confirmFocusModal = () => {
  const { msg, modal } = getFocusModal();
  if (!modal) return;

  const result = progressWeeklyFocus();
  if (!result || !result.ok) {
    if (msg) msg.textContent = 'Nao consegui marcar agora. Tenta de novo.';
    return;
  }

  renderAll();
  closeFocusModal();

  if (!result.completed) {
    showToast(`Boa! ${state.focus.current}/${state.focus.target} no foco.`);
  }
};

export { openFocusModal, closeFocusModal, confirmFocusModal };
