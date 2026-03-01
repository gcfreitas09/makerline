<<<<<<< Updated upstream
import { state, saveState, campaignStatusOrder, getCampaignStageOptions, getDefaultCampaignStage, statusLabels, getCampaignStageLabel, getNextActionLabel } from './state.js';
import { setActivePage, showToast } from './ui.js';
import { trackEvent } from './gamification.js';
import { renderAll } from './renderers.js';
=======
﻿import { state, saveState, campaignStatusOrder, getCampaignStageOptions, getDefaultCampaignStage, statusLabels, nextActionOptions, appendCampaignHistory as appendCampaignHistoryEntry } from './state.js';
import { setActivePage, showToast } from './ui.js?v=20260301h';
import { trackEvent } from './gamification.js?v=20260301h';
import { renderAll } from './renderers.js?v=20260301p';
>>>>>>> Stashed changes

import {
  closeCampaignModal,
  initCampaignForm,
  openCampaignModal
} from '../features/campaigns/modal.js';
import {
  closeBrandModal,
  initBrandForm,
  openBrandModal
} from '../features/brands/modal.js';
import {
  closeBrandDeleteModal,
  initBrandDeleteFeature,
  openBrandDeleteModal
} from '../features/brands/delete.js';
import {
  closeCampaignDeleteModal,
  initCampaignDeleteFeature,
  openCampaignDeleteModal
} from '../features/campaigns/delete.js';
import { initScriptFlow } from '../features/scripts/flow.js';
import {
  closeScriptDeleteModal,
  initScriptDeleteFeature,
  openScriptDeleteModal
} from '../features/scripts/delete.js';
import { copyCurrentScript, copyScriptFromHistory, openScriptFromHistory } from '../features/scripts/history.js';
import { closeFocusModal, confirmFocusModal, openFocusModal } from '../features/focus/modal.js';
import { initAccountForm } from '../features/settings/account.js';
import { initAdminTrackerCard } from '../features/settings/admin_tracker.js?v=20260217b';
import { clearCampaignAlertsCache, runCampaignAlerts } from '../features/settings/alerts.js';
import { closeBrandModal, initBrandForm, openBrandModal } from '../features/brands/modal.js';
import { closeBrandDeleteModal, initBrandDeleteFeature, openBrandDeleteModal } from '../features/brands/delete.js';
import { handleQuizAction, injectOnboardingHeader, convertModelToReal, ensureOnboardingQuiz } from '../features/onboarding/quiz.js';

/* â”€â”€ Money mask helper â”€â”€ */
const formatMoneyInput = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  const value = parseInt(digits, 10) || 0;
  const formatted = value.toString().replace(/\B(?=(?:\d{3})+(?!\d))/g, '.');
  return `R$ ${formatted}`;
};

const applyMoneyMask = (input) => {
  input.value = formatMoneyInput(input.value);
};

<<<<<<< Updated upstream
// Campanhas voltaram ao fluxo antigo. Esses stubs mantêm a inicialização segura
// caso ainda exista código residual tentando acessar os modais removidos.
const getCampaignStepModal = () => ({ modal: null, form: null, current: null, msg: null });
const getCampaignContractModal = () => ({ modal: null, form: null, msg: null });
const getCampaignHistoryModal = () => ({ modal: null, body: null });
=======
const todayIso = () => new Date().toISOString().slice(0, 10);

const getBrandActionModal = () => ({
  modal: document.getElementById('brand-action-modal'),
  form: document.getElementById('brand-action-form'),
  msg: document.getElementById('brand-action-msg'),
  title: document.querySelector('[data-brand-action-title]')
});

const setBrandActionCustomVisibility = (value) => {
  const row = document.getElementById('brand-action-custom-row');
  const input = document.querySelector('#brand-action-form input[name="nextActionCustomType"]');
  const show = value === 'outro';
  if (row) row.style.display = show ? '' : 'none';
  if (input) {
    input.required = show;
    if (!show) input.value = '';
  }
};

const populateBrandActionSelect = (selectedId = '') => {
  const { form } = getBrandActionModal();
  if (!form) return;
  const select = form.querySelector('select[name="brandIdSelect"]');
  if (!select) return;
  const brands = (Array.isArray(state.brands) ? state.brands : []).slice().sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'pt-BR'));
  select.innerHTML = ['<option value="">Escolher...</option>']
    .concat(brands.map((brand) => `<option value="${brand.id}">${String(brand.name || 'Marca')}</option>`))
    .join('');
  select.value = brands.some((brand) => brand.id === selectedId) ? selectedId : '';
};

const openBrandActionModal = (brandId = '') => {
  const { modal, form, msg, title } = getBrandActionModal();
  if (!modal || !form) return;
  const brand = (Array.isArray(state.brands) ? state.brands : []).find((item) => item.id === brandId);

  form.reset();
  if (msg) msg.textContent = '';
  populateBrandActionSelect(brand?.id || '');

  const hiddenIdInput = form.querySelector('input[name="brandId"]');
  const select = form.querySelector('select[name="brandIdSelect"]');
  const typeSelect = form.querySelector('select[name="nextActionType"]');
  const customInput = form.querySelector('input[name="nextActionCustomType"]');
  const dateInput = form.querySelector('input[name="nextActionDate"]');
  const noteInput = form.querySelector('input[name="nextActionNote"]');

  if (hiddenIdInput) hiddenIdInput.value = brand?.id || '';
  if (select) select.value = brand?.id || '';
  if (typeSelect) typeSelect.value = brand?.nextActionType || '';
  if (customInput) customInput.value = brand?.nextActionCustomType || '';
  if (dateInput) dateInput.value = brand?.nextActionDate || '';
  if (noteInput) noteInput.value = brand?.nextActionNote || '';
  setBrandActionCustomVisibility(brand?.nextActionType || '');

  if (title) title.textContent = brand?.nextActionType ? 'Editar aÃ§Ã£o de marca' : 'Nova aÃ§Ã£o de marca';
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  if (select) select.focus();
};

const closeBrandActionModal = () => {
  const { modal, form, msg, title } = getBrandActionModal();
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  if (form) form.reset();
  if (msg) msg.textContent = '';
  if (title) title.textContent = 'Nova aÃ§Ã£o de marca';
  setBrandActionCustomVisibility('');
};

