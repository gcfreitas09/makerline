import { state, saveState, getDefaultCampaignStage } from '../../core/state.js';
import { renderAll } from '../../core/renderers.js?v=20260429d';
import { setActivePage, showToast } from '../../core/ui.js?v=20260304b';
import { trackEvent } from '../../core/gamification.js?v=20260302g';
import { abrirFluxoDePrecificacao } from './pricing-flow.js?v=20260728o';
import { abrirFluxoPrimeiraCampanha } from './first-campaign-flow.js?v=20260728o';
import { abrirRegistroGuiado } from '../campaigns/register-flow.js?v=20260728o';

/* ── helpers ────────────────────────────────────────────────── */

const TOOLTIP_SNOOZE_MS = 2 * 60 * 60 * 1000;

const ensureOnboardingQuiz = () => {
  if (!state.progress) state.progress = {};
  if (!state.progress.onboarding || typeof state.progress.onboarding !== 'object') {
    state.progress.onboarding = {};
  }
  const ob = state.progress.onboarding;
  if (ob.quizDone === undefined) ob.quizDone = false;
  if (ob.hasCampaigns === undefined) ob.hasCampaigns = null;
  if (ob.campaignCount === undefined) ob.campaignCount = null;
  if (ob.firstCampaignCreated === undefined) ob.firstCampaignCreated = false;
  if (ob.tooltipsDone === undefined) ob.tooltipsDone = false;
  if (ob.tooltipsDismissedUntil === undefined) ob.tooltipsDismissedUntil = 0;
  if (ob.tooltipCampaignId === undefined) ob.tooltipCampaignId = '';
  if (ob.targetBrandType === undefined) ob.targetBrandType = null;
  if (ob.weeklyOutreachGoal === undefined) ob.weeklyOutreachGoal = null;
  return ob;
};

const isQuizNeeded = () => {
  const ob = ensureOnboardingQuiz();
  return ob.quizDone !== true;
};

const isOnboardingComplete = () => {
  const ob = ensureOnboardingQuiz();
  return ob.quizDone === true && ob.firstCampaignCreated === true && ob.tooltipsDone === true;
};

const areOnboardingTooltipsSnoozed = () => {
  const ob = ensureOnboardingQuiz();
  const dismissedUntil = Number(ob.tooltipsDismissedUntil) || 0;
  if (!dismissedUntil) return false;
  if (Date.now() < dismissedUntil) return true;
  ob.tooltipsDismissedUntil = 0;
  saveState();
  return false;
};

const dismissOnboardingTooltips = () => {
  const ob = ensureOnboardingQuiz();
  ob.tooltipsDismissedUntil = Date.now() + TOOLTIP_SNOOZE_MS;
  if (tooltipCampaignId) ob.tooltipCampaignId = tooltipCampaignId;
  saveState();
  tooltipCampaignId = null;
  clearAllTooltips();
  clearFieldTooltips();
  removeCampaignHighlight();
  const header = document.getElementById('campaign-onboarding-header');
  if (header) header.remove();
};

/* ── quiz overlay ───────────────────────────────────────────── */

let currentScreen = 1;

const getOverlay = () => document.getElementById('onboarding-quiz');

const showScreen = (n) => {
  currentScreen = n;
  const overlay = getOverlay();
  if (!overlay) return;
  overlay.querySelectorAll('.quiz-screen').forEach((el) => {
    el.classList.toggle('active', el.dataset.screen === String(n));
  });
  overlay.querySelectorAll('.quiz-dot').forEach((dot) => {
    dot.classList.toggle('active', Number(dot.dataset.dot) <= n);
  });
};

const openQuiz = () => {
  const overlay = getOverlay();
  if (!overlay) return;
  overlay.classList.add('open');
  showScreen(1);
};

const closeQuiz = () => {
  const overlay = getOverlay();
  if (!overlay) return;
  overlay.classList.remove('open');
};

