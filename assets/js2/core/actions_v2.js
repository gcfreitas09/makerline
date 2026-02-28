import { state, saveState, campaignStatusOrder, getCampaignStageOptions, getDefaultCampaignStage } from './state.js';
import { setActivePage, showToast } from './ui.js';
import { trackEvent } from './gamification.js';
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
import { closeTour, nextTour, openTour, prevTour, skipTour } from '../features/tour/tour.js';
import { initAccountForm } from '../features/settings/account.js';
import { initAdminTrackerCard } from '../features/settings/admin_tracker.js';
import { syncWeeklySetting } from '../features/settings/weekly.js';
import { clearCampaignAlertsCache, runCampaignAlerts } from '../features/settings/alerts.js';
import { sendWeeklySummaryNow } from '../features/settings/weekly_summary.js';

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

  if (action === 'goto-metrics') {
    setActivePage('metrics');
    return;
  }

  if (action === 'open-campaign') {
    const id = actionEl.dataset.campaignId;
    if (!id) return;
    setActivePage('campaigns');
    setTimeout(() => openCampaignModal(id), 120);
    return;
  }

  if (action === 'new-campaign') {
    openCampaignModal();
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
      // Avançar para próxima etapa no mesmo status
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
      showToast(`Etapa avançada: ${nextStage.label}`);
    } else if (!isLastStatus) {
      // Avançar para próximo status
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
      showToast(`Status avançado: ${campaign.status}`);
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

  if (action === 'start-tour') {
    openTour({ force: true });
    return;
  }

  if (action === 'tour-next') {
    nextTour();
    return;
  }

  if (action === 'tour-prev') {
    prevTour();
    return;
  }

  if (action === 'tour-skip') {
    skipTour();
    return;
  }

  if (action === 'tour-close') {
    closeTour({ markDone: true });
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
      showToast('Esse roteiro já tá finalizado.');
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
    
    // Impedir retrocesso de status
    const currentStatusIndex = campaignStatusOrder.indexOf(previousStatus);
    const newStatusIndex = campaignStatusOrder.indexOf(newStatus);
    if (newStatusIndex < currentStatusIndex) {
      target.value = previousStatus;
      showToast('Não é possível retroceder para um status anterior.');
      return;
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

    const options = getCampaignStageOptions(campaign.status);
    const previousStageIndex = options.findIndex((opt) => opt.id === previousStage);
    const nextStageIndex = options.findIndex((opt) => opt.id === nextStage);
    
    // Impedir retrocesso de etapa
    if (nextStageIndex < previousStageIndex) {
      target.value = previousStage;
      showToast('Não é possível retroceder para uma etapa anterior.');
      return;
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
    showToast('Etapa atualizada.');
    return;
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
};

const initActions = () => {
  initScriptFlow();
  initScriptDeleteFeature();
  initCampaignForm();
  initCampaignDeleteFeature();
  initAccountForm();
  if (state.ui.activePage === 'settings') {
    initAdminTrackerCard();
  }

  document.body.addEventListener('click', handleActionClick);
  document.body.addEventListener('click', handleNavClick);
  document.body.addEventListener('click', handleFilterClick);
  document.body.addEventListener('change', handleChange);

  runCampaignAlerts();
};

export { initActions };