const handleBrandActionSubmit = (event) => {
  event.preventDefault();
  const { form, msg } = getBrandActionModal();
  if (!form) return;

  const data = new FormData(form);
  const brandId = String(data.get('brandIdSelect') || data.get('brandId') || '').trim();
  const nextActionTypeRaw = String(data.get('nextActionType') || '').trim();
  const nextActionType = nextActionOptions.includes(nextActionTypeRaw) ? nextActionTypeRaw : '';
  const nextActionCustomType = String(data.get('nextActionCustomType') || '').trim().slice(0, 80);
  const nextActionDate = String(data.get('nextActionDate') || '').trim();
  const nextActionNote = String(data.get('nextActionNote') || '').trim().slice(0, 140);
  const brand = (Array.isArray(state.brands) ? state.brands : []).find((item) => item.id === brandId);

  if (msg) msg.textContent = '';
  if (!brand) {
    if (msg) msg.textContent = 'Escolha uma marca vÃ¡lida.';
    return;
  }
  if (!nextActionType) {
    if (msg) msg.textContent = 'Escolha a prÃ³xima aÃ§Ã£o.';
    return;
  }
  if (!nextActionDate) {
    if (msg) msg.textContent = 'Defina a data da aÃ§Ã£o.';
    return;
  }
  if (nextActionType === 'outro' && !nextActionCustomType) {
    if (msg) msg.textContent = 'Descreva o tipo personalizado.';
    return;
  }

  brand.nextActionType = nextActionType;
  brand.nextActionCustomType = nextActionType === 'outro' ? nextActionCustomType : '';
  brand.nextActionDate = nextActionDate;
  brand.nextActionNote = nextActionNote;

  saveState();
  renderAll();
  closeBrandActionModal();
  showToast('AÃ§Ã£o da marca salva.');
};
>>>>>>> Stashed changes

/* Posi\u00e7\u00e3o global de (status, stage) no pipeline.
   Total: 15 posi\u00e7\u00f5es, 14 transi\u00e7\u00f5es â†’ 100 XP para pipeline completo. */
const getGlobalStagePos = (status, stage) => {
  let pos = 0;
  for (const s of campaignStatusOrder) {
    const stages = getCampaignStageOptions(s);
    if (s === status) {
      const idx = stages.findIndex(opt => opt.id === stage);
      return pos + Math.max(0, idx);
    }
    pos += stages.length;
  }
  return pos;
};
const TOTAL_TRANSITIONS = 14;

const copyText = (text, doneMessage) => {
  const value = String(text || '').trim();
  if (!value) return;

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(value).then(() => showToast(doneMessage));
    return;
  }

  const temp = document.createElement('textarea');
  temp.value = value;
  document.body.appendChild(temp);
  temp.select();
  document.execCommand('copy');
  document.body.removeChild(temp);
  showToast(doneMessage);
};

<<<<<<< Updated upstream
const getBrandActionModal = () => ({
  modal: document.getElementById('brand-action-modal'),
  form: document.getElementById('brand-action-form'),
  msg: document.getElementById('brand-action-msg')
});

const toggleModal = (modal, isOpen) => {
  if (!modal) return;
  modal.classList.toggle('open', isOpen);
  modal.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
};

