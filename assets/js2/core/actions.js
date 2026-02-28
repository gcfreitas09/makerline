import { state, saveState, campaignStatusOrder, getCampaignStageOptions, getDefaultCampaignStage, statusLabels } from './state.js';
import { setActivePage, showToast } from './ui.js';
import { trackEvent, awardXp } from './gamification.js';
import { renderAll } from './renderers.js';

import {
  closeCampaignModal,
  initCampaignForm,
  openCampaignModal
} from '../features/campaigns/modal.js';
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
import { syncWeeklySetting } from '../features/settings/weekly.js';
import { clearCampaignAlertsCache, runCampaignAlerts } from '../features/settings/alerts.js';
import { sendWeeklySummaryNow } from '../features/settings/weekly_summary.js';
import { handleQuizAction, injectOnboardingHeader, convertModelToReal, ensureOnboardingQuiz } from '../features/onboarding/quiz.js';

/* ── Money mask helper ── */
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

/* Posi\u00e7\u00e3o global de (status, stage) no pipeline.
   Total: 15 posi\u00e7\u00f5es, 14 transi\u00e7\u00f5es → 100 XP para pipeline completo. */
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
    setActivePage('scripts');
    return;
  }

  if (action === 'goto-metrics' || action === 'goto-performance') {
    setActivePage('performance');
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

    const isModel = campaign.isModel === true;

    const currentStatus = campaign.status;
    const currentStage = campaign.stage;
    const stageOptions = getCampaignStageOptions(currentStatus);
    const currentStageIndex = stageOptions.findIndex((opt) => opt.id === currentStage);
    const isLastStage = currentStageIndex >= stageOptions.length - 1;
    const currentStatusIndex = campaignStatusOrder.indexOf(currentStatus);
    const isLastStatus = currentStatusIndex >= campaignStatusOrder.length - 1;

    if (!isLastStage) {
      const nextStage = stageOptions[currentStageIndex + 1];
      const xpGain = isModel ? 0 : 5;
      campaign.stage = nextStage.id;
      campaign.updatedAt = new Date().toISOString();
      trackEvent('campaign_stage_changed', {
        campaignId: campaign.id,
        status: campaign.status,
        previousStage: currentStage,
        stage: campaign.stage,
        campaign
      });
      if (xpGain > 0) awardXp(xpGain);
      saveState();
      renderAll();
      showToast(`Avançou: ${nextStage.label}${xpGain > 0 ? ` (+${xpGain} XP)` : ''}`);
    } else if (!isLastStatus) {
      const previousStatus = campaign.status;
      const nextStatus = campaignStatusOrder[currentStatusIndex + 1];
      campaign.status = nextStatus;
      campaign.stage = getDefaultCampaignStage(nextStatus);
      const xpGain = isModel ? 0 : 5;
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
      if (xpGain > 0) awardXp(xpGain);
      saveState();
      renderAll();
      showToast(`Avan\u00e7ou: ${statusLabels[campaign.status] || campaign.status}${xpGain > 0 ? ` (+${xpGain} XP)` : ''}`);
    }
    return;
  }

  if (action === 'toggle-priority') {
    const campaignId = actionEl.dataset.campaignId;
    const campaign = state.campaigns.find((item) => item.id === campaignId);
    if (!campaign) return;
    
    // Se já é prioridade, apenas remove
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
      showToast('Este roteiro já está finalizado.');
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
};

const handleFilterClick = (event) => {
  const filterBtn = event.target.closest('.filter-btn');
  if (!filterBtn) return;
  document.querySelectorAll('.filter-btn').forEach((btn) => btn.classList.remove('active'));
  filterBtn.classList.add('active');
  state.ui.campaignFilter = filterBtn.dataset.filter;
  saveState();
  renderAll();
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
    
    const currentStatusIndex = campaignStatusOrder.indexOf(previousStatus);
    const newStatusIndex = campaignStatusOrder.indexOf(newStatus);
    
    const isModel = campaign.isModel === true;
    // XP proporcional: 5 XP por cada posição de etapa percorrida
    const oldPos = getGlobalStagePos(previousStatus, previousStage);
    const newPos = getGlobalStagePos(newStatus, getDefaultCampaignStage(newStatus));
    const delta = newPos - oldPos;
    const xpAmount = isModel ? 0 : Math.abs(delta) * 5;

    if (!isModel && delta < 0 && xpAmount > 0) {
      const loss = Math.min(xpAmount, state.profile.xp);
      if (loss > 0) {
        state.profile.xp -= loss;
        showToast(`-${loss} XP (voltou)`);
      }
    } else if (!isModel && delta > 0 && xpAmount > 0) {
      awardXp(xpAmount);
      showToast(`+${xpAmount} XP (avançou)`);
    }
    
    campaign.status = newStatus;
    campaign.stage = getDefaultCampaignStage(campaign.status);
    campaign.updatedAt = new Date().toISOString();
    
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

    const isModel = campaign.isModel === true;
    const options = getCampaignStageOptions(campaign.status);
    const previousStageIndex = options.findIndex((opt) => opt.id === previousStage);
    const nextStageIndex = options.findIndex((opt) => opt.id === nextStage);
    
    // XP fixo por etapa: 5 XP
    const stageOldPos = getGlobalStagePos(campaign.status, previousStage);
    const stageNewPos = getGlobalStagePos(campaign.status, nextStage);
    const stageDelta = stageNewPos - stageOldPos;
    const stepsChanged = Math.abs(nextStageIndex - previousStageIndex);
    const stageXp = isModel ? 0 : stepsChanged * 5;

    if (!isModel && stageDelta < 0 && stageXp > 0) {
      const loss = Math.min(stageXp, state.profile.xp);
      if (loss > 0) {
        state.profile.xp -= loss;
        showToast(`-${loss} XP (etapa voltou)`);
      }
    } else if (!isModel && stageDelta > 0 && stageXp > 0) {
      awardXp(stageXp);
      showToast(`+${stageXp} XP (etapa avançou)`);
    }
    
    const isValid = options.some((opt) => opt.id === nextStage);
    campaign.stage = isValid ? nextStage : getDefaultCampaignStage(campaign.status);
    campaign.updatedAt = new Date().toISOString();

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
    showToast('Etapa atualizada.');urn;
  }

  if (target.matches('[data-brand-status]')) {
    const brandId = target.dataset.brandId;
    const brand = state.brands.find((item) => item.id === brandId);
    if (!brand) return;
    brand.status = target.value;
    saveState();
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

  /* ── Metas Financeiras ── */
  if (target.matches('[data-goals]')) {
    const key = target.dataset.goals;
    state.settings[key] = target.type === 'number' ? Number(target.value) || 0 : target.value;
    saveState();
    showToast('Meta atualizada.');
    return;
  }

  /* ── Perfil do Criador ── */
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

  /* ── Configuração da IA ── */
  if (target.matches('[data-ai]')) {
    const key = target.dataset.ai;
    state.settings[key] = target.value;
    saveState();
    showToast('Configuração de IA salva.');
    return;
  }

  /* ── Alertas Inteligentes ── */
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

  /* ── Campaign sort ── */
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
  initCampaignForm();
  initCampaignDeleteFeature();
  initAccountForm();
  initAdminTrackerCard();

  // Expose modal functions for quiz convert-to-real flow
  window.__ugcModals = { openCampaignModal };

  document.body.addEventListener('click', handleActionClick);
  document.body.addEventListener('click', handleNavClick);
  document.body.addEventListener('click', handleFilterClick);
  document.body.addEventListener('change', handleChange);

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
