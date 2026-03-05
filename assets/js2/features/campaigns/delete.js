import { state, saveState } from '../../core/state.js';
import { renderAll } from '../../core/renderers.js?v=20260302f';
import { showToast } from '../../core/ui.js?v=20260302f';

const getCampaignDeleteModal = () => ({
  modal: document.getElementById('campaign-delete-modal'),
  form: document.getElementById('campaign-delete-form'),
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
  const { modal, title, msg, confirm } = getCampaignDeleteModal();
  if (!modal) return;

  const campaign = (Array.isArray(state.campaigns) ? state.campaigns : []).find((item) => item.id === campaignId);
  if (!campaign) return;

  modal.dataset.campaignId = campaignId;
  if (title) title.textContent = `Campanha: ${formatCampaignTitle(campaign)}`;
  if (msg) msg.textContent = '';
  if (confirm) confirm.disabled = false;

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  if (confirm) window.setTimeout(() => confirm.focus(), 0);
};

const closeCampaignDeleteModal = () => {
  const { modal, title, msg, confirm } = getCampaignDeleteModal();
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  modal.dataset.campaignId = '';
  if (title) title.textContent = '';
  if (msg) msg.textContent = '';
  if (confirm) confirm.disabled = false;
};

const handleCampaignDeleteSubmit = (event) => {
  event.preventDefault();
  const { modal } = getCampaignDeleteModal();
  if (!modal) return;

  const id = modal.dataset.campaignId;
  if (!id) {
    closeCampaignDeleteModal();
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
  const { form, modal } = getCampaignDeleteModal();
  if (!form || !modal) return;
  if (form.dataset.bound === '1') return;
  form.dataset.bound = '1';

  form.addEventListener('submit', handleCampaignDeleteSubmit);
};

export { initCampaignDeleteFeature, openCampaignDeleteModal, closeCampaignDeleteModal };
