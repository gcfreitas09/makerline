import { state, saveState } from '../../core/state.js';
import { renderAll } from '../../core/renderers.js';
import { showToast } from '../../core/ui.js';
import { trackEvent } from '../../core/gamification.js';

const getBrandModal = () => ({
  modal: document.getElementById('brand-modal'),
  form: document.getElementById('brand-form'),
  msg: document.getElementById('brand-msg'),
  title: document.querySelector('[data-brand-modal-title]')
});

const toggleCustomActionRow = (form) => {
  const typeSelect = form?.querySelector('[name="nextActionType"]');
  const customRow = document.getElementById('brand-next-action-custom-row');
  if (!typeSelect || !customRow) return;
  customRow.style.display = typeSelect.value === 'outro' ? '' : 'none';
};

const openBrandModal = (brandId = '') => {
  const { modal, form, msg, title } = getBrandModal();
  if (!modal || !form) return;

  form.reset();
  form.dataset.brandId = '';
  if (msg) msg.textContent = '';

  const brand = (state.brands || []).find((item) => item.id === brandId) || null;
  if (brand) {
    form.dataset.brandId = brand.id;
    if (title) title.textContent = 'Editar marca';
    form.querySelector('[name="id"]').value = brand.id;
    form.querySelector('[name="name"]').value = brand.name || '';
    form.querySelector('[name="instagram"]').value = brand.instagram || '';
    form.querySelector('[name="email"]').value = brand.email || '';
    form.querySelector('[name="contact"]').value = brand.contact || '';
    form.querySelector('[name="status"]').value = brand.status || 'lead';
    form.querySelector('[name="nextActionType"]').value = brand.nextActionType || '';
    form.querySelector('[name="nextActionCustomType"]').value = brand.nextActionCustomType || '';
    form.querySelector('[name="nextActionDate"]').value = brand.nextActionDate || '';
    form.querySelector('[name="nextActionNote"]').value = brand.nextActionNote || '';
  } else if (title) {
    title.textContent = 'Nova marca';
  }

  toggleCustomActionRow(form);
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  window.setTimeout(() => form.querySelector('[name="name"]')?.focus(), 0);
};

const closeBrandModal = () => {
  const { modal, form, msg } = getBrandModal();
  if (!modal || !form) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  form.reset();
  form.dataset.brandId = '';
  if (msg) msg.textContent = '';
};

const handleBrandSubmit = (event) => {
  event.preventDefault();
  const { form, msg } = getBrandModal();
  if (!form) return;
  if (msg) msg.textContent = '';

  const data = new FormData(form);
  const id = String(data.get('id') || form.dataset.brandId || '').trim();
  const name = String(data.get('name') || '').trim();
  const instagram = String(data.get('instagram') || '').trim();
  const email = String(data.get('email') || '').trim();
  const contact = String(data.get('contact') || '').trim();
  const status = String(data.get('status') || 'lead').trim();
  const nextActionType = String(data.get('nextActionType') || '').trim();
  const nextActionCustomType = String(data.get('nextActionCustomType') || '').trim();
  const nextActionDate = String(data.get('nextActionDate') || '').trim();
  const nextActionNote = String(data.get('nextActionNote') || '').trim().slice(0, 140);

  if (!name) {
    if (msg) msg.textContent = 'Informe o nome da marca.';
    return;
  }
  if (nextActionType && !nextActionDate) {
    if (msg) msg.textContent = 'Defina a data da próxima ação.';
    return;
  }
  if (nextActionType === 'outro' && !nextActionCustomType) {
    if (msg) msg.textContent = 'Descreva o tipo personalizado.';
    return;
  }

  if (id) {
    const brand = state.brands.find((item) => item.id === id);
    if (!brand) {
      if (msg) msg.textContent = 'Não encontrei essa marca.';
      return;
    }
    brand.name = name;
    brand.instagram = instagram;
    brand.email = email;
    brand.contact = contact;
    brand.status = status;
    brand.nextActionType = nextActionType;
    brand.nextActionCustomType = nextActionType === 'outro' ? nextActionCustomType : '';
    brand.nextActionDate = nextActionDate;
    brand.nextActionNote = nextActionNote;

    (state.campaigns || []).forEach((campaign) => {
      if (campaign.brandId === brand.id) campaign.brand = brand.name;
    });

    saveState();
    renderAll();
    closeBrandModal();
    showToast('Marca atualizada.');
    return;
  }

  const brand = {
    id: `b-${Date.now()}`,
    name,
    instagram,
    email,
    contact,
    status,
    nextActionType,
    nextActionCustomType: nextActionType === 'outro' ? nextActionCustomType : '',
    nextActionDate,
    nextActionNote,
    interactions: []
  };

  state.brands.unshift(brand);
  state.ui.selectedBrandId = brand.id;
  trackEvent('brand_created', { brandId: brand.id, brand });
  saveState();
  renderAll();
  closeBrandModal();
  showToast('Marca salva.');
};

const initBrandForm = () => {
  const { form } = getBrandModal();
  if (!form || form.dataset.bound === '1') return;
  form.dataset.bound = '1';
  form.addEventListener('submit', handleBrandSubmit);
  form.querySelector('[name="nextActionType"]')?.addEventListener('change', () => toggleCustomActionRow(form));
};

export { openBrandModal, closeBrandModal, initBrandForm };
