import { state, saveState } from '../../core/state.js';
import { renderAll } from '../../core/renderers.js?v=20260429d';
import { showToast } from '../../core/ui.js?v=20260625b';
import { closeCampaignModal } from './modal.js?v=20260502c';

const getCampaignDeleteModal = () => ({
  modal: document.getElementById('campaign-delete-modal'),
  form: document.getElementById('campaign-delete-form'),
  title: document.getElementById('campaign-delete-title'),
  msg: document.getElementById('campaign-delete-msg'),
  confirm: document.getElementById('campaign-delete-confirm')
});

const formatCampaignTitle = (campaign) => {
  const title = String(campaign.title || '').trim();
  const brand = String(campaign.brand || '').trim();
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

const forceCloseCampaignEditor = () => {
  try {
    closeCampaignModal();
  } catch (error) {}

  const editor = document.getElementById('campaign-modal');
  if (editor) {
    editor.classList.remove('open');
    editor.setAttribute('aria-hidden', 'true');
  }

  const form = document.getElementById('campaign-form');
  if (form) {
    form.reset();
    delete form.dataset.mode;
    delete form.dataset.campaignId;
  }

  const inlineDeleteBtn = document.getElementById('campaign-delete-inline-btn');
  if (inlineDeleteBtn) {
    inlineDeleteBtn.style.display = 'none';
    delete inlineDeleteBtn.dataset.campaignId;
  }
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

  closeCampaignDeleteModal();
  forceCloseCampaignEditor();
  saveState();
  renderAll();
  window.requestAnimationFrame(forceCloseCampaignEditor);
  window.setTimeout(forceCloseCampaignEditor, 0);
  try {
    document.dispatchEvent(new CustomEvent('ugc:campaigns-changed', { detail: { campaignId: id, reason: 'delete' } }));
  } catch (error) {}
  showToast('Campanha excluída.', { duration: 1500 });
};

const initCampaignDeleteFeature = () => {
  const { form, modal } = getCampaignDeleteModal();
  if (!form || !modal) return;
  if (form.dataset.bound === '1') return;
  form.dataset.bound = '1';

  form.addEventListener('submit', handleCampaignDeleteSubmit);
};

export { initCampaignDeleteFeature, openCampaignDeleteModal, closeCampaignDeleteModal };

