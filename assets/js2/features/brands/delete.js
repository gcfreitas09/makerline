import { state, saveState } from '../../core/state.js';
import { renderAll } from '../../core/renderers.js?v=20260302f';
import { showToast } from '../../core/ui.js?v=20260302f';

const getBrandDeleteModal = () => ({
  modal: document.getElementById('brand-delete-modal'),
  form: document.getElementById('brand-delete-form'),
  input: document.getElementById('brand-delete-input'),
  title: document.getElementById('brand-delete-title'),
  msg: document.getElementById('brand-delete-msg'),
  confirm: document.getElementById('brand-delete-confirm')
});

const openBrandDeleteModal = (brandId) => {
  const { modal, input, title, msg, confirm } = getBrandDeleteModal();
  if (!modal || !input) return;

  const brand = (Array.isArray(state.brands) ? state.brands : []).find((item) => item.id === brandId);
  if (!brand) return;

  modal.dataset.brandId = brandId;
  if (title) title.textContent = `Marca: ${brand.name || 'Marca'}`;
  if (msg) msg.textContent = '';
  input.value = '';
  if (confirm) confirm.disabled = true;

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  window.setTimeout(() => input.focus(), 0);
};

const closeBrandDeleteModal = () => {
  const { modal, input, title, msg, confirm } = getBrandDeleteModal();
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  modal.dataset.brandId = '';
  if (input) input.value = '';
  if (title) title.textContent = '';
  if (msg) msg.textContent = '';
  if (confirm) confirm.disabled = true;
};

const handleBrandDeleteSubmit = (event) => {
  event.preventDefault();
  const { modal, input, msg } = getBrandDeleteModal();
  if (!modal || !input) return;

  const id = modal.dataset.brandId;
  if (!id) {
    closeBrandDeleteModal();
    return;
  }

  const typed = String(input.value || '').trim().toLowerCase();
  if (typed !== 'excluir') {
    if (msg) msg.textContent = 'Digita EXCLUIR pra confirmar.';
    input.focus();
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
    input.focus();
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
  const { form, input, confirm, msg, modal } = getBrandDeleteModal();
  if (!form || !modal) return;
  if (form.dataset.bound === '1') return;
  form.dataset.bound = '1';

  form.addEventListener('submit', handleBrandDeleteSubmit);

  if (input && confirm) {
    input.addEventListener('input', () => {
      if (msg) msg.textContent = '';
      confirm.disabled = String(input.value || '').trim().toLowerCase() !== 'excluir';
    });
  }
};

export { initBrandDeleteFeature, openBrandDeleteModal, closeBrandDeleteModal };
