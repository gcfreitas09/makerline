<<<<<<< HEAD
﻿import { state, saveState, nextActionOptions } from '../../core/state.js';
import { renderAll } from '../../core/renderers.js?v=20260502c';
import { showToast } from '../../core/ui.js?v=20260502c';
=======
import { state, saveState, nextActionOptions } from '../../core/state.js';
import { renderAll } from '../../core/renderers.js?v=20260318b';
import { showToast } from '../../core/ui.js?v=20260302f';
>>>>>>> 902074b4211073f9129513d97dbf8b86232764f7
import { trackEvent } from '../../core/gamification.js?v=20260302f';

const getBrandModal = () => ({
  modal: document.getElementById('brand-modal'),
  form: document.getElementById('brand-form'),
  msg: document.getElementById('brand-msg'),
  title: document.querySelector('[data-brand-modal-title]'),
  subtitle: document.querySelector('[data-brand-modal-subtitle]'),
  deleteBtn: document.getElementById('brand-delete-inline-btn')
});

const todayIso = () => new Date().toISOString().slice(0, 10);
<<<<<<< HEAD
const BRAND_WIZARD_TOTAL = 4;
let brandWizardEnabled = false;
let brandWizardStep = 1;

const getBrandWizardRefs = () => {
  const { form } = getBrandModal();
  return {
    form,
    steps: form ? Array.from(form.querySelectorAll('[data-brand-step]')) : [],
    progress: form ? form.querySelector('[data-brand-wizard-progress]') : null,
    progressSteps: form ? Array.from(form.querySelectorAll('[data-brand-wizard-progress] .modal-wizard-step')) : [],
    nav: form ? form.querySelector('[data-brand-wizard-actions]') : null,
    submitActions: form ? form.querySelector('[data-brand-submit-actions]') : null,
    nextBtn: document.getElementById('brand-step-next-btn'),
    deleteBtn: document.getElementById('brand-delete-inline-btn')
  };
};

const applyBrandWizardStep = () => {
  const { form, steps, progress, progressSteps, nav, submitActions, nextBtn, deleteBtn } = getBrandWizardRefs();
  if (!form) return;
  const selectedActionType = String(form.querySelector('select[name="nextActionType"]')?.value || '').trim();
  const actionDetailRows = ['nextActionCustomType', 'nextActionDate', 'nextActionNote']
    .map((name) => form.querySelector(`[name="${name}"]`)?.closest('[data-brand-step]'))
    .filter(Boolean);

  steps.forEach((row) => {
    const step = Number(row.dataset.brandStep || 1);
    const hideEmptyActionDetail = brandWizardEnabled && brandWizardStep === 4 && !selectedActionType && actionDetailRows.includes(row);
    row.classList.toggle('modal-step-hidden', (brandWizardEnabled && step !== brandWizardStep) || hideEmptyActionDetail);
  });

  if (progress) progress.style.display = brandWizardEnabled ? '' : 'none';
  if (nav) nav.style.display = brandWizardEnabled ? '' : 'none';
  if (submitActions) submitActions.style.display = !brandWizardEnabled || brandWizardStep >= BRAND_WIZARD_TOTAL ? '' : 'none';

  progressSteps.forEach((item) => {
    const step = Number(item.dataset.step || 0);
    item.classList.toggle('is-active', brandWizardEnabled && step === brandWizardStep);
    item.classList.toggle('is-done', brandWizardEnabled && step < brandWizardStep);
  });

  if (nextBtn) {
    if (!brandWizardEnabled || brandWizardStep >= BRAND_WIZARD_TOTAL) {
      nextBtn.style.display = 'none';
    } else {
      nextBtn.style.display = '';
      nextBtn.textContent = 'Próximo';
      nextBtn.disabled = false;
    }
  }

  if (deleteBtn && brandWizardEnabled) {
    if (brandWizardStep < BRAND_WIZARD_TOTAL) {
      deleteBtn.style.display = 'none';
    } else {
      deleteBtn.style.display = deleteBtn.dataset.brandId ? '' : 'none';
    }
  }
};

const setBrandWizardMode = (mode) => {
  brandWizardEnabled = mode === 'create';
  brandWizardStep = 1;
  applyBrandWizardStep();
};

const setBrandWizardStep = (step) => {
  if (!brandWizardEnabled) return false;
  const next = Math.max(1, Math.min(BRAND_WIZARD_TOTAL, Number(step) || 1));
  brandWizardStep = next;
  applyBrandWizardStep();
  return true;
};

