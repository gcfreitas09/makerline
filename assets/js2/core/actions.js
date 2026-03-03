import { state, saveState, campaignStatusOrder, getCampaignStageOptions, getDefaultCampaignStage, statusLabels, nextActionOptions } from './state.js';
import { setActivePage, showToast } from './ui.js';
import { trackEvent } from './gamification.js';
import { renderAll } from './renderers.js';

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
import { initAccountForm } from '../features/settings/account.js';
import { initAdminTrackerCard } from '../features/settings/admin_tracker.js?v=20260217b';
import { syncWeeklySetting } from '../features/settings/weekly.js';
import { clearCampaignAlertsCache, runCampaignAlerts } from '../features/settings/alerts.js';
import { sendWeeklySummaryNow } from '../features/settings/weekly_summary.js';
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

  if (title) title.textContent = brand?.nextActionType ? 'Editar ação de marca' : 'Nova ação de marca';
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
  if (title) title.textContent = 'Nova ação de marca';
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
    if (msg) msg.textContent = 'Escolha uma marca válida.';
    return;
  }
  if (!nextActionType) {
    if (msg) msg.textContent = 'Escolha a próxima ação.';
    return;
  }
  if (!nextActionDate) {
    if (msg) msg.textContent = 'Defina a data da ação.';
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
  showToast('Ação da marca salva.');
};

/* Posi\u00e7\u00e3o global de (status, stage) no pipeline.
   Total: 15 posi\u00e7\u00f5es, 14 transi\u00e7\u00f5es → 100 XP para pipeline completo. */
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
    showToast('Marca não encontrada.');
    return;
  }
  if (!date) {
    showToast('Defina a data da interação.');
    return;
  }
  if (!['dm', 'email', 'call'].includes(type)) {
    showToast('Escolha um tipo válido de interação.');
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
  showToast('Interação registrada.');
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
    setActivePage('campaigns');
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
      showToast('Essa marca não tem email cadastrado.');
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

  if (action === 'open-brand-action-modal') {
    openBrandActionModal();
    return;
  }

  if (action === 'edit-brand-action') {
    const brandId = actionEl.dataset.brandId;
    if (brandId) openBrandActionModal(brandId);
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
    showToast('Ação concluída.');
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

  /* ── Performance tabs ── */
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
      showToast(`Avançou: ${nextStage.label}`);
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
      showToast(`Avançou: ${statusLabels[campaign.status] || campaign.status}`);
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

  if (action === 'close-campaign-delete-modal') {
    closeCampaignDeleteModal();
    return;
  }

  if (action === 'close-script-delete-modal') {
    closeScriptDeleteModal();
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

  if (action === 'send-weekly-summary') {
    sendWeeklySummaryNow();
    return;
  }

  if (action === 'copy-weekly-preview') {
    const preview = document.getElementById('weekly-summary-preview');
    if (!preview) return;
    copyText(preview.textContent, 'Resumo copiado.');
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

  if (target.matches('[data-finance-range]')) {
    const rangeDays = Number(target.value || 30);
    state.ui.financeRangeDays = [0, 15, 30, 45, 90].includes(rangeDays) ? rangeDays : 30;
    state.ui.financeExpandedCampaignId = '';
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
    
    const currentStatusIndex = campaignStatusOrder.indexOf(previousStatus);
    const newStatusIndex = campaignStatusOrder.indexOf(newStatus);
    
    // XP proporcional: 5 XP por cada posição de etapa percorrida
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
    if (key === 'weekly') {
      renderAll();
      syncWeeklySetting(target.checked);
      return;
    }

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

const initActions = () => {
  initScriptFlow();
  initScriptDeleteFeature();
  initBrandForm();
  initBrandDeleteFeature();
  initCampaignForm();
  initCampaignDeleteFeature();
  initAccountForm();
  initAdminTrackerCard();

  const brandActionForm = document.getElementById('brand-action-form');
  if (brandActionForm && brandActionForm.dataset.bound !== '1') {
    brandActionForm.dataset.bound = '1';
    brandActionForm.addEventListener('submit', handleBrandActionSubmit);

    const brandActionTypeSelect = brandActionForm.querySelector('select[name="nextActionType"]');
    if (brandActionTypeSelect) {
      brandActionTypeSelect.addEventListener('change', () => {
        setBrandActionCustomVisibility(brandActionTypeSelect.value);
      });
    }

    const brandSelect = brandActionForm.querySelector('select[name="brandIdSelect"]');
    const hiddenBrandId = brandActionForm.querySelector('input[name="brandId"]');
    if (brandSelect && hiddenBrandId) {
      brandSelect.addEventListener('change', () => {
        hiddenBrandId.value = brandSelect.value || '';
      });
    }
  }

  // Expose modal functions for quiz convert-to-real flow
  window.__ugcModals = { openCampaignModal };

  document.body.addEventListener('click', handleActionClick);
  document.body.addEventListener('click', handleNavClick);
  document.body.addEventListener('click', handleFilterClick);
  document.body.addEventListener('change', handleChange);
  document.body.addEventListener('submit', handleBrandInteractionSubmit);
  document.body.addEventListener('keydown', (event) => {
    const actionCard = event.target.closest('[data-dashboard-card-link]');
    if (!actionCard) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    actionCard.click();
  });

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


