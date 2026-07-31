import { state, saveState, campaignStatusOrder, getCampaignStageOptions, getDefaultCampaignStage, statusLabels, nextActionOptions, appendCampaignHistory as appendCampaignHistoryEntry } from './state.js';
import { setActivePage, showToast } from './ui.js?v=20260711a';
import { formatCurrency } from './state.js';
import { prospectionContactOptions, prospectionStatusOptions } from './state.js';
import { trackEvent } from './gamification.js?v=20260302g';
import { renderAll } from './renderers.js?v=20260628a';

import {
  closeCampaignModal,
  disableCampaignWizard,
  initCampaignForm,
  openCampaignModal,
  openCampaignPreview
} from '../features/campaigns/modal.js?v=20260728o';
import {
  closeBrandModal,
  initBrandForm,
  openBrandModal
} from '../features/brands/modal.js?v=20260623c';
import {
  closeBrandDeleteModal,
  initBrandDeleteFeature,
  openBrandDeleteModal
} from '../features/brands/delete.js?v=20260502c';
import {
  closeCampaignDeleteModal,
  initCampaignDeleteFeature,
  openCampaignDeleteModal
} from '../features/campaigns/delete.js?v=20260625b';
import { initScriptFlow } from '../features/scripts/flow.js?v=20260302f';
import {
  closeScriptDeleteModal,
  initScriptDeleteFeature,
  openScriptDeleteModal
} from '../features/scripts/delete.js?v=20260304c';
import { copyCurrentScript, copyScriptFromHistory, openScriptFromHistory } from '../features/scripts/history.js?v=20260302f';
import { openBillingCheckout, openBillingPortal } from '../features/settings/billing.js?v=20260628a';
import { clearCampaignAlertsCache, runCampaignAlerts } from '../features/settings/alerts.js?v=20260302f';
import { handleQuizAction, injectOnboardingHeader, convertModelToReal, ensureOnboardingQuiz } from '../features/onboarding/quiz.js?v=20260728o';
import { handleFirstCampaignFlowAction } from '../features/onboarding/first-campaign-flow.js?v=20260728o';
import { abrirRegistroGuiado, handleRegisterFlowAction, initRegisterFlow } from '../features/campaigns/register-flow.js?v=20260728o';
import { renderStageAction, alternarItemDoChecklist } from '../features/campaigns/stage-actions.js?v=20260728o';
import { abrirPrecificadorDaCampanha } from '../features/campaigns/pricing-modal.js?v=20260728o';
import { abrirRetrospectiva, fecharRetrospectiva } from '../features/campaigns/retrospective.js?v=20260728o';
import { registrarMudancaDeEtapa } from './campaigns/timeline.js?v=20260728o';

/**
 * Cadastrar campanha e sempre em cards, uma pergunta por tela. O modal padrao
 * continua valendo para edicao, e como fallback se o overlay dos cards nao
 * estiver na pagina.
 */
const abrirCadastroDeCampanha = () => {
  if (abrirRegistroGuiado()) return;
  openCampaignModal();
};

/* -- Money mask helper -- */
const formatMoneyInput = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  const value = parseInt(digits, 10) || 0;
  const formatted = value.toString().replace(/\B(=(:\d{3})+(!\d))/g, '.');
  return `R$ ${formatted}`;
};

const applyMoneyMask = (input) => {
  input.value = formatMoneyInput(input.value);
};

const parseMoneyInput = (raw) => parseInt(String(raw || '').replace(/\D/g, ''), 10) || 0;