const advanceBrandWizardStep = () => {
  const { form, msg } = getBrandModal();
  if (!form || !brandWizardEnabled) return;

  const nameInput = form.querySelector('input[name="name"]');
  if (brandWizardStep === 1 && !String(nameInput.value || '').trim()) {
    if (msg) msg.textContent = 'Informe o nome da marca para continuar.';
    if (nameInput) nameInput.focus();
    return;
  }

  if (msg) msg.textContent = '';
  setBrandWizardStep(brandWizardStep + 1);
};

const setNextActionCustomVisibility = (form, value) => {
  const row = document.getElementById('brand-next-action-custom-row');
  const input = form.querySelector('input[name="nextActionCustomType"]');
=======

const setNextActionCustomVisibility = (form, value) => {
  const row = document.getElementById('brand-next-action-custom-row');
  const input = form?.querySelector('input[name="nextActionCustomType"]');
>>>>>>> 902074b4211073f9129513d97dbf8b86232764f7
  const show = value === 'outro';
  if (row) row.style.display = show ? '' : 'none';
  if (input) {
    input.required = show;
    if (!show) input.value = '';
  }
};

const populateCampaignBrandSelect = (selectedId = '') => {
  const select = document.querySelector('#campaign-form select[name="brandId"]');
  if (!select) return;

  const brands = (Array.isArray(state.brands) ? state.brands : [])
    .slice()
<<<<<<< HEAD
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));

  select.innerHTML = ['<option value="">Vincular depois...</option>']
=======
    .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'pt-BR'));

  select.innerHTML = ['<option value="">Escolher marca...</option>']
>>>>>>> 902074b4211073f9129513d97dbf8b86232764f7
    .concat(brands.map((brand) => `<option value="${brand.id}">${String(brand.name || 'Marca')}</option>`))
    .join('');

  if (selectedId && brands.some((brand) => brand.id === selectedId)) {
    select.value = selectedId;
  } else if (!select.value && brands.length === 1) {
    select.value = brands[0].id;
  }

  if (typeof window.enableCustomSelects === 'function') {
    try {
      window.enableCustomSelects(select);
    } catch (error) {}
  }
};

const openBrandModal = (brandId = '', options = {}) => {
  const { modal, form, msg, title, subtitle, deleteBtn } = getBrandModal();
  if (!modal || !form) return;

  const brand = (Array.isArray(state.brands) ? state.brands : []).find((item) => item.id === brandId);

  form.reset();
  form.dataset.brandId = brand?.id || '';
<<<<<<< HEAD
  form.dataset.returnTo = options.returnTo || '';
=======
  form.dataset.returnTo = options?.returnTo || '';
>>>>>>> 902074b4211073f9129513d97dbf8b86232764f7
  if (msg) msg.textContent = '';

  const idInput = form.querySelector('input[name="id"]');
  const nameInput = form.querySelector('input[name="name"]');
  const instagramInput = form.querySelector('input[name="instagram"]');
  const emailInput = form.querySelector('input[name="email"]');
  const contactInput = form.querySelector('input[name="contact"]');
  const statusSelect = form.querySelector('select[name="status"]');
  const nextActionTypeSelect = form.querySelector('select[name="nextActionType"]');
  const nextActionCustomInput = form.querySelector('input[name="nextActionCustomType"]');
  const nextActionDateInput = form.querySelector('input[name="nextActionDate"]');
  const nextActionNoteInput = form.querySelector('input[name="nextActionNote"]');

  if (idInput) idInput.value = brand?.id || '';
  if (nameInput) nameInput.value = brand?.name || '';
  if (instagramInput) instagramInput.value = brand?.instagram || '';
  if (emailInput) emailInput.value = brand?.email || '';
  if (contactInput) contactInput.value = brand?.contact || '';
  if (statusSelect) statusSelect.value = brand?.status || 'lead';
  if (nextActionTypeSelect) nextActionTypeSelect.value = brand?.nextActionType || '';
  if (nextActionCustomInput) nextActionCustomInput.value = brand?.nextActionCustomType || '';
  if (nextActionDateInput) nextActionDateInput.value = brand?.nextActionDate || '';
  if (nextActionNoteInput) nextActionNoteInput.value = brand?.nextActionNote || '';
  setNextActionCustomVisibility(form, brand?.nextActionType || '');

  if (title) title.textContent = brand ? 'Editar marca' : 'Nova marca';
  if (subtitle) subtitle.textContent = brand
    ? 'Atualize os dados comerciais e mantenha o histórico organizado.'
    : 'Crie a marca uma vez e use ela em campanhas, follow-ups e histórico.';
  form.querySelectorAll('[data-brand-create-only]').forEach((element) => {
    element.style.display = brand ? 'none' : '';
  });
<<<<<<< HEAD
  setBrandWizardMode(brand ? 'edit' : 'create');
=======
>>>>>>> 902074b4211073f9129513d97dbf8b86232764f7

  if (deleteBtn) {
    if (brand) {
      deleteBtn.style.display = '';
      deleteBtn.dataset.brandId = brand.id;
    } else {
      deleteBtn.style.display = 'none';
      delete deleteBtn.dataset.brandId;
    }
  }

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  if (nameInput) nameInput.focus();
<<<<<<< HEAD

  if (typeof window.enableCustomSelects === 'function') {
    requestAnimationFrame(() => {
      try { window.enableCustomSelects(modal); } catch (e) {}
    });
  }
=======
>>>>>>> 902074b4211073f9129513d97dbf8b86232764f7
};