const openGuidedCampaignModal = () => {
  renderAll();
  setActivePage('campaigns');
  setTimeout(() => {
    // Cadastro de campanha e em cards, igual ao resto do onboarding.
    if (abrirRegistroGuiado()) return;

    const openModal = window.__ugcModals?.openCampaignModal;
    if (typeof openModal === 'function') {
      openModal();
      setTimeout(() => injectOnboardingHeader(), 140);
      return;
    }
    const newCampaignButton = document.querySelector('.page-section[data-section="campaigns"] [data-action="new-campaign"]');
    if (newCampaignButton) {
      newCampaignButton.click();
      setTimeout(() => injectOnboardingHeader(), 180);
      return;
    }
    startCampaignHighlight();
  }, 180);
};

/* ── quiz actions ───────────────────────────────────────────── */

const handleQuizAction = (action, el) => {
  if (action === 'quiz-start') {
    showScreen(2);
    return true;
  }

  if (action === 'quiz-has-campaigns') {
    const ob = ensureOnboardingQuiz();
    const answer = el.dataset.value;
    ob.hasCampaigns = answer === 'yes';
    saveState();
    if (answer === 'yes') {
      // Quem ja tem campanha ativa vai direto descobrir quanto cobrar por ela.
      // O fluxo de precificacao termina levando ao registro guiado, entao a
      // tela 8 so continua valendo como fallback se o overlay nao existir.
      closeQuiz();
      if (!abrirFluxoDePrecificacao()) showScreen(8);
    } else {
      // Sem campanha fechada nao ha dado real para precificar, entao esse ramo
      // mostra como sera o cadastro da primeira. A tela 4 fica como fallback se
      // o overlay do fluxo nao existir.
      closeQuiz();
      if (!abrirFluxoPrimeiraCampanha()) showScreen(4);
    }
    return true;
  }

  if (action === 'quiz-campaign-count') {
    const ob = ensureOnboardingQuiz();
    ob.campaignCount = el.dataset.value || '0';
    saveState();
    showScreen(8); // final CTA for users WITH campaigns
    return true;
  }

  // ── Mini-wizard step 1: brand type ──
  if (action === 'quiz-brand-type') {
    const ob = ensureOnboardingQuiz();
    ob.targetBrandType = el.dataset.value || 'outra';
    saveState();
    showScreen(5); // step 2: outreach goal
    return true;
  }

  // ── Mini-wizard step 2: weekly outreach goal ──
  if (action === 'quiz-outreach-goal') {
    const ob = ensureOnboardingQuiz();
    ob.weeklyOutreachGoal = Number(el.dataset.value) || 5;
    saveState();
    showScreen(6); // step 3: create prospection campaign
    return true;
  }

  // ── Mini-wizard step 3: create model campaign ──
  if (action === 'quiz-create-prospection') {
    const ob = ensureOnboardingQuiz();
    createModelCampaign(ob.targetBrandType, ob.weeklyOutreachGoal);
    ob.quizDone = true;
    ob.firstCampaignCreated = true;
    saveState();
    closeQuiz();
    ensureOutreachTracking(ob.weeklyOutreachGoal);
    renderAll();
    setActivePage('campaigns');
    return true;
  }

  // ── Skip: go to campaigns ──
  if (action === 'quiz-go-campaigns') {
    const ob = ensureOnboardingQuiz();
    ob.quizDone = true;
    saveState();
    closeQuiz();
    openGuidedCampaignModal();
    return true;
  }

  if (action === 'quiz-go-prospection') {
    const ob = ensureOnboardingQuiz();
    ob.quizDone = true;
    saveState();
    closeQuiz();
    renderAll();
    setActivePage('prospeccao');
    setTimeout(() => {
      document.querySelector('[data-action="open-prospection-modal"]')?.click();
    }, 150);
    return true;
  }

  // ── "no campaigns" skip ──
  if (action === 'quiz-no-campaigns-skip') {
    showScreen(8);
    return true;
  }

  // ── Outreach +1 ──
  if (action === 'outreach-add') {
    incrementOutreach(el.dataset.campaignId);
    return true;
  }

  // ── Convert model to real ──
  if (action === 'convert-to-real') {
    convertModelToReal(el.dataset.campaignId);
    return true;
  }

  return false;
};

