import { state, saveState } from '../../core/state.js';
import { setScriptOutput, showToast } from '../../core/ui.js?v=20260302f';
import { renderAll } from '../../core/renderers.js?v=20260302f';

const getScriptDeleteModal = () => ({
  modal: document.getElementById('script-delete-modal'),
  form: document.getElementById('script-delete-form'),
  title: document.getElementById('script-delete-title'),
  msg: document.getElementById('script-delete-msg'),
  confirm: document.getElementById('script-delete-confirm')
});

const openScriptDeleteModal = (scriptId) => {
  const { modal, title, msg, confirm } = getScriptDeleteModal();
  if (!modal) return;

  const script = state.scripts.find((item) => item.id === scriptId);
  if (!script) return;

  modal.dataset.scriptId = scriptId;
  if (title) title.textContent = `Roteiro: ${script.title || script.brand || 'Roteiro'}`;
  if (msg) msg.textContent = '';
  if (confirm) confirm.disabled = false;

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  if (confirm) window.setTimeout(() => confirm.focus(), 0);
};

const closeScriptDeleteModal = () => {
  const { modal, title, msg, confirm } = getScriptDeleteModal();
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  modal.dataset.scriptId = '';
  if (title) title.textContent = '';
  if (msg) msg.textContent = '';
  if (confirm) confirm.disabled = false;
};

const handleScriptDeleteSubmit = (event) => {
  event.preventDefault();
  const { modal } = getScriptDeleteModal();
  if (!modal) return;

  const id = modal.dataset.scriptId;
  if (!id) {
    closeScriptDeleteModal();
    return;
  }

  state.scripts = state.scripts.filter((item) => item.id !== id);

  if (state.ui.openScript === id) {
    state.ui.openScript = null;
    setScriptOutput('');
  }

  saveState();
  renderAll();
  closeScriptDeleteModal();
  showToast('Roteiro excluído.');
};

const initScriptDeleteFeature = () => {
  const { form, modal } = getScriptDeleteModal();
  if (!form || !modal) return;
  if (form.dataset.bound === '1') return;
  form.dataset.bound = '1';

  form.addEventListener('submit', handleScriptDeleteSubmit);
};

export { initScriptDeleteFeature, openScriptDeleteModal, closeScriptDeleteModal };