const todayIso = () => new Date().toISOString().slice(0, 10);
const isPipelineModalViewport = () => Boolean(window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
const formatDateBR = (value) => {
  const safe = String(value || '').trim();
  if (!safe) return 'Sem prazo';
  const match = safe.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : safe;
};
const getCampaignById = (campaignId) => (Array.isArray(state.campaigns) ? state.campaigns : []).find((item) => item.id === campaignId) || null;
const getCampaignStageLabel = (campaign) => {
  if (!campaign) return 'Sem etapa';
  const option = getCampaignStageOptions(campaign.status).find((item) => item.id === campaign.stage);
  return option.label || campaign.stage || 'Sem etapa';
};
const campaignStartLabels = {
  ugc_platform: 'Plataforma de UGC',
  inbound: 'Inbound',
  outbound: 'Outbound',
  instagram: 'Instagram',
  agencia: 'Agência',
  comunidade: 'Grupo / Comunidade',
  other: 'Outro'
};
const getCampaignStartLabel = (campaign) => {
  const key = String(campaign.startMethod || '').trim();
  if (!key) return 'Não informado';
  if (key === 'other' && String(campaign.startMethodOther || '').trim()) return String(campaign.startMethodOther).trim();
  return campaignStartLabels[key] || key;
};
const getBrandActionTypeLabel = (brand) => {
  const type = String(brand.nextActionType || '').trim();
  if (!type) return 'Sem pendência';
  const option = nextActionOptions.includes(type) ? type : '';
  if (!option) return 'Sem pendência';
  const labels = {
    followup: 'Follow-up',
    enviar_proposta: 'Enviar proposta',
    cobrar_resposta: 'Cobrar resposta',
    enviar_roteiro: 'Enviar roteiro',
    cobrar_aprovacao: 'Cobrar aprovação',
    entregar_conteudo: 'Entregar conteúdo',
    revisar_ajustes: 'Revisar ajustes',
    cobrar_pagamento: 'Cobrar pagamento',
    outro: brand.nextActionCustomType || 'Outro'
  };
  return labels[option] || 'Sem pendência';
};

const escapeHtmlText = (value) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatFileSize = (size) => {
  const safe = Number(size) || 0;
  if (!safe) return 'Arquivo local';
  if (safe < 1024) return `${safe} B`;
  if (safe < 1024 * 1024) return `${Math.round(safe / 1024)} KB`;
  return `${(safe / (1024 * 1024)).toFixed(1)} MB`;
};

const campaignResourceCategoryLabels = {
  video: 'Vídeo',
  roteiro: 'Roteiro',
  briefing: 'Briefing',
  outro: 'Arquivo'
};

const normalizeCampaignResourceCategory = (value) => {
  const safe = String(value || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(campaignResourceCategoryLabels, safe) ? safe : 'outro';
};

const getCampaignResourceCategoryLabel = (value) =>
  campaignResourceCategoryLabels[normalizeCampaignResourceCategory(value)] || 'Arquivo';

const getCampaignDueModal = () => ({
  modal: document.getElementById('campaign-due-modal'),
  form: document.getElementById('campaign-due-form'),
  msg: document.getElementById('campaign-due-msg')
});

const getCampaignValueModal = () => ({
  modal: document.getElementById('campaign-value-modal'),
  form: document.getElementById('campaign-value-form'),
  msg: document.getElementById('campaign-value-msg')
});

const getCampaignPeekModal = () => ({
  modal: document.getElementById('campaign-peek-modal'),
  body: document.querySelector('[data-campaign-peek-body]'),
  title: document.querySelector('[data-campaign-peek-title]'),
  subtitle: document.querySelector('[data-campaign-peek-subtitle]'),
  editButton: document.querySelector('[data-action="edit-campaign-from-peek"]'),
  assetsButton: document.querySelector('[data-action="open-campaign-assets-from-peek"]')
});

const getCampaignAssetsModal = () => ({
  modal: document.getElementById('campaign-assets-modal'),
  form: document.getElementById('campaign-assets-form'),
  list: document.querySelector('[data-campaign-assets-list]'),
  msg: document.getElementById('campaign-assets-msg'),
  title: document.querySelector('[data-campaign-assets-title]'),
  subtitle: document.querySelector('[data-campaign-assets-subtitle]')
});

const setCampaignAssetsTypeVisibility = (value) => {
  const type = String(value || 'link').trim();
  const linkRow = document.querySelector('[data-resource-link-row]');
  const fileRow = document.querySelector('[data-resource-file-row]');
  const documentRow = document.querySelector('[data-resource-document-row]');
  const linkInput = document.querySelector('#campaign-assets-form input[name="url"]');
  const fileInput = document.querySelector('#campaign-assets-form input[name="file"]');
  const documentInput = document.querySelector('#campaign-assets-form textarea[name="content"]');

  if (linkRow) linkRow.style.display = type === 'link' ? '' : 'none';
  if (fileRow) fileRow.style.display = type === 'file' ? '' : 'none';
  if (documentRow) documentRow.style.display = type === 'document' ? '' : 'none';

  if (linkInput) linkInput.required = type === 'link';
  if (fileInput) fileInput.required = type === 'file';
  if (documentInput) documentInput.required = type === 'document';
};

const renderCampaignAssetsList = (campaignId) => {
  const campaign = getCampaignById(campaignId);
  const { list } = getCampaignAssetsModal();
  if (!list) return;
  if (!campaign) {
    list.innerHTML = '<p class="muted">Campanha não encontrada.</p>';
    return;
  }

  const resources = Array.isArray(campaign.resources) ? campaign.resources : [];
  if (!resources.length) {
    list.innerHTML = `
      <div class="campaign-assets-empty">
        <strong>Nenhum arquivo salvo ainda.</strong>
        <p class="muted">Guarde aqui vídeos, roteiros, briefings e outros arquivos importantes dessa campanha.</p>
      </div>
    `;
    return;
  }

  const typeMeta = {
    link: { label: 'Link', actionLabel: 'Abrir link' },
    file: { label: 'Arquivo', actionLabel: 'Baixar arquivo' },
    document: { label: 'Documento', actionLabel: 'Abrir documento' }
  };

  list.innerHTML = resources
    .map((resource) => {
      const meta = typeMeta[resource.type] || typeMeta.link;
      const categoryLabel = resource.type === 'file'
        ? getCampaignResourceCategoryLabel(resource.category)
        : meta.label;
      const secondaryText = resource.type === 'file'
        ? [resource.fileName || '', formatFileSize(resource.size)].filter(Boolean).join(' · ')
        : resource.type === 'link'
          ? resource.url
          : resource.note || 'Documento interno dessa campanha';
      const previewText = resource.type === 'document'
        ? String(resource.content || resource.note || '').slice(0, 180)
        : String(resource.note || '').slice(0, 180);

      return `
        <article class="campaign-assets-item">
          <div class="campaign-assets-item-copy">
            <span class="campaign-assets-item-type">${escapeHtmlText(categoryLabel)}</span>
            <strong class="campaign-assets-item-title">${escapeHtmlText(resource.title || meta.label)}</strong>
            ${secondaryText ? `<p class="campaign-assets-item-sub">${escapeHtmlText(secondaryText)}</p>` : ''}
            ${previewText ? `<p class="campaign-assets-item-note">${escapeHtmlText(previewText)}</p>` : ''}
          </div>
          <div class="campaign-assets-item-actions">
            <button class="btn btn-ghost btn-small" data-action="open-campaign-resource" data-campaign-id="${campaign.id}" data-resource-id="${resource.id}" type="button">${meta.actionLabel}</button>
            <button class="btn btn-danger btn-small" data-action="delete-campaign-resource" data-campaign-id="${campaign.id}" data-resource-id="${resource.id}" type="button">Excluir</button>
          </div>
        </article>
      `;
    })
    .join('');
};

const openCampaignAssetsModal = (campaignId) => {
  const campaign = getCampaignById(campaignId);
  const { modal, form, msg, title, subtitle } = getCampaignAssetsModal();
  if (!campaign || !modal || !form) return;

  form.reset();
  form.elements.campaignId.value = campaign.id;
  if (form.elements.resourceType) form.elements.resourceType.value = 'file';
  if (form.elements.resourceCategory) form.elements.resourceCategory.value = 'video';
  if (msg) msg.textContent = '';
  if (title) title.textContent = campaign.title || campaign.brand || 'Armazenador de arquivos';
  if (subtitle) subtitle.textContent = campaign.brand
    ? `${campaign.brand} · vídeos, roteiros e briefings dessa campanha.`
    : 'Guarde os arquivos importantes dessa campanha.';

  renderCampaignAssetsList(campaign.id);
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  const fileInput = form.querySelector('input[name="file"]');
  if (fileInput) fileInput.focus();
};

const closeCampaignAssetsModal = () => {
  const { modal, form, list, msg, title, subtitle } = getCampaignAssetsModal();
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  if (form) form.reset();
  if (form.elements.resourceType) form.elements.resourceType.value = 'file';
  if (form.elements.resourceCategory) form.elements.resourceCategory.value = 'video';
  if (list) list.innerHTML = '';
  if (msg) msg.textContent = '';
  if (title) title.textContent = 'Armazenador de arquivos';
  if (subtitle) subtitle.textContent = 'Guarde vídeos, roteiros e briefings em um só lugar.';
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Não foi possível ler o arquivo.'));
    reader.readAsDataURL(file);
  });

const normalizeResourceUrl = (value) => {
  const safe = String(value || '').trim();
  if (!safe) return '';
  if (/^https:\/\//i.test(safe) || /^data:/i.test(safe)) return safe;
  return `https://${safe}`;
};

const openCampaignResourceItem = (campaignId, resourceId) => {
  const campaign = getCampaignById(campaignId);
  const resource = (Array.isArray(campaign.resources) ? campaign.resources : []).find((item) => item.id === resourceId);
  if (!resource) {
    showToast('Material não encontrado.');
    return;
  }

  if (resource.type === 'document') {
    const popup = window.open('', '_blank', 'noopener');
    if (!popup) {
      showToast('Não consegui abrir o documento agora.');
      return;
    }
    popup.document.write(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtmlText(resource.title || 'Documento da campanha')}</title>
          <style>
            body { font-family: Manrope, sans-serif; background:#0f1724; color:#f8fafc; margin:0; padding:32px; }
            h1 { margin:0 0 12px; font-size:28px; }
            p { color:#9fb0c9; line-height:1.6; }
            pre { white-space:pre-wrap; word-break:break-word; background:#142033; border:1px solid rgba(148,163,184,.18); border-radius:18px; padding:20px; color:#f8fafc; font-family:inherit; font-size:16px; line-height:1.7; }
          </style>
        </head>
        <body>
          <h1>${escapeHtmlText(resource.title || 'Documento')}</h1>
          ${resource.note ? `<p>${escapeHtmlText(resource.note)}</p>` : ''}
          <pre>${escapeHtmlText(resource.content || '')}</pre>
        </body>
      </html>
    `);
    popup.document.close();
    return;
  }

  if (!resource.url) {
    showToast('Esse material não tem link disponível.');
    return;
  }

  if (resource.type === 'file') {
    const isVideo = String(resource.mimeType || '').toLowerCase().startsWith('video/') || resource.category === 'video';
    if (isVideo) {
      const popup = window.open('', '_blank', 'noopener');
      if (!popup) {
        showToast('Não consegui abrir esse vídeo agora.');
        return;
      }
      popup.document.write(`
        <!doctype html>
        <html lang="pt-BR">
          <head>
            <meta charset="utf-8" />
            <title>${escapeHtmlText(resource.title || resource.fileName || 'Vídeo da campanha')}</title>
            <style>
              body { font-family: Manrope, sans-serif; background:#08111d; color:#f8fafc; margin:0; padding:24px; display:grid; gap:18px; }
              h1 { margin:0; font-size:28px; }
              p { margin:0; color:#9fb0c9; line-height:1.6; }
              video { width:min(100%, 980px); max-height:80vh; border-radius:20px; background:#000; }
            </style>
          </head>
          <body>
            <h1>${escapeHtmlText(resource.title || resource.fileName || 'Vídeo')}</h1>
            ${resource.note ? `<p>${escapeHtmlText(resource.note)}</p>` : ''}
            <video controls src="${escapeHtmlText(resource.url)}"></video>
          </body>
        </html>
      `);
      popup.document.close();
      return;
    }

    const anchor = document.createElement('a');
    anchor.href = resource.url;
    anchor.download = resource.fileName || resource.title || 'arquivo';
    anchor.rel = 'noopener';
    anchor.click();
    return;
  }

  window.open(resource.url, '_blank', 'noopener');
};

const openCampaignDueModal = (campaignId) => {
  const campaign = getCampaignById(campaignId);
  const { modal, form, msg } = getCampaignDueModal();
  if (!campaign || !modal || !form) return;
  form.reset();
  form.elements.campaignId.value = campaign.id;
  form.elements.dueDate.value = campaign.dueDate || '';
  if (msg) msg.textContent = '';
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  form.elements.dueDate.focus();
};

const closeCampaignDueModal = () => {
  const { modal, form, msg } = getCampaignDueModal();
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  if (form) form.reset();
  if (msg) msg.textContent = '';
};

const openCampaignValueModal = (campaignId) => {
  const campaign = getCampaignById(campaignId);
  const { modal, form, msg } = getCampaignValueModal();
  if (!campaign || !modal || !form) return;
  form.reset();
  form.elements.campaignId.value = campaign.id;
  form.elements.value.value = formatMoneyInput(campaign.value || 0) || 'R$ 0';
  if (msg) msg.textContent = '';
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  form.elements.value.focus();
};

const closeCampaignValueModal = () => {
  const { modal, form, msg } = getCampaignValueModal();
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  if (form) form.reset();
  if (msg) msg.textContent = '';
};

const openCampaignPeekModal = (campaignId) => {
  const campaign = getCampaignById(campaignId);
  const { modal, body, title, subtitle, editButton, assetsButton } = getCampaignPeekModal();
  if (!campaign || !modal || !body || !title || !subtitle || !editButton || !assetsButton) return;

  title.textContent = campaign.title || campaign.brand || 'Campanha';
  subtitle.textContent = campaign.brand ? `${campaign.brand} · resumo rápido do cadastro` : 'Resumo rápido do cadastro';
  editButton.dataset.campaignId = campaign.id;
  assetsButton.dataset.campaignId = campaign.id;

  const paidPercent = Number.isFinite(campaign.paymentPercent) ? campaign.paymentPercent : parseInt(String(campaign.paymentPercent || '0'), 10) || 0;
  const paymentLabel = campaign.paymentReceivedAt
    ? `Recebido em ${formatDateBR(campaign.paymentReceivedAt)}`
    : campaign.paymentDate
      ? `Previsto para ${formatDateBR(campaign.paymentDate)}`
      : 'Sem data definida';
  const metaItems = [
    { label: 'De onde veio', value: getCampaignStartLabel(campaign) },
    { label: 'Permuta', value: campaign.barter ? 'Sim' : 'Não' },
    { label: '% já pago', value: `${paidPercent}%` },
    { label: 'Data de pagamento', value: paymentLabel },
    { label: 'Etapa atual', value: getCampaignStageLabel(campaign) },
    { label: 'Prazo', value: formatDateBR(campaign.dueDate) },
    {
      label: 'Entregas previstas',
      value: `${Number.isFinite(campaign.photoCount) ? campaign.photoCount : 0} foto(s) · ${Number.isFinite(campaign.videoCount) ? campaign.videoCount : 0} vídeo(s)`
    },
    { label: 'Arquivos armazenados', value: `${(Array.isArray(campaign.resources) ? campaign.resources : []).length} item(ns)` }
  ];

  // A ação da etapa atual vem antes do cadastro: é o que a pessoa veio fazer.
  body.innerHTML = renderStageAction(campaign) + metaItems
    .map(
      (item) => `
        <article class="campaign-peek-item">
          <span class="campaign-peek-item-label">${item.label}</span>
          <strong class="campaign-peek-item-value">${item.value}</strong>
        </article>
      `
    )
    .join('');

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
};

const closeCampaignPeekModal = () => {
  const { modal, body, title, subtitle, editButton, assetsButton } = getCampaignPeekModal();
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  if (body) body.innerHTML = '';
  if (title) title.textContent = 'Campanha';
  if (subtitle) subtitle.textContent = 'Resumo rápido do cadastro.';
  if (editButton) delete editButton.dataset.campaignId;
  if (assetsButton) delete assetsButton.dataset.campaignId;
};

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
  const brands = (Array.isArray(state.brands) ? state.brands : []).slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR'));
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

const getProspectionById = (prospectionId) =>
  (Array.isArray(state.prospections) ? state.prospections : []).find((item) => item.id === prospectionId) || null;

const getProspectionModal = () => ({
  modal: document.getElementById('prospection-modal'),
  form: document.getElementById('prospection-form'),
  msg: document.getElementById('prospection-msg'),
  title: document.querySelector('[data-prospection-modal-title]'),
  deleteButton: document.getElementById('prospection-delete-inline-btn')
});

const PROSPECTION_WIZARD_TOTAL = 3;
let prospectionWizardEnabled = false;
let prospectionWizardStep = 1;

const getProspectionWizardRefs = () => {
  const { form, deleteButton } = getProspectionModal();
  return {
    form,
    steps: form ? Array.from(form.querySelectorAll('[data-prospection-step]')) : [],
    progress: form ? form.querySelector('[data-prospection-wizard-progress]') : null,
    progressSteps: form ? Array.from(form.querySelectorAll('[data-prospection-wizard-progress] .modal-wizard-step')) : [],
    nav: form ? form.querySelector('[data-prospection-wizard-actions]') : null,
    submitActions: form ? form.querySelector('[data-prospection-submit-actions]') : null,
    nextBtn: document.getElementById('prospection-step-next-btn'),
    deleteButton
  };
};

const applyProspectionWizardStep = () => {
  const { form, steps, progress, progressSteps, nav, submitActions, nextBtn, deleteButton } = getProspectionWizardRefs();
  if (!form) return;

  steps.forEach((row) => {
    const step = Number(row.dataset.prospectionStep || 1);
    row.classList.toggle('modal-step-hidden', prospectionWizardEnabled && step !== prospectionWizardStep);
  });

  if (progress) progress.style.display = prospectionWizardEnabled ? '' : 'none';
  if (nav) nav.style.display = prospectionWizardEnabled ? '' : 'none';
  if (submitActions) submitActions.style.display = !prospectionWizardEnabled || prospectionWizardStep >= PROSPECTION_WIZARD_TOTAL ? '' : 'none';

  progressSteps.forEach((item) => {
    const step = Number(item.dataset.step || 0);
    item.classList.toggle('is-active', prospectionWizardEnabled && step === prospectionWizardStep);
    item.classList.toggle('is-done', prospectionWizardEnabled && step < prospectionWizardStep);
  });

  if (nextBtn) {
    if (!prospectionWizardEnabled || prospectionWizardStep >= PROSPECTION_WIZARD_TOTAL) {
      nextBtn.style.display = 'none';
    } else {
      nextBtn.style.display = '';
      nextBtn.textContent = 'Próximo';
      nextBtn.disabled = false;
    }
  }

  if (deleteButton && prospectionWizardEnabled) {
    if (prospectionWizardStep < PROSPECTION_WIZARD_TOTAL) {
      deleteButton.style.display = 'none';
    } else {
      deleteButton.style.display = deleteButton.dataset.prospectionId ? '' : 'none';
    }
  }
};

const setProspectionWizardMode = () => {
  prospectionWizardEnabled = true;
  prospectionWizardStep = 1;
  applyProspectionWizardStep();
};

const setProspectionWizardStep = (step) => {
  if (!prospectionWizardEnabled) return false;
  const next = Math.max(1, Math.min(PROSPECTION_WIZARD_TOTAL, Number(step) || 1));
  prospectionWizardStep = next;
  applyProspectionWizardStep();
  return true;
};

const advanceProspectionWizardStep = () => {
  const { form, msg } = getProspectionModal();
  if (!form || !prospectionWizardEnabled) return;

  const brandInput = form.elements.brand;
  if (prospectionWizardStep === 1 && !String(brandInput.value || '').trim()) {
    if (msg) msg.textContent = 'Informe a marca para continuar.';
    if (brandInput) brandInput.focus();
    return;
  }

  if (msg) msg.textContent = '';
  setProspectionWizardStep(prospectionWizardStep + 1);
};

const openProspectionModal = (prospectionId = '') => {
  const { modal, form, msg, title, deleteButton } = getProspectionModal();
  if (!modal || !form) return;

  const item = prospectionId ? getProspectionById(prospectionId) : null;
  form.reset();
  if (msg) msg.textContent = '';

  form.elements.id.value = item?.id || '';
  form.elements.brand.value = item?.brand || '';
  form.elements.contactType.value = prospectionContactOptions.includes(String(item?.contactType || '').trim()) ? item.contactType : 'dm_instagram';
  form.elements.script.value = item?.script || '';
  form.elements.status.value = prospectionStatusOptions.includes(String(item?.status || '').trim()) ? item.status : 'pendente';
  form.elements.notes.value = item?.notes || '';

  if (title) title.textContent = item ? 'Editar prospecção' : 'Nova prospecção';
  if (deleteButton) {
    if (item) {
      deleteButton.style.display = '';
      deleteButton.dataset.prospectionId = item.id;
    } else {
      deleteButton.style.display = 'none';
      delete deleteButton.dataset.prospectionId;
    }
  }
  setProspectionWizardMode();

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  form.elements.brand.focus();
};

const closeProspectionModal = () => {
  const { modal, form, msg, title, deleteButton } = getProspectionModal();
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  if (form) form.reset();
  if (msg) msg.textContent = '';
  if (title) title.textContent = 'Nova prospecção';
  if (deleteButton) {
    deleteButton.style.display = 'none';
    delete deleteButton.dataset.prospectionId;
  }
  prospectionWizardEnabled = false;
  prospectionWizardStep = 1;
  applyProspectionWizardStep();
};

const handleProspectionSubmit = (event) => {
  event.preventDefault();
  const { form, msg } = getProspectionModal();
  if (!form) return;

  const data = new FormData(form);
  const id = String(data.get('id') || '').trim();
  const brand = String(data.get('brand') || '').trim().slice(0, 120);
  const contactTypeRaw = String(data.get('contactType') || '').trim();
  const statusRaw = String(data.get('status') || '').trim();
  const script = String(data.get('script') || '').trim().slice(0, 4000);
  const notes = String(data.get('notes') || '').trim().slice(0, 2000);
  const contactType = prospectionContactOptions.includes(contactTypeRaw) ? contactTypeRaw : 'dm_instagram';
  const status = prospectionStatusOptions.includes(statusRaw) ? statusRaw : 'pendente';

  if (msg) msg.textContent = '';
  if (!brand) {
    if (msg) msg.textContent = 'Informe a marca para salvar a prospecção.';
    return;
  }

  const nowIso = new Date().toISOString();
  state.prospections = Array.isArray(state.prospections) ? state.prospections : [];
  const current = id ? getProspectionById(id) : null;

  if (current) {
    current.brand = brand;
    current.contactType = contactType;
    current.script = script;
    current.status = status;
    current.notes = notes;
    current.updatedAt = nowIso;
  } else {
    state.prospections.unshift({
      id: `p-${Date.now()}`,
      brand,
      contactType,
      script,
      status,
      notes,
      createdAt: nowIso,
      updatedAt: nowIso
    });
  }

  saveState();
  renderAll();
  closeProspectionModal();
  showToast(current ? 'Prospecção atualizada.' : 'Prospecção criada.');
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
  brand.updatedAt = new Date().toISOString();

  saveState();
  renderAll();
  closeBrandActionModal();
  showToast('Ação da marca salva.');
};

const handleCampaignDueSubmit = (event) => {
  event.preventDefault();
  const { form, msg } = getCampaignDueModal();
  if (!form) return;

  const campaign = getCampaignById(String(form.elements.campaignId.value || '').trim());
  if (!campaign) {
    if (msg) msg.textContent = 'Campanha não encontrada.';
    return;
  }

  campaign.dueDate = String(form.elements.dueDate.value || '').trim();
  campaign.updatedAt = new Date().toISOString();
  saveState();
  renderAll();
  closeCampaignDueModal();
  showToast('Prazo atualizado.');
};

const handleCampaignValueSubmit = (event) => {
  event.preventDefault();
  const { form, msg } = getCampaignValueModal();
  if (!form) return;

  const campaign = getCampaignById(String(form.elements.campaignId.value || '').trim());
  if (!campaign) {
    if (msg) msg.textContent = 'Campanha não encontrada.';
    return;
  }

  campaign.value = Math.max(0, parseMoneyInput(form.elements.value.value));
  campaign.updatedAt = new Date().toISOString();
  saveState();
  renderAll();
  closeCampaignValueModal();
  showToast('Valor atualizado.');
};

const handleCampaignAssetsSubmit = async (event) => {
  event.preventDefault();
  const { form, msg } = getCampaignAssetsModal();
  if (!form) return;

  const campaign = getCampaignById(String(form.elements.campaignId.value || '').trim());
  if (!campaign) {
    if (msg) msg.textContent = 'Campanha não encontrada.';
    return;
  }

  const category = normalizeCampaignResourceCategory(form.elements.resourceCategory.value || 'video');
  const note = String(form.elements.note.value || '').trim().slice(0, 240);
  const fileInput = form.querySelector('input[name="file"]');
  const selectedFiles = Array.from(fileInput.files || []);

  if (msg) msg.textContent = '';
  if (!selectedFiles.length) {
    if (msg) msg.textContent = 'Escolha pelo menos um arquivo para salvar.';
    return;
  }

  try {
    const nowIso = new Date().toISOString();
    const resources = await Promise.all(
      selectedFiles.map(async (selectedFile, index) => ({
        id: `cr-${Date.now()}-${index}`,
        type: 'file',
        category,
        title: selectedFile.name || `${getCampaignResourceCategoryLabel(category)} ${index + 1}`,
        url: await readFileAsDataUrl(selectedFile),
        note,
        fileName: selectedFile.name || '',
        mimeType: selectedFile.type || '',
        size: Number(selectedFile.size) || 0,
        content: '',
        createdAt: nowIso
      }))
    );

    campaign.resources = Array.isArray(campaign.resources) ? campaign.resources : [];
    campaign.resources.unshift(...resources);
    campaign.updatedAt = nowIso;

    saveState();
    renderAll();
    renderCampaignAssetsList(campaign.id);

    form.reset();
    form.elements.campaignId.value = campaign.id;
    if (form.elements.resourceType) form.elements.resourceType.value = 'file';
    if (form.elements.resourceCategory) form.elements.resourceCategory.value = category;
    showToast(resources.length === 1 ? 'Arquivo salvo na campanha.' : `${resources.length} arquivos salvos na campanha.`);
  } catch (error) {
    if (msg) msg.textContent = 'Não consegui salvar esses arquivos agora.';
  }
};

/* Posi\u00e7\u00e3o global de (status, stage) no pipeline.
   Total: 15 posi\u00e7\u00f5es, 14 transi\u00e7\u00f5es -> 100 XP para pipeline completo. */
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

/**
 * Chegar em "Pago" fecha o ciclo: a retrospectiva abre sozinha, porque é o
 * momento em que o resultado do trabalho inteiro faz sentido junto.
 */
const celebrarSePago = (campaign) => {
  if (!campaign || campaign.stage !== 'pago') return;
  setTimeout(() => abrirRetrospectiva(campaign.id), 220);
};

/* ── confirmação de precificação ao entrar em "Escopo definido" ── */

const getScopePricingModal = () => document.getElementById('scope-pricing-modal');

let campanhaDoEscopo = '';

const fecharModalDeEscopo = () => {
  const modal = getScopePricingModal();
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  campanhaDoEscopo = '';
};

/**
 * "Escopo definido" é o único micro que pergunta algo ao ser marcado: é o ponto
 * do ciclo em que dá para calcular preço com informação real. Só abre quando a
 * campanha entra na etapa; remarcar a mesma etapa não repete a pergunta.
 */
const perguntarSobrePrecificacao = (campaign, etapaAnterior) => {
  if (!campaign || campaign.stage !== 'escopo_definido') return;
  if (etapaAnterior === 'escopo_definido') return;
  const modal = getScopePricingModal();
  if (!modal) return;

  campanhaDoEscopo = campaign.id;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
};

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

const isInteractiveCampaignTarget = (target) => {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      'button, select, input, textarea, label, a, [data-action], .custom-select, .custom-select-dropdown, .custom-select-option'
    )
  );
};

const handleCampaignRowClick = (event) => {
  const row = event.target.closest('[data-campaign-row]');
  if (!row || isInteractiveCampaignTarget(event.target)) return;

  const campaignId = String(row.dataset.campaignId || '').trim();
  if (!campaignId) return;
  openCampaignPeekModal(campaignId);
};

const handleCampaignRowKeydown = (event) => {
  const row = event.target.closest('[data-campaign-row]');
  if (!row) return;
  if (event.key !== 'Enter' && event.key !== ' ') return;
  if (isInteractiveCampaignTarget(event.target)) return;

  event.preventDefault();
  const campaignId = String(row.dataset.campaignId || '').trim();
  if (!campaignId) return;
  openCampaignPeekModal(campaignId);
};

const handleActionClick = (event) => {
  const actionEl = event.target.closest('[data-action]');
  if (!actionEl) return;

  const action = actionEl.dataset.action;

  // Quiz / onboarding actions
  if (handleRegisterFlowAction(action, actionEl)) return;
  if (handleFirstCampaignFlowAction(action, actionEl)) return;
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
    window.location.replace('app.html');
    return;
  }

  if (action === 'toggle-menu') {
    // Este clique sÃ³ controla a gaveta mobile. Impede que ouvintes genÃ©ricos
    // adicionados por widgets da tela processem o mesmo evento e a fechem logo em seguida.
    event.stopImmediatePropagation();
    document.body.classList.toggle('sidebar-open');
    return;
  }

  if (action === 'close-menu') {
    event.stopImmediatePropagation();
    document.body.classList.remove('sidebar-open');
    return;
  }

  if (action === 'close-focus-modal') {
    const modal = document.getElementById('focus-modal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    const msg = document.getElementById('focus-modal-msg');
    if (msg) msg.textContent = '';
    return;
  }

  if (action === 'confirm-focus-modal') {
    if (state.focus && typeof state.focus === 'object') {
      const current = Number(state.focus.current) || 0;
      const target = Number(state.focus.target) || 0;
      state.focus.current = target > 0 ? Math.min(current + 1, target) : current + 1;
      saveState();
      renderAll();
    }
    const modal = document.getElementById('focus-modal');
    if (modal) {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }
    return;
  }

  if (action === 'goto-scripts') {
    setActivePage('campaigns');
    return;
  }

  if (action === 'goto-plans') {
    setActivePage('plans');
    saveState();
    renderAll();
    return;
  }

  if (action === 'open-billing-checkout') {
    const plan = String(actionEl.dataset.plan || '').trim();
    void openBillingCheckout(plan);
    return;
  }

  if (action === 'open-billing-portal') {
    void openBillingPortal();
    return;
  }

  if (action === 'goto-metrics' || action === 'goto-performance') {
    setActivePage('metrics');
    saveState();
    renderAll();
    return;
  }

  if (action === 'goto-performance-financial') {
    setActivePage('finance');
    return;
  }

  if (action === 'goto-finance') {
    setActivePage('finance');
    saveState();
    renderAll();
    return;
  }

  if (action === 'goto-campaigns') {
    state.ui.campaignDashboardFilter = '';
    state.ui.campaignFilter = 'all';
    saveState();
    setActivePage('campaigns');
    renderAll();
    return;
  }

  if (action === 'toggle-dashboard-pipeline-panel') {
    const pipelineFilter = String(actionEl.dataset.pipelineFilter || '').trim();
    if (!pipelineFilter) return;
    state.ui.dashboardPipelineOpen = isPipelineModalViewport()
      ? pipelineFilter
      : state.ui.dashboardPipelineOpen === pipelineFilter
        ? ''
        : pipelineFilter;
    saveState();
    renderAll();
    return;
  }

  if (action === 'close-dashboard-pipeline-modal') {
    state.ui.dashboardPipelineOpen = '';
    saveState();
    renderAll();
    return;
  }

  if (action === 'close-metrics-status-modal') {
    state.ui.metricsStatusOpen = '';
    saveState();
    renderAll();
    return;
  }

  if (action === 'open-dashboard-pipeline-filter') {
    const pipelineFilter = String(actionEl.dataset.pipelineFilter || '').trim();
    const statusByPipelineFilter = {
      negociacao: 'negociacao',
      producao: 'producao',
      entrega: 'entrega',
      concluida: 'concluida',
      aprovacao: 'producao',
      concluidas: 'concluida'
    };
    if (!pipelineFilter) return;
    state.ui.campaignDashboardFilter = pipelineFilter;
    state.ui.campaignFilter = statusByPipelineFilter[pipelineFilter] || 'all';
    state.ui.dashboardPipelineOpen = pipelineFilter;
    saveState();
    setActivePage('campaigns');
    renderAll();
    return;
  }

  if (action === 'open-metrics-status') {
    const status = String(actionEl.dataset.metricsStatus || '').trim();
    if (!['negociacao', 'producao', 'entrega', 'concluida'].includes(status)) return;
    state.ui.metricsStatusOpen = status;
    saveState();
    renderAll();
    return;
  }

  if (action === 'open-metrics-campaigns') {
    const status = String(actionEl.dataset.metricsStatus || '').trim();
    if (!status) return;
    state.ui.campaignDashboardFilter = '';
    state.ui.campaignFilter = ['negociacao', 'producao', 'entrega', 'concluida'].includes(status) ? status : 'all';
    state.ui.metricsStatusOpen = '';
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

  if (action === 'open-prospection-modal') {
    openProspectionModal();
    return;
  }

  if (action === 'prospection-step-next') {
    advanceProspectionWizardStep();
    return;
  }

  if (action === 'edit-prospection') {
    const prospectionId = String(actionEl.dataset.prospectionId || '').trim();
    if (!prospectionId) return;
    openProspectionModal(prospectionId);
    return;
  }

  if (action === 'close-prospection-modal') {
    closeProspectionModal();
    return;
  }

  if (action === 'delete-prospection') {
    const prospectionId = String(actionEl.dataset.prospectionId || '').trim();
    if (!prospectionId) return;
    state.prospections = (Array.isArray(state.prospections) ? state.prospections : []).filter((item) => item.id !== prospectionId);
    saveState();
    renderAll();
    closeProspectionModal();
    showToast('Prospecção removida.');
    return;
  }

  if (action === 'toggle-finance-campaign') {
    const campaignId = String(actionEl.dataset.campaignId || '').trim();
    if (!campaignId) return;
    state.ui.financeExpandedCampaignId = state.ui.financeExpandedCampaignId === campaignId ? '' : campaignId;
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
    if (!brand || !brand.email) {
      showToast('Essa marca não tem e-mail cadastrado.');
      return;
    }
    copyText(brand.email, 'E-mail copiado.');
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
    abrirCadastroDeCampanha();
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

  if (action === 'open-campaign-due-modal') {
    const campaignId = String(actionEl.dataset.campaignId || '').trim();
    if (campaignId) openCampaignDueModal(campaignId);
    return;
  }

  if (action === 'close-campaign-due-modal') {
    closeCampaignDueModal();
    return;
  }

  if (action === 'open-campaign-value-modal') {
    const campaignId = String(actionEl.dataset.campaignId || '').trim();
    if (campaignId) openCampaignValueModal(campaignId);
    return;
  }

  if (action === 'close-campaign-value-modal') {
    closeCampaignValueModal();
    return;
  }

  if (action === 'close-campaign-peek-modal') {
    closeCampaignPeekModal();
    return;
  }

  if (action === 'open-campaign-assets-from-peek') {
    const campaignId = String(actionEl.dataset.campaignId || '').trim();
    if (!campaignId) return;
    closeCampaignPeekModal();
    openCampaignAssetsModal(campaignId);
    return;
  }

  if (action === 'open-campaign-assets-from-modal') {
    const campaignId = String(actionEl.dataset.campaignId || '').trim();
    if (!campaignId) return;
    closeCampaignModal();
    window.setTimeout(() => openCampaignAssetsModal(campaignId), 120);
    return;
  }

  if (action === 'open-campaign-assets-modal') {
    const campaignId = String(actionEl.dataset.campaignId || '').trim();
    if (campaignId) openCampaignAssetsModal(campaignId);
    return;
  }

  if (action === 'close-campaign-assets-modal') {
    closeCampaignAssetsModal();
    return;
  }

  if (action === 'edit-campaign-from-peek') {
    const campaignId = String(actionEl.dataset.campaignId || '').trim();
    closeCampaignPeekModal();
    if (campaignId) openCampaignModal(campaignId);
    return;
  }

  if (action === 'open-campaign-resource') {
    const campaignId = String(actionEl.dataset.campaignId || '').trim();
    const resourceId = String(actionEl.dataset.resourceId || '').trim();
    if (!campaignId || !resourceId) return;
    openCampaignResourceItem(campaignId, resourceId);
    return;
  }

  if (action === 'delete-campaign-resource') {
    const campaignId = String(actionEl.dataset.campaignId || '').trim();
    const resourceId = String(actionEl.dataset.resourceId || '').trim();
    const campaign = getCampaignById(campaignId);
    if (!campaign || !resourceId) return;
    campaign.resources = (Array.isArray(campaign.resources) ? campaign.resources : []).filter((item) => item.id !== resourceId);
    campaign.updatedAt = new Date().toISOString();
    saveState();
    renderAll();
    renderCampaignAssetsList(campaign.id);
    showToast('Arquivo removido.');
    return;
  }

  if (action === 'open-campaign') {
    const id = actionEl.dataset.campaignId;
    if (id) {
      setActivePage('campaigns');
      setTimeout(() => { if (window.__ugcModals.openCampaignModal) window.__ugcModals.openCampaignModal(id); }, 120);
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

  /* -- Performance tabs -- */
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
    const current = state.settings.monthlyGoal || 0;
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
    abrirCadastroDeCampanha();
    injectOnboardingHeader();
    return;
  }

  if (action === 'edit-campaign') {
    const id = actionEl.dataset.campaignId;
    if (!id) return;
    closeCampaignPeekModal();
    openCampaignModal(id);
    return;
  }

  /* ── ações da etapa atual ─────────────────────────────────── */

  if (action === 'copy-stage-message') {
    const bloco = actionEl.closest('[data-stage-action]');
    const texto = bloco ? String(bloco.querySelector('[data-stage-message]')?.textContent || '') : '';
    if (!texto) return;
    copyText(texto, 'Mensagem copiada.');
    return;
  }

  if (action === 'open-campaign-pricing') {
    const id = String(actionEl.dataset.campaignId || '').trim();
    if (!id) return;
    closeCampaignPeekModal();
    abrirPrecificadorDaCampanha(id);
    return;
  }

  if (action === 'open-campaign-retrospective') {
    const id = String(actionEl.dataset.campaignId || '').trim();
    if (!id) return;
    closeCampaignPeekModal();
    abrirRetrospectiva(id);
    return;
  }

  if (action === 'close-campaign-retrospective') {
    fecharRetrospectiva();
    return;
  }

  // Selo da linha da campanha: leva direto para a ação da etapa atual.
  if (action === 'open-campaign-actions') {
    const id = String(actionEl.dataset.campaignId || '').trim();
    if (id) openCampaignPeekModal(id);
    return;
  }

  if (action === 'scope-pricing-calculate') {
    const id = campanhaDoEscopo;
    fecharModalDeEscopo();
    if (id) abrirPrecificadorDaCampanha(id);
    return;
  }

  // "Marcar sem calcular agora" e o clique fora só confirmam a etapa, que já
  // foi gravada antes do modal aparecer.
  if (action === 'scope-pricing-skip' || action === 'close-scope-pricing') {
    fecharModalDeEscopo();
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
      status: 'negociacao',
      stage: getDefaultCampaignStage('negociacao'),
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
      registrarMudancaDeEtapa(campaign, { status: campaign.status, stage: nextStage.id });
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
      celebrarSePago(campaign);
      perguntarSobrePrecificacao(campaign, currentStage);
    } else if (!isLastStatus) {
      const previousStatus = campaign.status;
      const nextStatus = campaignStatusOrder[currentStatusIndex + 1];
      registrarMudancaDeEtapa(campaign, { status: nextStatus, stage: getDefaultCampaignStage(nextStatus) });
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
      celebrarSePago(campaign);
      perguntarSobrePrecificacao(campaign, currentStage);
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
      showToast('Você pode priorizar no máximo 2 campanhas.');
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
  if (target === 'campaigns') {
    trackEvent('campaigns_viewed');
    saveState();
    renderAll();
  }
  if (target === 'brands') {
    saveState();
    renderAll();
  }
  if (target === 'prospeccao') {
    saveState();
    renderAll();
  }
  if (target === 'finance') {
    saveState();
    renderAll();
  }
  if (target === 'metrics') {
    saveState();
    renderAll();
  }
  if (target === 'plans') {
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
  return found.label || stageId || 'Sem etapa';
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
    const range = Number(target.value);
    state.ui.financeRangeDays = [0, 15, 30, 45, 90].includes(range) ? range : 30;
    state.ui.financeExpandedCampaignId = '';
    saveState();
    renderAll();
    return;
  }

  if (target.matches('[data-metrics-range]')) {
    const range = Number(target.value);
    state.ui.metricsRangeDays = [0, 15, 30, 45, 90].includes(range) ? range : 30;
    saveState();
    renderAll();
    return;
  }

  if (target.matches('[data-prospection-status]')) {
    const prospectionId = String(target.dataset.prospectionId || '').trim();
    const item = getProspectionById(prospectionId);
    if (!item) return;
    const statusRaw = String(target.value || '').trim();
    item.status = prospectionStatusOptions.includes(statusRaw) ? statusRaw : 'pendente';
    item.updatedAt = new Date().toISOString();
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
    
    registrarMudancaDeEtapa(campaign, { status: newStatus, stage: getDefaultCampaignStage(newStatus) });

    const previousStatusLabel = statusLabels[previousStatus] || previousStatus;
    const nextStatusLabel = statusLabels[campaign.status] || campaign.status;
    const previousStageLabel = getStageLabelForHistory(previousStatus, previousStage);
    const nextStageLabel = getStageLabelForHistory(campaign.status, campaign.stage);
    const statusDirection = delta > 0 ? 'advanced' : delta < 0 ? 'regressed' : 'updated';

    appendCampaignHistoryEntry(campaign, {
      type: statusDirection === 'advanced' ? 'status_advanced' : statusDirection === 'regressed' ? 'status_regressed' : 'status_updated',
      title: statusDirection === 'advanced' ? 'Status avançou' : statusDirection === 'regressed' ? 'Status regrediu' : 'Status atualizado',
      description: `${previousStatusLabel} -> ${nextStatusLabel}`,
      occurredAt: campaign.updatedAt
    });

    if (campaign.stage && campaign.stage !== previousStage) {
      appendCampaignHistoryEntry(campaign, {
        type: delta < 0 ? 'stage_regressed' : 'stage_advanced',
        title: delta < 0 ? 'Etapa regrediu' : 'Etapa avançou',
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
    celebrarSePago(campaign);
    perguntarSobrePrecificacao(campaign, previousStage);
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
    registrarMudancaDeEtapa(campaign, {
      status: campaign.status,
      stage: isValid ? nextStage : getDefaultCampaignStage(campaign.status)
    });

    appendCampaignHistoryEntry(campaign, {
      type: stageDelta > 0 ? 'stage_advanced' : stageDelta < 0 ? 'stage_regressed' : 'stage_updated',
      title: stageDelta > 0 ? 'Etapa avançou' : stageDelta < 0 ? 'Etapa regrediu' : 'Etapa atualizada',
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
    celebrarSePago(campaign);
    perguntarSobrePrecificacao(campaign, previousStage);
    return;
  }

  // Checklist de gravação, dentro do detalhe da campanha.
  if (target.matches('[data-stage-checklist-item]')) {
    const bloco = target.closest('[data-stage-action]');
    const campaignId = String(bloco?.dataset.campaignId || '').trim();
    const campanha = alternarItemDoChecklist(campaignId, target.dataset.stageChecklistItem, target.checked);
    if (!campanha) return;
    const item = target.closest('.stage-checklist-item');
    if (item) item.classList.toggle('is-done', target.checked);
    const contador = bloco.querySelector('.stage-action-badge');
    if (contador) {
      const total = bloco.querySelectorAll('[data-stage-checklist-item]').length;
      const feitos = bloco.querySelectorAll('[data-stage-checklist-item]:checked').length;
      contador.textContent = `${feitos}/${total}`;
    }
    return;
  }

  if (target.matches('[data-brand-status]')) {
    const brandId = target.dataset.brandId;
    const brand = (Array.isArray(state.brands) ? state.brands : []).find((item) => item.id === brandId);
    if (!brand) return;
    brand.status = ['lead', 'negociando', 'cliente_ativo', 'cliente_recorrente', 'inativa', 'perdida'].includes(target.value) ? target.value : 'lead';
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

  /* -- Metas Financeiras -- */
  if (target.matches('[data-goals]')) {
    const key = target.dataset.goals;
    state.settings[key] = target.type === 'number' ? Number(target.value) || 0 : target.value;
    saveState();
    showToast('Meta atualizada.');
    return;
  }

  /* -- Perfil do Criador -- */
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

  /* -- Configuração da IA -- */
  if (target.matches('[data-ai]')) {
    const key = target.dataset.ai;
    state.settings[key] = target.value;
    saveState();
    showToast('Configuração de IA salva.');
    return;
  }

  /* -- Alertas Inteligentes -- */
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

  /* -- Campaign sort -- */
  if (target.matches('[data-campaign-sort]')) {
    state.ui.campaignSort = target.value || 'updatedAt';
    saveState();
    renderAll();
    return;
  }
};

const initActions = () => {
  const safeInit = (label, fn) => {
    try {
      fn();
    } catch (error) {
      console.warn(`[initActions] ${label} falhou`, error);
    }
  };

  safeInit('initScriptFlow', initScriptFlow);
  safeInit('initScriptDeleteFeature', initScriptDeleteFeature);
  safeInit('initBrandForm', initBrandForm);
  safeInit('initBrandDeleteFeature', initBrandDeleteFeature);
  safeInit('initCampaignForm', initCampaignForm);
  safeInit('initCampaignDeleteFeature', initCampaignDeleteFeature);

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

  const campaignDueForm = document.getElementById('campaign-due-form');
  if (campaignDueForm && campaignDueForm.dataset.bound !== '1') {
    campaignDueForm.dataset.bound = '1';
    campaignDueForm.addEventListener('submit', handleCampaignDueSubmit);
  }

  const campaignValueForm = document.getElementById('campaign-value-form');
  if (campaignValueForm && campaignValueForm.dataset.bound !== '1') {
    campaignValueForm.dataset.bound = '1';
    campaignValueForm.addEventListener('submit', handleCampaignValueSubmit);

    const valueInput = campaignValueForm.querySelector('input[data-money]');
    if (valueInput) {
      valueInput.addEventListener('input', () => applyMoneyMask(valueInput));
      valueInput.addEventListener('blur', () => {
        valueInput.value = formatMoneyInput(valueInput.value) || 'R$ 0';
      });
      valueInput.addEventListener('focus', () => {
        if (!String(valueInput.value || '').trim()) valueInput.value = 'R$ 0';
        try {
          valueInput.setSelectionRange(valueInput.value.length, valueInput.value.length);
        } catch (error) {}
      });
    }
  }

  const campaignAssetsForm = document.getElementById('campaign-assets-form');
  if (campaignAssetsForm && campaignAssetsForm.dataset.bound !== '1') {
    campaignAssetsForm.dataset.bound = '1';
    campaignAssetsForm.addEventListener('submit', handleCampaignAssetsSubmit);

    const typeSelect = campaignAssetsForm.querySelector('select[name="resourceType"]');
    if (typeSelect) {
      typeSelect.addEventListener('change', () => {
        setCampaignAssetsTypeVisibility(typeSelect.value);
      });
      setCampaignAssetsTypeVisibility(typeSelect.value);
    }
  }

  const prospectionForm = document.getElementById('prospection-form');
  if (prospectionForm && prospectionForm.dataset.bound !== '1') {
    prospectionForm.dataset.bound = '1';
    prospectionForm.addEventListener('submit', handleProspectionSubmit);
  }

  const prospectionSearchInput = document.querySelector('[data-prospection-search]');
  if (prospectionSearchInput && prospectionSearchInput.dataset.bound !== '1') {
    prospectionSearchInput.dataset.bound = '1';
    prospectionSearchInput.addEventListener('input', () => {
      state.ui.prospectionSearch = String(prospectionSearchInput.value || '').slice(0, 120);
      saveState();
      renderAll();
    });
  }

  // Expose modal functions for quiz convert-to-real flow e para os fluxos de
  // onboarding (preview e registro guiado), que precisam da mesma instancia do
  // modulo do modal.
  window.__ugcModals = {
    openCampaignModal,
    closeCampaignModal,
    openCampaignPreview,
    disableCampaignWizard,
    abrirCadastroDeCampanha
  };
  initRegisterFlow();

  if (document.body.dataset.actionsBound !== '2') {
    // O seletor mobile intercepta alguns cliques no documento. Registrar os
    // delegadores na fase de captura garante que botoes, navegacao, filtros e
    // linhas do app continuem respondendo mesmo depois de interacoes com
    // selects customizados.
    document.body.dataset.actionsBound = '2';
    document.addEventListener('click', handleActionClick, true);
    document.addEventListener('click', handleNavClick, true);
    document.addEventListener('click', handleFilterClick, true);
    document.addEventListener('click', handleCampaignRowClick, true);
    document.body.addEventListener('change', handleChange);
    document.body.addEventListener('submit', handleBrandInteractionSubmit);
    document.body.addEventListener('keydown', handleCampaignRowKeydown);
    document.body.addEventListener('keydown', (event) => {
      const actionCard = event.target.closest('[data-dashboard-card-link]');
      if (!actionCard) return;
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      actionCard.click();
    });
  }

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