/* ── model campaign ─────────────────────────────────────────── */

const createModelCampaign = (brandType, outreachGoal) => {
  const brandLabels = {
    beleza: 'Beleza', moda: 'Moda', tech: 'Tech', local: 'Local', outra: 'Marca Ideal'
  };
  const brandLabel = brandLabels[brandType] || 'Marca Ideal';
  const nowIso = new Date().toISOString();

  const campaign = {
    id: `c-model-${Date.now()}`,
    title: `Prospecção - ${brandLabel}`,
    brand: `Prospecção - ${brandLabel}`,
    status: 'negociacao',
    stage: getDefaultCampaignStage('negociacao'),
    value: 0,
    barter: false,
    dueDate: '',
    startMethod: 'outbound',
    startMethodOther: '',
    paymentPercent: 0,
    paymentDate: '',
    contactName: '',
    contactEmail: '',
    paused: false,
    archived: false,
    priority: false,
    createdAt: nowIso,
    updatedAt: nowIso,
    isModel: true,
    modelMeta: {
      brandType: brandType || 'outra',
      weeklyGoal: outreachGoal || 5,
      outreachSent: 0
    }
  };
  state.campaigns.unshift(campaign);
  trackEvent('campaign_created', { campaignId: campaign.id, campaign });
  saveState();
};

/* ── outreach tracking ──────────────────────────────────────── */

const ensureOutreachTracking = (weeklyGoal) => {
  if (!state.progress.outreach) {
    state.progress.outreach = {
      weekStart: new Date().toISOString().slice(0, 10),
      sent: 0,
      goal: weeklyGoal || 5
    };
    saveState();
  }
};

const getOutreachProgress = () => {
  if (!state.progress.outreach) return null;
  return { sent: state.progress.outreach.sent || 0, goal: state.progress.outreach.goal || 5 };
};

const incrementOutreach = (campaignId) => {
  // Update global outreach tracking
  ensureOutreachTracking(5);
  state.progress.outreach.sent = (state.progress.outreach.sent || 0) + 1;

  // Also update the model campaign's own counter
  if (campaignId) {
    const campaign = state.campaigns.find((c) => c.id === campaignId);
    if (campaign && campaign.isModel && campaign.modelMeta) {
      campaign.modelMeta.outreachSent = (campaign.modelMeta.outreachSent || 0) + 1;
    }
  }

  saveState();
  renderAll();

  const p = getOutreachProgress();
  if (p && p.sent >= p.goal) {
    showToast(`Meta semanal atingida: ${p.goal} envios! ðŸŽ‰`);
  } else if (p) {
    showToast(`Proposta registrada! ${p.sent}/${p.goal} esta semana`);
  }
};

/* ── convert to real ────────────────────────────────────────── */

const convertModelToReal = (campaignId) => {
  const campaign = state.campaigns.find((c) => c.id === campaignId);
  if (!campaign || !campaign.isModel) return;

  delete campaign.isModel;
  delete campaign.modelMeta;
  campaign.brand = '';
  campaign.title = '';
  campaign.value = 0;
  campaign.dueDate = '';
  campaign.contactName = '';
  campaign.contactEmail = '';
  campaign.updatedAt = new Date().toISOString();
  saveState();
  renderAll();

  // Open edit modal
  setTimeout(() => {
    if (window.__ugcModals.openCampaignModal) {
      window.__ugcModals.openCampaignModal(campaignId);
    }
  }, 200);

  showToast('Preencha os dados da sua campanha real!');
};

/* ── campaign highlight (glow on "Nova campanha") ──────────── */

