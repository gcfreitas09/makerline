import { state, saveState } from '../../core/state.js';
import { renderAll } from '../../core/renderers.js?v=20260302f';
import { showToast } from '../../core/ui.js?v=20260302f';

const getBrandDeleteModal = () => ({
  modal: document.getElementById('brand-delete-modal'),
  form: document.getElementById('brand-delete-form'),
  title: document.getElementById('brand-delete-title'),
  msg: document.getElementById('brand-delete-msg'),
  confirm: document.getElementById('brand-delete-confirm')
});

const openBrandDeleteModal = (brandId) => {
  const { modal, title, msg, confirm } = getBrandDeleteModal();
  if (!modal) return;

  const brand = (Array.isArray(state.brands) ? state.brands : []).find((item) => item.id === brandId);
  if (!brand) return;

  modal.dataset.brandId = brandId;
  if (title) title.textContent = `Marca: ${brand.name || 'Marca'}`;
  if (msg) msg.textContent = '';
  if (confirm) confirm.disabled = false;

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  if (confirm) window.setTimeout(() => confirm.focus(), 0);
};

const closeBrandDeleteModal = () => {
  const { modal, title, msg, confirm } = getBrandDeleteModal();
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  modal.dataset.brandId = '';
  if (title) title.textContent = '';
  if (msg) msg.textContent = '';
  if (confirm) confirm.disabled = false;
};

const handleBrandDeleteSubmit = (event) => {
  event.preventDefault();
  const { modal, msg } = getBrandDeleteModal();
  if (!modal) return;

  const id = modal.dataset.brandId;
  if (!id) {
    closeBrandDeleteModal();
    return;
  }

  const linkedCampaigns = (Array.isArray(state.campaigns) ? state.campaigns : []).filter((campaign) => {
    if (!campaign || typeof campaign !== 'object') return false;
    if (String(campaign.brandId || '').trim()) return String(campaign.brandId || '').trim() === id;
    const brand = (Array.isArray(state.brands) ? state.brands : []).find((item) => item.id === id);
    return Boolean(brand && String(campaign.brand || '').trim().toLowerCase() === String(brand.name || '').trim().toLowerCase());
  });

  if (linkedCampaigns.length) {
    if (msg) msg.textContent = `Essa marca ainda tem ${linkedCampaigns.length} campanha(s) vinculada(s). Reatribua ou exclua essas campanhas antes.`;
    return;
  }

  state.brands = (Array.isArray(state.brands) ? state.brands : []).filter((item) => item.id !== id);

  if (state.ui?.brandComposer?.brandId === id) {
    state.ui.brandComposer.brandId = null;
    state.ui.brandComposer.text = '';
    state.ui.brandComposer.lastBrandId = null;
    state.ui.brandComposer.lastType = null;
  }
  if (state.ui?.selectedBrandId === id) {
    state.ui.selectedBrandId = null;
  }
  if (state.ui?.pendingCampaignBrandId === id) {
    state.ui.pendingCampaignBrandId = null;
  }

  saveState();
  renderAll();
  closeBrandDeleteModal();
  showToast('Marca excluída.');
};

const initBrandDeleteFeature = () => {
  const { form, modal } = getBrandDeleteModal();
  if (!form || !modal) return;
  if (form.dataset.bound === '1') return;
  form.dataset.bound = '1';

  form.addEventListener('submit', handleBrandDeleteSubmit);
};

export { initBrandDeleteFeature, openBrandDeleteModal, closeBrandDeleteModal };