const closeBrandModal = () => {
  const { modal, form, msg, title, subtitle, deleteBtn } = getBrandModal();
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  if (form) {
    form.reset();
    delete form.dataset.brandId;
    delete form.dataset.returnTo;
  }
  if (msg) msg.textContent = '';
  if (title) title.textContent = 'Nova marca';
  if (subtitle) subtitle.textContent = 'Registre o contato principal e defina o próximo passo comercial.';
  if (deleteBtn) {
    deleteBtn.style.display = 'none';
    delete deleteBtn.dataset.brandId;
  }
  setNextActionCustomVisibility(form, '');
<<<<<<< HEAD
  brandWizardEnabled = false;
  brandWizardStep = 1;
  applyBrandWizardStep();
=======
>>>>>>> 902074b4211073f9129513d97dbf8b86232764f7
};

const syncCampaignsWithBrand = (brand, previousName = '') => {
  const campaigns = Array.isArray(state.campaigns) ? state.campaigns : [];
  campaigns.forEach((campaign) => {
    if (!campaign || typeof campaign !== 'object') return;
    const sameBrandId = String(campaign.brandId || '').trim() === brand.id;
    const sameLegacyName = !campaign.brandId && previousName && String(campaign.brand || '').trim().toLowerCase() === previousName.toLowerCase();
    if (!sameBrandId && !sameLegacyName) return;
    campaign.brandId = brand.id;
    campaign.brand = brand.name;
    if (!campaign.contactName && brand.contact) campaign.contactName = brand.contact;
    if (!campaign.contactEmail && brand.email) campaign.contactEmail = brand.email;
    campaign.updatedAt = new Date().toISOString();
  });
};