const startCampaignHighlight = () => {
  const ob = ensureOnboardingQuiz();
  if (ob.firstCampaignCreated || ob.tooltipsDone || areOnboardingTooltipsSnoozed()) return;

  setTimeout(() => {
    const btn = document.querySelector('[data-action="new-campaign"]');
    if (!btn) return;
    if (ob.firstCampaignCreated || ob.tooltipsDone || areOnboardingTooltipsSnoozed()) return;

    const host = btn.parentElement;
    if (!host) return;

    btn.classList.add('onboarding-glow');
    const tip = document.createElement('div');
    tip.className = 'onboarding-tooltip';
    tip.dataset.tooltipFor = 'new-campaign';
    tip.innerHTML = `
      <span class="onboarding-tooltip-text">Passo 1: clique em Nova campanha para iniciar seu cadastro.</span>
      <button class="onboarding-tooltip-close" type="button" aria-label="Fechar mensagem">&times;</button>
    `;
    tip.querySelector('.onboarding-tooltip-close').addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      dismissOnboardingTooltips();
    });

    if (window.getComputedStyle(host).position === 'static') {
      host.style.position = 'relative';
    }

    const dismissOnFollow = () => {
      removeCampaignHighlight();
    };
    btn.addEventListener('click', dismissOnFollow, { once: true });

    tip.style.top = `${btn.offsetTop + btn.offsetHeight + 10}px`;
    host.appendChild(tip);

    const hostRect = host.getBoundingClientRect();
    const viewportWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
    const horizontalPad = 16;
    const maxTooltipWidth = Math.max(120, viewportWidth - horizontalPad * 2);
    tip.style.maxWidth = `${maxTooltipWidth}px`;

    const tipWidth = tip.offsetWidth;
    const rawCenter = hostRect.left + btn.offsetLeft + btn.offsetWidth / 2;
    let safeLeft = rawCenter - tipWidth / 2;
    const minLeft = horizontalPad;
    const maxLeft = Math.max(minLeft, viewportWidth - horizontalPad - tipWidth);
    if (safeLeft < minLeft) safeLeft = minLeft;
    if (safeLeft > maxLeft) safeLeft = maxLeft;

    tip.style.left = `${safeLeft - hostRect.left}px`;
  }, 400);
};

const removeCampaignHighlight = () => {
  const btn = document.querySelector('[data-action="new-campaign"]');
  if (!btn) return;
  btn.classList.remove('onboarding-glow');
  const host = btn.parentElement;
  const tip = host.querySelector('.onboarding-tooltip[data-tooltip-for="new-campaign"]');
  if (tip) tip.remove();
};

/* ── post-creation tooltips ─────────────────────────────────── */

let tooltipStep = 0;
let tooltipCampaignId = null;

const startPostCreationTooltips = (campaignId) => {
  const ob = ensureOnboardingQuiz();
  if (ob.tooltipsDone || areOnboardingTooltipsSnoozed()) return;
  tooltipCampaignId = campaignId;
  ob.tooltipCampaignId = campaignId || ob.tooltipCampaignId || '';
  saveState();
  tooltipStep = 0;
  setTimeout(() => showNextTooltip(), 600);
};

const showNextTooltip = () => {
  clearAllTooltips();
  if (areOnboardingTooltipsSnoozed() || !tooltipCampaignId) return;
  const row = document.querySelector(`tr[data-campaign-id="${tooltipCampaignId}"]`);
  if (!row) return;

  if (tooltipStep === 0) {
    const statusSelect = row.querySelector('[data-campaign-status]');
    if (statusSelect) {
      statusSelect.classList.add('onboarding-highlight');
      attachTooltip(statusSelect, 'Você pode mudar o status conforme a campanha avança.', 'Entendi', () => {
        statusSelect.classList.remove('onboarding-highlight');
        tooltipStep = 1;
        showNextTooltip();
      });
    }
  } else if (tooltipStep === 1) {
    const stageSelect = row.querySelector('[data-campaign-stage]');
    if (stageSelect) {
      stageSelect.classList.add('onboarding-highlight');
      attachTooltip(stageSelect, 'E aqui você define exatamente em que etapa está.', 'Próximo', () => {
        stageSelect.classList.remove('onboarding-highlight');
        tooltipStep = 2;
        showNextTooltip();
      });
    }
  } else if (tooltipStep === 2) {
    const advanceBtn = row.querySelector('[data-action="advance-stage"]');
    if (advanceBtn) {
      advanceBtn.classList.add('onboarding-highlight');
      attachTooltip(advanceBtn, 'Quando a campanha avançar, clique aqui para seguir para a próxima etapa.', 'Entendi', () => {
        advanceBtn.classList.remove('onboarding-highlight');
        completeOnboarding();
      });
    } else {
      completeOnboarding();
    }
  }
};