const appendCampaignHistory = (campaign, entry) => {
  if (!campaign || !entry) return;
  campaign.history = Array.isArray(campaign.history) ? campaign.history : [];
  campaign.history.unshift({
    id: `ch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: new Date().toISOString(),
    ...entry
  });
};

const populateBrandActionOptions = (selectEl, selectedId = '') => {
  if (!selectEl) return;
  const brands = Array.isArray(state.brands) ? state.brands : [];
  selectEl.innerHTML = ['<option value="">Escolher marca...</option>', ...brands.map((brand) => `<option value="${brand.id}">${brand.name}</option>`)].join('');
  selectEl.value = selectedId || '';
};

const openBrandActionModal = (brandId = '') => {
  const { modal, form, msg } = getBrandActionModal();
  if (!modal || !form) return;
  form.reset();
  if (msg) msg.textContent = '';
  const brand = (state.brands || []).find((item) => item.id === brandId) || null;
  const brandSelect = form.querySelector('[name="brandId"]');
  populateBrandActionOptions(brandSelect, brand?.id || state.ui.selectedBrandId || '');
  if (brand) {
    form.querySelector('[name="nextActionType"]').value = brand.nextActionType || '';
    form.querySelector('[name="nextActionCustomType"]').value = brand.nextActionCustomType || '';
    form.querySelector('[name="nextActionDate"]').value = brand.nextActionDate || '';
    form.querySelector('[name="nextActionNote"]').value = brand.nextActionNote || '';
  }
  const typeSelect = form.querySelector('[name="nextActionType"]');
  const customRow = document.getElementById('brand-action-custom-row');
  if (customRow) customRow.style.display = typeSelect?.value === 'outro' ? '' : 'none';
  toggleModal(modal, true);
};

const closeBrandActionModal = () => {
  const { modal, form, msg } = getBrandActionModal();
  toggleModal(modal, false);
  if (form) form.reset();
  if (msg) msg.textContent = '';
};

const openCampaignStepModal = (campaignId) => {
  const { modal, form, current, msg } = getCampaignStepModal();
  const campaign = (state.campaigns || []).find((item) => item.id === campaignId);
  if (!modal || !form || !campaign) return;
  form.reset();
  form.querySelector('[name="campaignId"]').value = campaign.id;
  form.querySelector('[name="nextActionType"]').value = campaign.nextActionType || '';
  form.querySelector('[name="nextActionCustomType"]').value = campaign.nextActionCustomType || '';
  form.querySelector('[name="nextActionDate"]').value = campaign.nextActionDate || '';
  form.querySelector('[name="nextActionNote"]').value = campaign.nextActionNote || '';
  if (msg) msg.textContent = '';
  const customRow = document.getElementById('campaign-step-custom-row');
  if (customRow) customRow.style.display = form.querySelector('[name="nextActionType"]').value === 'outro' ? '' : 'none';
  if (current) {
    current.innerHTML = `
      <div class="card">
        <div class="dashboard-eyebrow">Ação atual</div>
        <strong>${campaign.nextActionType ? getNextActionLabel(campaign.nextActionType, campaign.nextActionCustomType) : 'Sem ação definida'}</strong>
        <p class="muted">${campaign.nextActionDate ? `Data ${campaign.nextActionDate}` : 'Defina a próxima ação e avance a etapa quando necessário.'}</p>
      </div>
    `;
  }
  toggleModal(modal, true);
};

const closeCampaignStepModal = () => {
  const { modal, form, msg } = getCampaignStepModal();
  toggleModal(modal, false);
  if (form) form.reset();
  if (msg) msg.textContent = '';
};

const openCampaignContractModal = (campaignId) => {
  const { modal, form, msg } = getCampaignContractModal();
  const campaign = (state.campaigns || []).find((item) => item.id === campaignId);
  if (!modal || !form || !campaign) return;
  const contract = campaign.contract || {};
  form.reset();
  form.querySelector('[name="campaignId"]').value = campaign.id;
  form.querySelector('[name="usageRights"]').value = contract.usageRights || '';
  form.querySelector('[name="usagePeriod"]').value = contract.usagePeriod || '';
  form.querySelector('[name="advanceAmount"]').value = formatMoneyInput(contract.advanceAmount || '');
  form.querySelector('[name="productSent"]').value = contract.productSent ? '1' : '0';
  form.querySelector('[name="productReceivedAt"]').value = contract.productReceivedAt || '';
  form.querySelector('[name="invoiceRequired"]').value = contract.invoiceRequired ? '1' : '0';
  form.querySelector('[name="paymentExpectedAt"]').value = contract.paymentExpectedAt || campaign.paymentDate || '';
  if (msg) msg.textContent = '';
  toggleModal(modal, true);
};

const closeCampaignContractModal = () => {
  const { modal, form, msg } = getCampaignContractModal();
  toggleModal(modal, false);
  if (form) form.reset();
  if (msg) msg.textContent = '';
};

const openCampaignHistoryModal = (campaignId) => {
  const { modal, body } = getCampaignHistoryModal();
  const campaign = (state.campaigns || []).find((item) => item.id === campaignId);
  if (!modal || !body || !campaign) return;
  const history = Array.isArray(campaign.history) ? campaign.history : [];
  body.innerHTML = history.length
    ? `<div class="timeline">${history
        .map(
          (entry) => `
            <div class="timeline-item">
              <strong>${entry.title || entry.type}</strong>
              <div class="muted">${entry.note || ''}</div>
              <div class="muted">${String(entry.date || '').slice(0, 10)}</div>
            </div>
          `
        )
        .join('')}</div>`
    : '<p class="muted">Sem histórico registrado ainda.</p>';
  toggleModal(modal, true);
};

const closeCampaignHistoryModal = () => {
  const { modal, body } = getCampaignHistoryModal();
  toggleModal(modal, false);
  if (body) body.innerHTML = '';
=======
const handleBrandInteractionSubmit = (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.id !== 'brand-interaction-form') return;

  event.preventDefault();

  const data = new FormData(form);
  const brandId = String(data.get('brandId') || '').trim();
  const type = String(data.get('type') || 'dm').trim();
  const date = String(data.get('date') || '').trim();
  const note = String(data.get('note') || '').trim().slice(0, 140);
  const brand = (Array.isArray(state.brands) ? state.brands : []).find((item) => item.id === brandId);

  if (!brand) {
    showToast('Marca nÃ£o encontrada.');
    return;
  }
  if (!date) {
    showToast('Defina a data da interaÃ§Ã£o.');
    return;
  }
  if (!['dm', 'email', 'call'].includes(type)) {
    showToast('Escolha um tipo vÃ¡lido de interaÃ§Ã£o.');
    return;
  }

  if (!Array.isArray(brand.interactions)) brand.interactions = [];
  brand.interactions.unshift({
    id: `bi-${Date.now()}`,
    type,
    date,
    note,
    createdAt: new Date().toISOString()
  });
  brand.updatedAt = new Date().toISOString();

  saveState();
  renderAll();
  showToast('InteraÃ§Ã£o registrada.');
>>>>>>> Stashed changes
};

const handleActionClick = (event) => {
  const actionEl = event.target.closest('[data-action]');
  if (!actionEl) return;

  const action = actionEl.dataset.action;

  // Quiz / onboarding actions
  if (handleQuizAction(action, actionEl)) return;

  if (action === 'logout') {
    try {
      ['ugcQuestLoggedIn', 'ugcQuestToken', 'ugcQuestUserId', 'ugcQuestUserEmail', 'ugcQuestUserName'].forEach((k) =>
        sessionStorage.removeItem(k)
      );
    } catch (e) {}
    try {
      [
        'ugcQuestSessionLoggedIn',
        'ugcQuestSessionToken',
        'ugcQuestSessionUserId',
        'ugcQuestSessionUserEmail',
        'ugcQuestSessionUserName'
      ].forEach((k) => localStorage.removeItem(k));
    } catch (e) {}
    window.location.replace('index.html');
    return;
  }

  if (action === 'toggle-menu') {
    document.body.classList.toggle('sidebar-open');
    return;
  }

  if (action === 'close-menu') {
    document.body.classList.remove('sidebar-open');
    return;
  }

  if (action === 'goto-scripts') {
<<<<<<< Updated upstream
=======
    setActivePage('campaigns');
    return;
  }

  if (action === 'goto-metrics' || action === 'goto-performance') {
    setActivePage('dashboard');
    return;
  }

  if (action === 'goto-performance-financial') {
    setActivePage('dashboard');
    return;
  }

  if (action === 'goto-campaigns') {
    state.ui.campaignDashboardFilter = '';
    state.ui.campaignFilter = 'all';
    saveState();
>>>>>>> Stashed changes
    setActivePage('campaigns');
    renderAll();
    return;
  }

  if (action === 'open-dashboard-pipeline-filter') {
    const pipelineFilter = String(actionEl.dataset.pipelineFilter || '').trim();
    const statusByPipelineFilter = {
      negociacao: 'prospeccao',
      producao: 'producao',
      aprovacao: 'producao',
      concluidas: 'concluida'
    };
    if (!pipelineFilter) return;
    state.ui.campaignDashboardFilter = pipelineFilter;
    state.ui.campaignFilter = statusByPipelineFilter[pipelineFilter] || 'all';
    saveState();
    setActivePage('campaigns');
    renderAll();
    return;
  }

  if (action === 'clear-dashboard-campaign-filter') {
    state.ui.campaignDashboardFilter = '';
    state.ui.campaignFilter = 'all';
    saveState();
    renderAll();
    return;
  }

  if (action === 'open-brand-modal') {
    const brandId = String(actionEl.dataset.brandId || '').trim();
    const returnTo = actionEl.dataset.brandModalContext === 'campaign' ? 'campaign' : '';
    openBrandModal(brandId, { returnTo });
    return;
  }

  if (action === 'edit-brand') {
    const brandId = String(actionEl.dataset.brandId || '').trim();
    if (!brandId) return;
    openBrandModal(brandId);
    return;
  }

  if (action === 'close-brand-modal') {
    closeBrandModal();
    return;
  }

  if (action === 'delete-brand') {
    const brandId = String(actionEl.dataset.brandId || '').trim();
    if (!brandId) return;
    if (actionEl.closest('#brand-modal')) {
      closeBrandModal();
    }
    openBrandDeleteModal(brandId);
    return;
  }

  if (action === 'close-brand-delete-modal') {
    closeBrandDeleteModal();
    return;
  }

  if (action === 'copy-brand-email') {
    const brandId = String(actionEl.dataset.brandId || '').trim();
    const brand = (Array.isArray(state.brands) ? state.brands : []).find((item) => item.id === brandId);
    if (!brand?.email) {
      showToast('Essa marca nÃ£o tem email cadastrado.');
      return;
    }
    copyText(brand.email, 'Email copiado.');
    return;
  }

  if (action === 'select-brand') {
    const brandId = String(actionEl.dataset.brandId || '').trim();
    if (!brandId || state.ui.selectedBrandId === brandId) return;
    state.ui.selectedBrandId = brandId;
    saveState();
    renderAll();
    return;
  }

  if (action === 'new-campaign-for-brand') {
    const brandId = String(actionEl.dataset.brandId || '').trim();
    if (!brandId) return;
    state.ui.pendingCampaignBrandId = brandId;
    openCampaignModal();
    injectOnboardingHeader();
    return;
  }

  if (action === 'toggle-brand-active') {
    const brandId = String(actionEl.dataset.brandId || '').trim();
    const brand = (Array.isArray(state.brands) ? state.brands : []).find((item) => item.id === brandId);
    if (!brand) return;
    const isDormant = ['inativa', 'perdida'].includes(String(brand.status || '').trim());
    brand.status = isDormant ? 'lead' : 'inativa';
    brand.updatedAt = new Date().toISOString();
    saveState();
    renderAll();
    showToast(isDormant ? 'Marca reativada.' : 'Marca desativada.');
    return;
  }

  if (action === 'goto-metrics' || action === 'goto-performance') {
    setActivePage('dashboard');
    return;
  }

  if (action === 'goto-performance-financial') {
    setActivePage('dashboard');
    return;
  }

  if (action === 'goto-campaigns') {
    state.ui.campaignDashboardView = 'all';
    setActivePage('campaigns');
    saveState();
    renderAll();
    return;
  }

  if (action === 'open-dashboard-campaign-view') {
    const view = String(actionEl.dataset.view || '').trim() || 'all';
    state.ui.campaignDashboardView = view;
    state.ui.campaignFilter = 'all';
    saveState();
    setActivePage('campaigns');
    renderAll();
    return;
  }

  if (action === 'clear-dashboard-campaign-view') {
    state.ui.campaignDashboardView = 'all';
    saveState();
    renderAll();
    return;
  }

  if (action === 'new-brand') {
    openBrandModal();
    return;
  }

  if (action === 'edit-brand') {
    const id = actionEl.dataset.brandId;
    if (!id) return;
    openBrandModal(id);
    return;
  }

  if (action === 'delete-brand') {
    const id = actionEl.dataset.brandId;
    if (!id) return;
    openBrandDeleteModal(id);
    return;
  }

  if (action === 'select-brand') {
    const id = actionEl.dataset.brandId;
    if (!id) return;
    state.ui.selectedBrandId = id;
    saveState();
    renderAll();
    return;
  }

  if (action === 'toggle-brand-active') {
    const brand = state.brands.find((item) => item.id === actionEl.dataset.brandId);
    if (!brand) return;
    brand.status = brand.status === 'inativa' ? 'lead' : 'inativa';
    saveState();
    renderAll();
    showToast(brand.status === 'inativa' ? 'Marca desativada.' : 'Marca reativada.');
    return;
  }

  if (action === 'new-campaign-for-brand') {
    const id = actionEl.dataset.brandId;
    if (!id) return;
    openCampaignModal(null, { brandId: id });
    setActivePage('campaigns');
    return;
  }

  if (action === 'open-brand-action-modal' || action === 'edit-brand-action') {
    openBrandActionModal(actionEl.dataset.brandId || '');
    return;
  }

  if (action === 'close-brand-action-modal') {
    closeBrandActionModal();
    return;
  }

  if (action === 'open-campaign') {
    const id = actionEl.dataset.campaignId;
    if (id) {
      setActivePage('campaigns');
      setTimeout(() => { if (window.__ugcModals?.openCampaignModal) window.__ugcModals.openCampaignModal(id); }, 120);
    }
    return;
  }

<<<<<<< Updated upstream
  /* ── Performance tabs ── */
=======
  if (action === 'complete-next-action') {
    const itemId = String(actionEl.dataset.id || '').trim();
    const source = String(actionEl.dataset.source || '').trim();
    const collection = source === 'brand' ? state.brands : state.campaigns;
    const item = (Array.isArray(collection) ? collection : []).find((entry) => entry.id === itemId);
    if (!item) return;
    item.nextActionType = '';
    item.nextActionCustomType = '';
    item.nextActionDate = '';
    item.nextActionNote = '';
    if (source !== 'brand') item.updatedAt = new Date().toISOString();
    saveState();
    renderAll();
    showToast('AÃ§Ã£o concluÃ­da.');
    return;
  }

  if (action === 'mark-payment-received') {
    const campaignId = actionEl.dataset.campaignId;
    const campaign = (Array.isArray(state.campaigns) ? state.campaigns : []).find((item) => item.id === campaignId);
    if (!campaign || campaign.stage !== 'aguardando_pagamento') return;
    const today = todayIso();
    campaign.paymentPercent = 100;
    campaign.paymentReceivedAt = today;
    campaign.paymentDate = campaign.paymentDate || today;
    campaign.status = 'concluida';
    campaign.stage = 'pago';
    campaign.updatedAt = new Date().toISOString();
    saveState();
    renderAll();
    showToast('Pagamento marcado como recebido.');
    return;
  }

  /* â”€â”€ Performance tabs â”€â”€ */
>>>>>>> Stashed changes
  if (action === 'perf-tab') {
    const tab = actionEl.dataset.perfTab;
    if (!tab) return;
    state.ui.performanceTab = tab;
    saveState();
    renderAll();
    return;
  }

  if (action === 'perf-range') {
    const rangeDays = Number(actionEl.dataset.rangeDays || 0);
    if (![7, 15, 30, 45, 90].includes(rangeDays)) return;
    state.metrics = state.metrics && typeof state.metrics === 'object' ? state.metrics : {};
    state.metrics.rangeDays = rangeDays;
    saveState();
    renderAll();
    return;
  }

  if (action === 'edit-monthly-goal') {
    const modal = document.getElementById('meta-modal');
    const input = document.getElementById('meta-modal-input');
    if (!modal || !input) return;
    const current = state.settings?.monthlyGoal || 0;
    input.value = current > 0 ? formatMoneyInput(String(current)) : '';
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => { input.focus(); input.select(); }, 80);
    return;
  }

  if (action === 'close-meta-modal') {
    const modal = document.getElementById('meta-modal');
    if (modal) { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }
    return;
  }

  if (action === 'save-meta-modal') {
    const modal = document.getElementById('meta-modal');
    const input = document.getElementById('meta-modal-input');
    if (!input) return;
    const raw = input.value.replace(/[^\d]/g, '');
    const value = raw ? parseInt(raw, 10) : 0;
    if (!state.settings) state.settings = {};
    state.settings.monthlyGoal = value;
    saveState();
    renderAll();
    if (modal) { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }
    showToast(value > 0 ? `Meta definida: R$ ${value.toLocaleString('pt-BR')}` : 'Meta removida.');
    return;
  }

  if (action === 'new-campaign') {
    const brands = Array.isArray(state.brands) ? state.brands : [];
    if (!brands.length) {
      openBrandModal('', { returnTo: 'campaign' });
      showToast('Crie uma marca antes de cadastrar a campanha.');
      return;
    }
    openCampaignModal();
    injectOnboardingHeader();
    return;
  }

  if (action === 'edit-campaign') {
    const id = actionEl.dataset.campaignId;
    if (!id) return;
    openCampaignModal(id);
    return;
  }

  if (action === 'delete-campaign') {
    const id = actionEl.dataset.campaignId;
    if (!id) return;
    openCampaignDeleteModal(id);
    return;
  }

  if (action === 'duplicate-campaign') {
    const campaignId = actionEl.dataset.campaignId;
    const original = state.campaigns.find((item) => item.id === campaignId);
    if (!original) return;
    const nowIso = new Date().toISOString();
    const clone = {
      ...JSON.parse(JSON.stringify(original)),
      id: `c-${Date.now()}`,
      status: 'prospeccao',
      stage: getDefaultCampaignStage('prospeccao'),
      priority: false,
      paused: false,
      archived: false,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    clone.title = `${original.brand || 'Campanha'} (c\u00f3pia)`;
    state.campaigns.unshift(clone);
    trackEvent('campaign_created', { campaignId: clone.id, campaign: clone });
    saveState();
    renderAll();
    showToast('Campanha duplicada!');
    return;
  }

  if (action === 'complete-next-action') {
    const entity = actionEl.dataset.entity;
    const id = actionEl.dataset.id;
    const list = entity === 'brand' ? state.brands : state.campaigns;
    const item = list.find((entry) => entry.id === id);
    if (!item) return;
    item.nextActionType = '';
    item.nextActionCustomType = '';
    item.nextActionDate = '';
    item.nextActionNote = '';
    if (entity === 'campaign') {
      appendCampaignHistory(item, { type: 'action_completed', title: 'Ação concluída', note: 'Próxima ação marcada como concluída.' });
    }
    saveState();
    renderAll();
    showToast('Ação concluída.');
    return;
  }

  if (action === 'mark-payment-received') {
    const campaign = state.campaigns.find((item) => item.id === actionEl.dataset.campaignId);
    if (!campaign || campaign.stage !== 'aguardando_pagamento') return;
    const nowIso = new Date().toISOString();
    const todayIso = nowIso.slice(0, 10);
    campaign.paymentPercent = 100;
    campaign.paymentReceivedAt = todayIso;
    campaign.paymentDate = campaign.paymentDate || todayIso;
    campaign.status = 'concluida';
    campaign.stage = 'pago';
    campaign.updatedAt = nowIso;
    appendCampaignHistory(campaign, { type: 'payment_received', title: 'Pagamento recebido', note: `Recebimento confirmado em ${todayIso}.` });
    appendCampaignHistory(campaign, { type: 'campaign_completed', title: 'Campanha concluída', note: 'Campanha movida para concluída.' });
    saveState();
    renderAll();
    showToast('Pagamento marcado como recebido.');
    return;
  }

  if (action === 'advance-stage') {
    const campaignId = actionEl.dataset.campaignId;
    const campaign = state.campaigns.find((item) => item.id === campaignId);
    if (!campaign) return;

    const currentStatus = campaign.status;
    const currentStage = campaign.stage;
    const stageOptions = getCampaignStageOptions(currentStatus);
    const currentStageIndex = stageOptions.findIndex((opt) => opt.id === currentStage);
    const isLastStage = currentStageIndex >= stageOptions.length - 1;
    const currentStatusIndex = campaignStatusOrder.indexOf(currentStatus);
    const isLastStatus = currentStatusIndex >= campaignStatusOrder.length - 1;

    if (!isLastStage) {
      const nextStage = stageOptions[currentStageIndex + 1];
      campaign.stage = nextStage.id;
      campaign.updatedAt = new Date().toISOString();
      trackEvent('campaign_stage_changed', {
        campaignId: campaign.id,
        status: campaign.status,
        previousStage: currentStage,
        stage: campaign.stage,
        campaign
      });
      saveState();
      renderAll();
      showToast(`Avan?ou: ${nextStage.label}`);
    } else if (!isLastStatus) {
      const previousStatus = campaign.status;
      const nextStatus = campaignStatusOrder[currentStatusIndex + 1];
      campaign.status = nextStatus;
      campaign.stage = getDefaultCampaignStage(nextStatus);
      campaign.updatedAt = new Date().toISOString();
      trackEvent('campaign_status_changed', {
        campaignId: campaign.id,
        previousStatus,
        status: campaign.status,
        previousStage: currentStage,
        stage: campaign.stage,
        campaign
      });
      if (campaign.stage !== currentStage) {
        trackEvent('campaign_stage_changed', {
          campaignId: campaign.id,
          status: campaign.status,
          previousStage: currentStage,
          stage: campaign.stage,
          campaign
        });
      }
      saveState();
      renderAll();
      showToast(`Avan?ou: ${statusLabels[campaign.status] || campaign.status}`);
    }
    return;
  }

  if (action === 'toggle-priority') {
    const campaignId = actionEl.dataset.campaignId;
    const campaign = state.campaigns.find((item) => item.id === campaignId);
    if (!campaign) return;
    
    // Se jÃ¡ Ã© prioridade, apenas remove
    if (campaign.priority) {
      campaign.priority = false;
      campaign.updatedAt = new Date().toISOString();
      saveState();
      renderAll();
      showToast('Prioridade removida');
      return;
    }
    
    // Limite de 2 campanhas prioritarias ao mesmo tempo
    const priorityCount = state.campaigns.reduce((acc, c) => acc + (c.priority ? 1 : 0), 0);
    if (priorityCount >= 2) {
      showToast('Voce pode priorizar no maximo 2 campanhas.');
      return;
    }
    
    // Define esta como prioridade
    campaign.priority = true;
    campaign.updatedAt = new Date().toISOString();
    
    saveState();
    renderAll();
    showToast('Campanha marcada como prioridade');
    return;
  }

  if (action === 'close-campaign-modal') {
    closeCampaignModal();
    return;
  }

  if (action === 'close-brand-modal') {
    closeBrandModal();
    return;
  }

  if (action === 'close-brand-delete-modal') {
    closeBrandDeleteModal();
    return;
  }

  if (action === 'close-campaign-delete-modal') {
    closeCampaignDeleteModal();
    return;
  }

  if (action === 'close-script-delete-modal') {
    closeScriptDeleteModal();
    return;
  }

  if (action === 'open-focus-modal') {
    openFocusModal();
    return;
  }

  if (action === 'close-focus-modal') {
    closeFocusModal();
    return;
  }

  if (action === 'confirm-focus-modal') {
    confirmFocusModal();
    return;
  }

  if (action === 'complete-campaign-action') {
    const form = getCampaignStepModal().form;
    const campaignId = form?.querySelector('[name="campaignId"]')?.value;
    const campaign = state.campaigns.find((item) => item.id === campaignId);
    if (!campaign) return;
    campaign.nextActionType = '';
    campaign.nextActionCustomType = '';
    campaign.nextActionDate = '';
    campaign.nextActionNote = '';
    campaign.updatedAt = new Date().toISOString();
    appendCampaignHistory(campaign, { type: 'action_completed', title: 'Ação concluída', note: 'A próxima ação foi concluída.' });
    saveState();
    renderAll();
    closeCampaignStepModal();
    showToast('Ação concluída.');
    return;
  }

  if (action === 'advance-campaign-step') {
    const form = getCampaignStepModal().form;
    const campaignId = form?.querySelector('[name="campaignId"]')?.value;
    const campaign = state.campaigns.find((item) => item.id === campaignId);
    if (!campaign) return;
    const currentStatus = campaign.status;
    const currentStage = campaign.stage;
    const stageOptions = getCampaignStageOptions(currentStatus);
    const stageIndex = stageOptions.findIndex((opt) => opt.id === currentStage);
    const statusIndex = campaignStatusOrder.indexOf(currentStatus);
    if (stageIndex < stageOptions.length - 1) {
      campaign.stage = stageOptions[stageIndex + 1].id;
    } else if (statusIndex < campaignStatusOrder.length - 1) {
      campaign.status = campaignStatusOrder[statusIndex + 1];
      campaign.stage = getDefaultCampaignStage(campaign.status);
    } else {
      closeCampaignStepModal();
      showToast('Essa campanha já está na etapa final.');
      return;
    }
    campaign.updatedAt = new Date().toISOString();
    appendCampaignHistory(campaign, {
      type: 'stage_changed',
      title: 'Etapa alterada',
      note: `${statusLabels[campaign.status] || campaign.status}${campaign.stage ? ` • ${getCampaignStageLabel(campaign.status, campaign.stage) || campaign.stage}` : ''}`
    });
    saveState();
    renderAll();
    closeCampaignStepModal();
    showToast('Etapa avançada.');
    return;
  }

  if (action === 'show-script') {
    openScriptFromHistory(actionEl.dataset.scriptId);
    return;
  }

  if (action === 'delete-script') {
    openScriptDeleteModal(actionEl.dataset.scriptId);
    return;
  }

  if (action === 'copy-script') {
    copyCurrentScript();
    return;
  }

  if (action === 'finalize-script') {
    const currentId = state.ui.openScript;
    const current = currentId ? state.scripts.find((item) => item.id === currentId) : null;
    if (!current) return;
    if (current.finalized) {
      showToast('Este roteiro jÃ¡ estÃ¡ finalizado.');
      return;
    }
    current.finalized = true;
    trackEvent('script_finalized', { scriptId: current.id, script: current });
    saveState();
    renderAll();
    showToast('Roteiro finalizado!');
    return;
  }

  if (action === 'copy-script-history') {
    copyScriptFromHistory(actionEl.dataset.scriptId);
    return;
  }

  if (action === 'pause-campaign') {
    const campaignId = actionEl.dataset.campaignId;
    const campaign = state.campaigns.find((item) => item.id === campaignId);
    if (!campaign) return;
    campaign.paused = true;
    campaign.archived = false;
    campaign.updatedAt = new Date().toISOString();
    trackEvent('campaign_paused', { campaignId: campaign.id, campaign });
    saveState();
    renderAll();
    showToast('Campanha pausada.');
    return;
  }

  if (action === 'archive-campaign') {
    const campaignId = actionEl.dataset.campaignId;
    const campaign = state.campaigns.find((item) => item.id === campaignId);
    if (!campaign) return;
    campaign.archived = true;
    campaign.paused = false;
    campaign.updatedAt = new Date().toISOString();
    trackEvent('campaign_archived', { campaignId: campaign.id, campaign });
    saveState();
    renderAll();
    showToast('Campanha arquivada.');
    return;
  }

  if (action === 'resume-campaign') {
    const campaignId = actionEl.dataset.campaignId;
    const campaign = state.campaigns.find((item) => item.id === campaignId);
    if (!campaign) return;
    campaign.paused = false;
    campaign.archived = false;
    campaign.updatedAt = new Date().toISOString();
    trackEvent('campaign_resumed', { campaignId: campaign.id, campaign });
    saveState();
    renderAll();
    showToast('Campanha retomada.');
    return;
  }
};

const handleNavClick = (event) => {
  const navItem = event.target.closest('.nav-item[data-target]');
  if (!navItem) return;
  const target = navItem.dataset.target;
  setActivePage(target);
  if (target === 'settings') {
    initAdminTrackerCard();
  }
  if (target === 'campaigns') {
    trackEvent('campaigns_viewed');
    saveState();
    renderAll();
  }
  if (target === 'brands') {
    saveState();
    renderAll();
  }
};

const handleFilterClick = (event) => {
  const filterBtn = event.target.closest('.filter-btn');
  if (!filterBtn) return;
  document.querySelectorAll('.filter-btn').forEach((btn) => btn.classList.remove('active'));
  filterBtn.classList.add('active');
  state.ui.campaignDashboardFilter = '';
  state.ui.campaignFilter = filterBtn.dataset.filter;
  saveState();
  renderAll();
};

const getStageLabelForHistory = (status, stageId) => {
  const found = getCampaignStageOptions(status).find((opt) => opt.id === stageId);
  return found?.label || stageId || 'Sem etapa';
};

const handleChange = (event) => {
  const target = event.target;

  if (target.matches('[data-campaign-payment-filter]')) {
    state.ui.campaignPaymentFilter = target.value || 'all';
    saveState();
    renderAll();
    return;
  }

  if (target.matches('[data-campaign-status]')) {
    const campaignId = target.dataset.campaignId;
    const campaign = state.campaigns.find((item) => item.id === campaignId);
    if (!campaign) return;
    const previousStatus = campaign.status;
    const previousStage = campaign.stage;
    const newStatus = target.value;
    const oldPos = getGlobalStagePos(previousStatus, previousStage);
    const newPos = getGlobalStagePos(newStatus, getDefaultCampaignStage(newStatus));
    const delta = newPos - oldPos;
    
    campaign.status = newStatus;
    campaign.stage = getDefaultCampaignStage(campaign.status);
    campaign.updatedAt = new Date().toISOString();

    const previousStatusLabel = statusLabels[previousStatus] || previousStatus;
    const nextStatusLabel = statusLabels[campaign.status] || campaign.status;
    const previousStageLabel = getStageLabelForHistory(previousStatus, previousStage);
    const nextStageLabel = getStageLabelForHistory(campaign.status, campaign.stage);
    const statusDirection = delta > 0 ? 'advanced' : delta < 0 ? 'regressed' : 'updated';

    appendCampaignHistoryEntry(campaign, {
      type: statusDirection === 'advanced' ? 'status_advanced' : statusDirection === 'regressed' ? 'status_regressed' : 'status_updated',
      title: statusDirection === 'advanced' ? 'Status avanÃ§ou' : statusDirection === 'regressed' ? 'Status regrediu' : 'Status atualizado',
      description: `${previousStatusLabel} -> ${nextStatusLabel}`,
      occurredAt: campaign.updatedAt
    });

    if (campaign.stage && campaign.stage !== previousStage) {
      appendCampaignHistoryEntry(campaign, {
        type: delta < 0 ? 'stage_regressed' : 'stage_advanced',
        title: delta < 0 ? 'Etapa regrediu' : 'Etapa avanÃ§ou',
        description: `${previousStageLabel} -> ${nextStageLabel}`,
        occurredAt: campaign.updatedAt
      });
    }
    
    // Atualiza classes de cor do select de status
    target.className = `select select-compact status-${campaign.status}`;
    
    trackEvent('campaign_status_changed', {
      campaignId: campaign.id,
      previousStatus,
      status: campaign.status,
      previousStage,
      stage: campaign.stage,
      campaign
    });

    if (campaign.stage && campaign.stage !== previousStage) {
      trackEvent('campaign_stage_changed', {
        campaignId: campaign.id,
        status: campaign.status,
        previousStage,
        stage: campaign.stage,
        campaign
      });
    }
    saveState();
    renderAll();
    showToast('Status atualizado.');
    return;
  }

  if (target.matches('[data-campaign-stage]')) {
    const campaignId = target.dataset.campaignId;
    const campaign = state.campaigns.find((item) => item.id === campaignId);
    if (!campaign) return;

    const previousStage = campaign.stage;
    const nextStage = target.value;
    if (nextStage === previousStage) return;
    const options = getCampaignStageOptions(campaign.status);
    const previousStageIndex = options.findIndex((opt) => opt.id === previousStage);
    const nextStageIndex = options.findIndex((opt) => opt.id === nextStage);
    const stageOldPos = getGlobalStagePos(campaign.status, previousStage);
    const stageNewPos = getGlobalStagePos(campaign.status, nextStage);
    const stageDelta = stageNewPos - stageOldPos;
    
    const isValid = options.some((opt) => opt.id === nextStage);
    campaign.stage = isValid ? nextStage : getDefaultCampaignStage(campaign.status);
    campaign.updatedAt = new Date().toISOString();

    appendCampaignHistoryEntry(campaign, {
      type: stageDelta > 0 ? 'stage_advanced' : stageDelta < 0 ? 'stage_regressed' : 'stage_updated',
      title: stageDelta > 0 ? 'Etapa avanÃ§ou' : stageDelta < 0 ? 'Etapa regrediu' : 'Etapa atualizada',
      description: `${getStageLabelForHistory(campaign.status, previousStage)} -> ${getStageLabelForHistory(campaign.status, campaign.stage)}`,
      occurredAt: campaign.updatedAt
    });

    // Atualiza classes de cor do select de etapa
    target.className = `select select-compact stage-${campaign.status}`;

    trackEvent('campaign_stage_changed', {
      campaignId: campaign.id,
      status: campaign.status,
      previousStage,
      stage: campaign.stage,
      campaign
    });

    saveState();
    renderAll();
    showToast('Etapa atualizada.');
    return;
  }

  if (target.matches('[data-brand-status]')) {
    const brandId = target.dataset.brandId;
    const brand = state.brands.find((item) => item.id === brandId);
    if (!brand) return;
    brand.status = target.value;
    brand.updatedAt = new Date().toISOString();
    saveState();
    renderAll();
    showToast('Marca atualizada.');
    return;
  }

  if (target.matches('[data-setting]')) {
    const key = target.dataset.setting;
    state.settings[key] = target.checked;
    saveState();

    if (key === 'alerts') {
      if (target.checked) {
        showToast('Alertas ligados. Vou te lembrar por aqui.');
        runCampaignAlerts({ force: true });
        return;
      }
      clearCampaignAlertsCache();
      showToast('Alertas desligados.');
      return;
    }

    if (key === 'backup') {
      showToast(target.checked ? 'Backup ligado. Seu progresso fica salvo.' : 'Backup desligado. Sem salvar progresso.');
      return;
    }

    showToast('Config salva.');
  }

  /* â”€â”€ Metas Financeiras â”€â”€ */
  if (target.matches('[data-goals]')) {
    const key = target.dataset.goals;
    state.settings[key] = target.type === 'number' ? Number(target.value) || 0 : target.value;
    saveState();
    showToast('Meta atualizada.');
    return;
  }

  /* â”€â”€ Perfil do Criador â”€â”€ */
  if (target.matches('[data-creator]')) {
    const key = target.dataset.creator;
    state.settings[key] = target.value;
    saveState();
    showToast('Perfil atualizado.');
    return;
  }
  if (target.matches('[data-creator-platforms]')) {
    const picked = [...document.querySelectorAll('[data-creator-platforms]:checked')].map(cb => cb.value);
    state.settings.platforms = picked;
    saveState();
    showToast('Plataformas atualizadas.');
    return;
  }

  /* â”€â”€ ConfiguraÃ§Ã£o da IA â”€â”€ */
  if (target.matches('[data-ai]')) {
    const key = target.dataset.ai;
    state.settings[key] = target.value;
    saveState();
    showToast('ConfiguraÃ§Ã£o de IA salva.');
    return;
  }

  /* â”€â”€ Alertas Inteligentes â”€â”€ */
  if (target.matches('[data-smart-alert]')) {
    const key = target.dataset.smartAlert;
    state.settings[key] = target.checked;
    saveState();
    showToast('Alerta atualizado.');
    return;
  }
  if (target.matches('[data-smart-alert-days]')) {
    state.settings.alertStaleDays = Number(target.value) || 5;
    saveState();
    showToast('Dias de inatividade atualizado.');
    return;
  }

  /* â”€â”€ Campaign sort â”€â”€ */
  if (target.matches('[data-campaign-sort]')) {
    state.ui.campaignSort = target.value || 'updatedAt';
    saveState();
    renderAll();
    return;
  }
};

const initSecondaryModals = () => {
  const brandAction = getBrandActionModal();
  if (brandAction.form && brandAction.form.dataset.bound !== '1') {
    brandAction.form.dataset.bound = '1';
    const typeSelect = brandAction.form.querySelector('[name="nextActionType"]');
    const customRow = document.getElementById('brand-action-custom-row');
    if (typeSelect) {
      typeSelect.addEventListener('change', () => {
        if (customRow) customRow.style.display = typeSelect.value === 'outro' ? '' : 'none';
      });
    }
    brandAction.form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(brandAction.form);
      const brand = state.brands.find((item) => item.id === String(data.get('brandId') || ''));
      if (!brand) {
        if (brandAction.msg) brandAction.msg.textContent = 'Escolha uma marca.';
        return;
      }
      const nextActionType = String(data.get('nextActionType') || '').trim();
      const nextActionDate = String(data.get('nextActionDate') || '').trim();
      const nextActionCustomType = String(data.get('nextActionCustomType') || '').trim();
      const nextActionNote = String(data.get('nextActionNote') || '').trim().slice(0, 140);
      if (nextActionType && !nextActionDate) {
        if (brandAction.msg) brandAction.msg.textContent = 'Defina a data da próxima ação.';
        return;
      }
      if (nextActionType === 'outro' && !nextActionCustomType) {
        if (brandAction.msg) brandAction.msg.textContent = 'Descreva o tipo personalizado.';
        return;
      }
      brand.nextActionType = nextActionType;
      brand.nextActionCustomType = nextActionType === 'outro' ? nextActionCustomType : '';
      brand.nextActionDate = nextActionDate;
      brand.nextActionNote = nextActionNote;
      saveState();
      renderAll();
      closeBrandActionModal();
      showToast('Ação da marca atualizada.');
    });
  }

  const stepModal = getCampaignStepModal();
  if (stepModal.form && stepModal.form.dataset.bound !== '1') {
    stepModal.form.dataset.bound = '1';
    const typeSelect = stepModal.form.querySelector('[name="nextActionType"]');
    const customRow = document.getElementById('campaign-step-custom-row');
    if (typeSelect) {
      typeSelect.addEventListener('change', () => {
        if (customRow) customRow.style.display = typeSelect.value === 'outro' ? '' : 'none';
      });
    }
    stepModal.form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(stepModal.form);
      const campaign = state.campaigns.find((item) => item.id === String(data.get('campaignId') || ''));
      if (!campaign) return;
      const nextActionType = String(data.get('nextActionType') || '').trim();
      const nextActionDate = String(data.get('nextActionDate') || '').trim();
      const nextActionCustomType = String(data.get('nextActionCustomType') || '').trim();
      const nextActionNote = String(data.get('nextActionNote') || '').trim().slice(0, 140);
      if (nextActionType && !nextActionDate) {
        if (stepModal.msg) stepModal.msg.textContent = 'Defina a data da próxima ação.';
        return;
      }
      if (nextActionType === 'outro' && !nextActionCustomType) {
        if (stepModal.msg) stepModal.msg.textContent = 'Descreva o tipo personalizado.';
        return;
      }
      campaign.nextActionType = nextActionType;
      campaign.nextActionCustomType = nextActionType === 'outro' ? nextActionCustomType : '';
      campaign.nextActionDate = nextActionDate;
      campaign.nextActionNote = nextActionNote;
      campaign.updatedAt = new Date().toISOString();
      saveState();
      renderAll();
      closeCampaignStepModal();
      showToast('Próximo passo atualizado.');
    });
  }

  const contractModal = getCampaignContractModal();
  if (contractModal.form && contractModal.form.dataset.bound !== '1') {
    contractModal.form.dataset.bound = '1';
    contractModal.form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(contractModal.form);
      const campaign = state.campaigns.find((item) => item.id === String(data.get('campaignId') || ''));
      if (!campaign) return;
      campaign.contract = {
        usageRights: String(data.get('usageRights') || '').trim(),
        usagePeriod: String(data.get('usagePeriod') || '').trim(),
        advanceAmount: parseInt(String(data.get('advanceAmount') || '').replace(/\D/g, ''), 10) || 0,
        productSent: String(data.get('productSent') || '0') === '1',
        productReceivedAt: String(data.get('productReceivedAt') || '').trim(),
        invoiceRequired: String(data.get('invoiceRequired') || '0') === '1',
        paymentExpectedAt: String(data.get('paymentExpectedAt') || '').trim()
      };
      if (campaign.contract.paymentExpectedAt) campaign.paymentDate = campaign.contract.paymentExpectedAt;
      campaign.updatedAt = new Date().toISOString();
      saveState();
      renderAll();
      closeCampaignContractModal();
      showToast('Contrato atualizado.');
    });
  }
};

const initActions = () => {
  initScriptFlow();
  initScriptDeleteFeature();
  initBrandForm();
  initBrandDeleteFeature();
  initCampaignForm();
  initCampaignDeleteFeature();
  initBrandForm();
  initBrandDeleteFeature();
  initAccountForm();
  initAdminTrackerCard();
  initSecondaryModals();

  // Expose modal functions for quiz convert-to-real flow
  window.__ugcModals = { openCampaignModal };

  document.body.addEventListener('click', handleActionClick);
  document.body.addEventListener('click', handleNavClick);
  document.body.addEventListener('click', handleFilterClick);
  document.body.addEventListener('change', handleChange);
<<<<<<< Updated upstream
=======
  document.body.addEventListener('submit', handleBrandInteractionSubmit);
  document.body.addEventListener('keydown', (event) => {
    const actionCard = event.target.closest('[data-dashboard-card-link]');
    if (!actionCard) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    actionCard.click();
  });
>>>>>>> Stashed changes

  /* Money mask for meta modal input */
  const metaInput = document.getElementById('meta-modal-input');
  if (metaInput) {
    metaInput.addEventListener('input', () => applyMoneyMask(metaInput));
    metaInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const saveBtn = document.querySelector('[data-action="save-meta-modal"]');
        if (saveBtn) saveBtn.click();
      }
      if (e.key === 'Escape') {
        const closeBtn = document.querySelector('[data-action="close-meta-modal"]');
        if (closeBtn) closeBtn.click();
      }
    });
  }

  runCampaignAlerts();
};

export { initActions };


