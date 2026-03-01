import { state, saveState } from '../../core/state.js';
import { renderAll } from '../../core/renderers.js';
import { showToast } from '../../core/ui.js?v=20260301g';

const getCampaignDeleteModal = () => ({
  modal: document.getElementById('campaign-delete-modal'),
  form: document.getElementById('campaign-delete-form'),
  input: document.getElementById('campaign-delete-input'),
  title: document.getElementById('campaign-delete-title'),
  msg: document.getElementById('campaign-delete-msg'),
  confirm: document.getElementById('campaign-delete-confirm')
});

const formatCampaignTitle = (campaign) => {
  const title = String(campaign?.title || '').trim();
  const brand = String(campaign?.brand || '').trim();
  if (title && brand && title.toLowerCase() !== brand.toLowerCase()) return `${title} (${brand})`;
  return title || brand || 'Campanha';
};

const openCampaignDeleteModal = (campaignId) => {
  const { modal, input, title, msg, confirm } = getCampaignDeleteModal();
  if (!modal || !input) return;

  const campaign = (Array.isArray(state.campaigns) ? state.campaigns : []).find((item) => item.id === campaignId);
  if (!campaign) return;

  modal.dataset.campaignId = campaignId;
  if (title) title.textContent = `Campanha: ${formatCampaignTitle(campaign)}`;
  if (msg) msg.textContent = '';
  input.value = '';
  if (confirm) confirm.disabled = true;

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  window.setTimeout(() => input.focus(), 0);
};

const closeCampaignDeleteModal = () => {
  const { modal, input, title, msg, confirm } = getCampaignDeleteModal();
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  modal.dataset.campaignId = '';
  if (input) input.value = '';
  if (title) title.textContent = '';
  if (msg) msg.textContent = '';
  if (confirm) confirm.disabled = true;
};

const handleCampaignDeleteSubmit = (event) => {
  event.preventDefault();
  const { modal, input, msg } = getCampaignDeleteModal();
  if (!modal || !input) return;

  const id = modal.dataset.campaignId;
  if (!id) {
    closeCampaignDeleteModal();
    return;
  }

  const typed = String(input.value || '').trim().toLowerCase();
  if (typed !== 'excluir') {
    if (msg) msg.textContent = 'Digita EXCLUIR pra confirmar.';
    input.focus();
    return;
  }

  state.campaigns = (Array.isArray(state.campaigns) ? state.campaigns : []).filter((item) => item.id !== id);
  (Array.isArray(state.scripts) ? state.scripts : []).forEach((script) => {
    if (script && script.campaignId === id) script.campaignId = null;
  });

  saveState();
  renderAll();
  try {
    document.dispatchEvent(new CustomEvent('ugc:campaigns-changed', { detail: { campaignId: id, reason: 'delete' } }));
  } catch (error) {}
  closeCampaignDeleteModal();
  showToast('Campanha excluída.');
};

const initCampaignDeleteFeature = () => {
  const { form, input, confirm, msg, modal } = getCampaignDeleteModal();
  if (!form || !modal) return;
  if (form.dataset.bound === '1') return;
  form.dataset.bound = '1';

  form.addEventListener('submit', handleCampaignDeleteSubmit);

  if (input && confirm) {
    input.addEventListener('input', () => {
      if (msg) msg.textContent = '';
      confirm.disabled = String(input.value || '').trim().toLowerCase() !== 'excluir';
    });
  }
};

export { initCampaignDeleteFeature, openCampaignDeleteModal, closeCampaignDeleteModal };