const attachTooltip = (anchor, text, btnText, onDismiss) => {
  const tip = document.createElement('div');
  tip.className = 'onboarding-tip-bubble';
  tip.innerHTML = `
    <button class="onboarding-tip-close" type="button" aria-label="Fechar mensagem">&times;</button>
    <span class="onboarding-tip-arrow"></span>
    <p>${text}</p>
    <button class="btn btn-primary btn-small" type="button">${btnText}</button>
  `;
  tip.querySelector('.onboarding-tip-close').addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dismissOnboardingTooltips();
  });
  tip.querySelector('.btn').addEventListener('click', (e) => {
    e.stopPropagation();
    tip.remove();
    if (onDismiss) onDismiss();
  });
  document.body.appendChild(tip);

  const rect = anchor.getBoundingClientRect();
  const tipW = tip.offsetWidth;
  let left = rect.left + rect.width / 2 - tipW / 2;
  if (left < 8) left = 8;
  if (left + tipW > window.innerWidth - 8) left = window.innerWidth - 8 - tipW;
  tip.style.top  = (rect.bottom + window.scrollY + 12) + 'px';
  tip.style.left = left + 'px';

  const arrow = tip.querySelector('.onboarding-tip-arrow');
  const arrowLeft = rect.left + rect.width / 2 - left;
  arrow.style.left = arrowLeft + 'px';
};

const clearAllTooltips = () => {
  document.querySelectorAll('.onboarding-tip-bubble').forEach((el) => el.remove());
  document.querySelectorAll('.onboarding-highlight').forEach((el) => el.classList.remove('onboarding-highlight'));
};

const completeOnboarding = () => {
  clearAllTooltips();
  const ob = ensureOnboardingQuiz();
  ob.tooltipsDone = true;
  ob.tooltipsDismissedUntil = 0;
  ob.tooltipCampaignId = '';
  saveState();
};

/* ── listen for campaign creation ───────────────────────────── */

const initOnboardingListeners = () => {
  document.addEventListener('ugc:campaigns-changed', (e) => {
    const ob = ensureOnboardingQuiz();
    if (ob.tooltipsDone) return;

    const reason = e.detail.reason;
    const campaignId = e.detail.campaignId;

    if (reason === 'create' && !ob.firstCampaignCreated) {
      ob.firstCampaignCreated = true;
      ob.tooltipCampaignId = campaignId || ob.tooltipCampaignId || '';
      saveState();
      removeCampaignHighlight();
      clearFieldTooltips();

      const header = document.getElementById('campaign-onboarding-header');
      if (header) header.remove();

      setTimeout(() => {
        renderAll();
        if (!areOnboardingTooltipsSnoozed()) {
          setTimeout(() => startPostCreationTooltips(campaignId), 500);
        }
      }, 300);
    }
  });

  document.addEventListener('ugc:campaign-modal-opened', (e) => {
    const ob = ensureOnboardingQuiz();
    if (ob.firstCampaignCreated || ob.tooltipsDone || isOnboardingComplete() || areOnboardingTooltipsSnoozed()) return;
    const mode = String(e.detail.mode || '').trim();
    if (mode && mode !== 'create') return;
    setTimeout(() => injectOnboardingHeader(), 120);
  });
};

/* ── campaign modal onboarding header ───────────────────────── */