const handleBrandSubmit = (event) => {
  event.preventDefault();
  const { form, msg } = getBrandModal();
  if (!form) return;
  if (msg) msg.textContent = '';

  const data = new FormData(form);
  const id = String(data.get('id') || '').trim();
  const name = String(data.get('name') || '').trim().slice(0, 80);
  const instagram = String(data.get('instagram') || '').trim().replace(/^@+/, '@').slice(0, 120);
  const email = String(data.get('email') || '').trim().slice(0, 160);
  const contact = String(data.get('contact') || '').trim().slice(0, 80);
  const status = String(data.get('status') || 'lead').trim();
  const nextActionTypeRaw = String(data.get('nextActionType') || '').trim();
  const nextActionType = nextActionOptions.includes(nextActionTypeRaw) ? nextActionTypeRaw : '';
  const nextActionCustomType = String(data.get('nextActionCustomType') || '').trim().slice(0, 80);
  const nextActionDate = String(data.get('nextActionDate') || '').trim();
  const nextActionNote = String(data.get('nextActionNote') || '').trim().slice(0, 140);

  if (!name) {
    if (msg) msg.textContent = 'Informe o nome da marca.';
    return;
  }
  if (email && !email.includes('@')) {
<<<<<<< HEAD
    if (msg) msg.textContent = 'Informe um e-mail válido ou deixe em branco.';
=======
    if (msg) msg.textContent = 'Informe um email válido ou deixe em branco.';
>>>>>>> 902074b4211073f9129513d97dbf8b86232764f7
    return;
  }
  if (nextActionType && !nextActionDate) {
    if (msg) msg.textContent = 'Defina a data da próxima ação.';
    return;
  }
  if (nextActionType === 'outro' && !nextActionCustomType) {
    if (msg) msg.textContent = 'Descreva o tipo personalizado da próxima ação.';
    return;
  }

  const duplicate = (Array.isArray(state.brands) ? state.brands : []).find((brand) => {
    if (!brand || typeof brand !== 'object') return false;
    if (id && brand.id === id) return false;
    return String(brand.name || '').trim().toLowerCase() === name.toLowerCase();
  });

  if (duplicate) {
    if (msg) msg.textContent = 'Já existe uma marca com esse nome.';
    return;
  }

  const nowIso = new Date().toISOString();
  const returnTo = form.dataset.returnTo || '';
  let brand = null;
  let reason = 'create';
  let previousName = '';

  if (id) {
    brand = (Array.isArray(state.brands) ? state.brands : []).find((item) => item.id === id);
    if (!brand) {
      if (msg) msg.textContent = 'Não encontrei essa marca. Tente de novo.';
      return;
    }
    reason = 'update';
    previousName = String(brand.name || '').trim();
  } else {
    brand = {
      id: `b-${Date.now()}`,
      interactions: [],
      createdAt: nowIso
    };
    state.brands.unshift(brand);
  }

  brand.name = name;
  brand.instagram = instagram;
  brand.email = email;
  brand.contact = contact;
  brand.status = ['lead', 'negociando', 'cliente_ativo', 'cliente_recorrente', 'inativa', 'perdida'].includes(status) ? status : 'lead';
  brand.nextActionType = nextActionType;
  brand.nextActionCustomType = nextActionType === 'outro' ? nextActionCustomType : '';
  brand.nextActionDate = nextActionType ? nextActionDate : '';
  brand.nextActionNote = nextActionType ? nextActionNote : '';
  brand.updatedAt = nowIso;
  if (!Array.isArray(brand.interactions)) brand.interactions = [];

  syncCampaignsWithBrand(brand, previousName);

  state.ui.selectedBrandId = brand.id;
  if (returnTo === 'campaign') {
    state.ui.pendingCampaignBrandId = brand.id;
  }

  saveState();
<<<<<<< HEAD
  closeBrandModal();
=======
>>>>>>> 902074b4211073f9129513d97dbf8b86232764f7
  renderAll();
  populateCampaignBrandSelect(brand.id);

  try {
    document.dispatchEvent(new CustomEvent('ugc:brands-changed', { detail: { brandId: brand.id, reason } }));
  } catch (error) {}

  if (reason === 'create') {
    trackEvent('brand_created', { brandId: brand.id, brand });
  } else {
    trackEvent('brand_updated', { brandId: brand.id, brand });
  }

<<<<<<< HEAD
=======
  closeBrandModal();
>>>>>>> 902074b4211073f9129513d97dbf8b86232764f7
  showToast(reason === 'create' ? 'Marca salva.' : 'Marca atualizada.');

  const campaignBrandSelect = document.querySelector('#campaign-form select[name="brandId"]');
  const campaignModal = document.getElementById('campaign-modal');
  const isCampaignOpen = Boolean(campaignModal && campaignModal.classList.contains('open'));
  if (campaignBrandSelect && returnTo === 'campaign') {
    campaignBrandSelect.value = brand.id;
    campaignBrandSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }
  if (returnTo === 'campaign' && !isCampaignOpen) {
    window.setTimeout(() => {
<<<<<<< HEAD
      if (window.__ugcModals.openCampaignModal) {
=======
      if (window.__ugcModals?.openCampaignModal) {
>>>>>>> 902074b4211073f9129513d97dbf8b86232764f7
        window.__ugcModals.openCampaignModal();
      }
    }, 80);
  }
};

const initBrandForm = () => {
  const { form } = getBrandModal();
  if (!form) return;
  if (form.dataset.bound === '1') return;
  form.dataset.bound = '1';

  form.addEventListener('submit', handleBrandSubmit);

  const typeSelect = form.querySelector('select[name="nextActionType"]');
  if (typeSelect) {
    typeSelect.addEventListener('change', () => {
      setNextActionCustomVisibility(form, typeSelect.value);
<<<<<<< HEAD
      applyBrandWizardStep();
    });
  }

  const nextStepBtn = document.getElementById('brand-step-next-btn');
  if (nextStepBtn && nextStepBtn.dataset.bound !== '1') {
    nextStepBtn.dataset.bound = '1';
    nextStepBtn.addEventListener('click', () => {
      advanceBrandWizardStep();
=======
>>>>>>> 902074b4211073f9129513d97dbf8b86232764f7
    });
  }

  try {
    document.addEventListener('ugc:brands-changed', () => {
      const selected = state.ui.pendingCampaignBrandId || '';
      populateCampaignBrandSelect(selected);
    });
  } catch (error) {}
};

export { openBrandModal, closeBrandModal, initBrandForm, populateCampaignBrandSelect };