const injectOnboardingHeader = () => {
  // Onboarding guide box + field-by-field "Passo X/6" tooltips removed by request:
  // the campaign modal already has its own 1/2/3 step wizard, so this extra guide
  // was redundant clutter. Kept as a no-op so existing call sites stay harmless.
  return;
};

/* ── field-by-field tooltips inside Campaign modal ──────────── */

let fieldTooltipStep = 0;

const fieldTooltipDefs = [
  { step: 1, selector: '.campaign-brand-step [data-action="open-brand-modal"], select[name="brandId"]', text: 'Digite ou selecione o nome da marca. Se ela ainda não existe, toque em Nova marca e cadastre primeiro.', event: null },
  { step: 1, selector: 'select[name="startMethod"]', text: 'Depois escolha como essa campanha começou: Instagram, plataforma, agência, inbound ou outbound.', event: 'change' },
  { step: 2, selector: 'input[name="value"]', text: 'Informe o valor em dinheiro (se for permuta, pode deixar R$ 0).', event: 'input' },
  { step: 3, selector: 'input[name="dueDate"]', text: 'Defina o prazo principal da entrega.', event: 'change' },
  { step: 3, selector: 'select[name="nextActionType"]', text: 'Defina a próxima ação para não perder o follow-up.', event: 'change' },
  { step: 3, selector: '#campaign-form button[type="submit"]', text: 'Revise os campos e salve a campanha.', event: null }
];

const updateOnboardingHeaderState = (def) => {
  const header = document.getElementById('campaign-onboarding-header');
  if (!header) return;

  const label = header.querySelector('[data-onboarding-progress-label]');
  if (label) label.textContent = `Passo ${Math.min(fieldTooltipStep + 1, fieldTooltipDefs.length)}/${fieldTooltipDefs.length}`;

  const currentStep = Number(def?.step || 1);
  header.querySelectorAll('[data-onboarding-header-step]').forEach((item) => {
    const step = Number(item.dataset.onboardingHeaderStep || 0);
    item.classList.toggle('is-active', step === currentStep);
    item.classList.toggle('is-done', step < currentStep);
  });
};

const startFieldTooltips = () => {
  const ob = ensureOnboardingQuiz();
  if (ob.firstCampaignCreated || ob.tooltipsDone || isOnboardingComplete() || areOnboardingTooltipsSnoozed()) return;
  fieldTooltipStep = 0;
  showFieldTooltip();
};

const showFieldTooltip = () => {
  clearFieldTooltips();
  if (fieldTooltipStep >= fieldTooltipDefs.length || areOnboardingTooltipsSnoozed()) return;

  const def = fieldTooltipDefs[fieldTooltipStep];
  const form = document.getElementById('campaign-form');
  if (!form) return;
  updateOnboardingHeaderState(def);

  try {
    if (def.step && window.__ugcCampaignWizard.isEnabled()) {
      window.__ugcCampaignWizard.setStep(def.step);
    }
  } catch (error) {}

  const el = form.querySelector(def.selector);
  if (!el) { fieldTooltipStep++; showFieldTooltip(); return; }

  el.classList.add('onboarding-highlight');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const bubble = document.createElement('div');
  bubble.className = 'onboarding-field-tip';
  const stepLabel = `Passo ${fieldTooltipStep + 1}/${fieldTooltipDefs.length}: `;
  bubble.innerHTML = `
    <span class="onboarding-field-tip-text"><strong>${stepLabel}</strong>${def.text}</span>
    <span class="onboarding-field-tip-actions">
      <button class="onboarding-field-tip-next" type="button">Próximo</button>
      <button class="onboarding-field-tip-close" type="button">Pular</button>
    </span>
  `;

  const wrapper = el.closest('.form-row') || el.parentElement;
  const tipSlot = document.querySelector('[data-onboarding-tip-slot]');
  if (tipSlot) {
    tipSlot.replaceChildren(bubble);
  } else if (wrapper) {
    wrapper.appendChild(bubble);
  }

  let finished = false;
  let handler = null;
  const finishStep = () => {
    if (finished) return;
    finished = true;
    if (def.event && handler) el.removeEventListener(def.event, handler);
    el.classList.remove('onboarding-highlight');
    bubble.remove();
    fieldTooltipStep++;
    setTimeout(() => showFieldTooltip(), 350);
  };

  bubble.querySelector('.onboarding-field-tip-next')?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    finishStep();
  });

  bubble.querySelector('.onboarding-field-tip-close').addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (def.event && handler) el.removeEventListener(def.event, handler);
    el.classList.remove('onboarding-highlight');
    bubble.remove();
    dismissOnboardingTooltips();
  });

  if (def.event) {
    handler = () => {
      finishStep();
    };
    el.addEventListener(def.event, handler);
  }
};

const clearFieldTooltips = () => {
  document.querySelectorAll('.onboarding-field-tip').forEach((el) => el.remove());
  const form = document.getElementById('campaign-form');
  if (form) {
    form.querySelectorAll('.onboarding-highlight').forEach((el) => el.classList.remove('onboarding-highlight'));
  }
};

/* ── model campaign row rendering helpers ───────────────────── */

const renderModelOutreachBar = (campaign) => {
  if (!campaign.isModel || !campaign.modelMeta) return '';
  const meta = campaign.modelMeta;
  const sent = meta.outreachSent || 0;
  const goal = meta.weeklyGoal || 5;
  const pct = Math.min(100, Math.round((sent / goal) * 100));
  return `
    <div class="model-outreach-bar">
      <div class="model-outreach-info">
        <span>Propostas enviadas: <strong>${sent}/${goal}</strong></span>
        <button class="btn-outreach-add" data-action="outreach-add" data-campaign-id="${campaign.id}" type="button" title="Registrar proposta enviada">+ Enviei 1</button>
      </div>
      <div class="model-outreach-track">
        <div class="model-outreach-fill" style="width:${pct}%"></div>
      </div>
    </div>
  `;
};

const renderModelAdvanceBtn = (campaign) => {
  if (!campaign.isModel) return null;
  return `
    <button class="btn-convert-inline" data-action="convert-to-real" data-campaign-id="${campaign.id}" type="button">
      Trocar para campanha real
    </button>
  `;
};

/* ── public API ──────────────────────────────────────────────── */

const initOnboardingQuiz = () => {
  const ob = ensureOnboardingQuiz();
  initOnboardingListeners();

  // window.__ugcModals.openCampaignModal is registered by initActions using the
  // same modal.js module instance that binds the wizard buttons. Do NOT import
  // modal.js again here: a second import (different URL/version query) loads a
  // duplicate module instance with its own wizard state, which desyncs the
  // "Proximo" button from the open handler and silently breaks step navigation.

  if (isQuizNeeded()) {
    // Se o usuario ja respondeu "tenho campanha ativa" e parou no meio da
    // precificacao, retoma de onde parou em vez de reiniciar o quiz.
    if (ob.hasCampaigns === true && ob.pricing && ob.pricing.concluido !== true) {
      if (abrirFluxoDePrecificacao()) return;
    }
    // Mesma retomada para quem respondeu "ainda nao tenho campanha".
    if (ob.hasCampaigns === false && ob.primeiraCampanha && ob.primeiraCampanha.concluido !== true) {
      if (abrirFluxoPrimeiraCampanha()) return;
    }
    openQuiz();
    return;
  }

  if (!isOnboardingComplete()) {
    if (!ob.firstCampaignCreated) {
      startCampaignHighlight();
      return;
    }

    if (!areOnboardingTooltipsSnoozed() && ob.tooltipCampaignId) {
      startPostCreationTooltips(ob.tooltipCampaignId);
    }
  }
};

export {
  handleQuizAction,
  initOnboardingQuiz,
  injectOnboardingHeader,
  convertModelToReal,
  isOnboardingComplete,
  ensureOnboardingQuiz,
  startPostCreationTooltips,
  removeCampaignHighlight,
  startCampaignHighlight,
  clearFieldTooltips,
  getOutreachProgress,
  incrementOutreach
};
