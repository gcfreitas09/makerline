import { state, saveState, getDefaultCampaignStage, nextActionOptions } from '../../core/state.js';
import { renderAll } from '../../core/renderers.js?v=20260502c';
import { showToast } from '../../core/ui.js?v=20260502c';
import { trackEvent } from '../../core/gamification.js?v=20260302g';
import { populateCampaignBrandSelect } from '../brands/modal.js?v=20260502c';

const getCampaignModal = () => ({
  modal: document.getElementById('campaign-modal'),
  form: document.getElementById('campaign-form'),
  msg: document.getElementById('campaign-msg'),
  title: document.querySelector('[data-campaign-modal-title]'),
  subtitle: document.querySelector('[data-campaign-modal-subtitle]'),
  assetsButton: document.getElementById('campaign-assets-header-btn')
});

const formatMoneyBRL = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  const value = parseInt(digits, 10) || 0;
  const formatted = value.toString().replace(/\B(=(\d{3})+(!\d))/g, '.');
  return `R$ ${formatted}`;
};

const parseMoneyBRL = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : 0;
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const campaignResourceCategoryLabels = {
  video: 'Vídeo',
  roteiro: 'Roteiro',
  briefing: 'Briefing'
};
let campaignDraftResources = [];

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Não foi possível ler o arquivo.'));
    reader.readAsDataURL(file);
  });

const formatDraftFileSize = (size) => {
  const safe = Number(size) || 0;
  if (!safe) return 'Arquivo local';
  if (safe < 1024) return `${safe} B`;
  if (safe < 1024 * 1024) return `${Math.round(safe / 1024)} KB`;
  return `${(safe / (1024 * 1024)).toFixed(1)} MB`;
};

const normalizeCampaignResourceCategory = (value) => {
  const safe = String(value || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(campaignResourceCategoryLabels, safe) ? safe : 'video';
};

const getCampaignResourceCategoryLabel = (value) =>
  campaignResourceCategoryLabels[normalizeCampaignResourceCategory(value)] || 'Arquivo';

const getCampaignDraftFilesRefs = () => {
  const form = document.getElementById('campaign-form');
  return {
    form,
    categorySelect: form.querySelector('select[name="draftResourceCategory"]') || null,
    fileInput: form.querySelector('input[name="draftFiles"]') || null,
    list: document.querySelector('[data-campaign-draft-list]'),
    msg: document.getElementById('campaign-draft-files-msg'),
    addButton: document.getElementById('campaign-draft-files-btn')
  };
};

const renderCampaignDraftResources = () => {
  const { list, msg } = getCampaignDraftFilesRefs();
  if (!list) return;

  if (!campaignDraftResources.length) {
    list.innerHTML = `
      <div class="campaign-assets-empty">
        <strong>Nenhum arquivo separado ainda.</strong>
        <p class="muted">Adicione vídeos, roteiro e briefing agora ou volte depois pela própria campanha.</p>
      </div>
    `;
    if (msg && !String(msg.textContent || '').trim()) msg.textContent = '';
    return;
  }

  list.innerHTML = campaignDraftResources
    .map((resource) => `
      <article class="campaign-assets-item">
        <div class="campaign-assets-item-copy">
          <span class="campaign-assets-item-type">${getCampaignResourceCategoryLabel(resource.category)}</span>
          <strong class="campaign-assets-item-title">${resource.fileName}</strong>
          <p class="campaign-assets-item-sub">${formatDraftFileSize(resource.size)}</p>
          ${resource.note ? `<p class="campaign-assets-item-note">${resource.note}</p>` : ''}
        </div>
        <div class="campaign-assets-item-actions">
          <button class="btn btn-danger btn-small" data-draft-resource-remove="${resource.id}" type="button">Remover</button>
        </div>
      </article>
    `)
    .join('');
};

const resetCampaignDraftResources = () => {
  campaignDraftResources = [];
  const { form, msg, fileInput } = getCampaignDraftFilesRefs();
  if (msg) msg.textContent = '';
  if (fileInput) fileInput.value = '';
  if (form.elements.draftResourceCategory) form.elements.draftResourceCategory.value = 'video';
  renderCampaignDraftResources();
};

const addCampaignDraftFiles = async () => {
  const { form, categorySelect, fileInput, msg } = getCampaignDraftFilesRefs();
  if (!form || !categorySelect || !fileInput) return;

  const files = Array.from(fileInput.files || []);
  if (!files.length) {
    if (msg) msg.textContent = 'Escolha pelo menos um arquivo para separar nessa campanha.';
    return;
  }

  const category = normalizeCampaignResourceCategory(categorySelect.value);
  const note = '';
  if (msg) msg.textContent = '';

  try {
    const nowIso = new Date().toISOString();
    const draftedResources = await Promise.all(
      files.map(async (file, index) => ({
        id: `cdr-${Date.now()}-${index}`,
        type: 'file',
        category,
        title: file.name || getCampaignResourceCategoryLabel(category),
        url: await readFileAsDataUrl(file),
        note,
        fileName: file.name || `${getCampaignResourceCategoryLabel(category)} ${index + 1}`,
        mimeType: file.type || '',
        size: Number(file.size) || 0,
        content: '',
        createdAt: nowIso
      }))
    );

    campaignDraftResources = [...draftedResources, ...campaignDraftResources];
    fileInput.value = '';
    renderCampaignDraftResources();
    if (msg) {
      msg.textContent =
        draftedResources.length === 1
          ? '1 arquivo pronto para ser salvo com a campanha.'
          : `${draftedResources.length} arquivos prontos para serem salvos com a campanha.`;
    }
  } catch (error) {
    if (msg) msg.textContent = 'Não consegui preparar esses arquivos agora.';
  }
};

const getBrandById = (brandId) => (Array.isArray(state.brands) ? state.brands : []).find((brand) => brand.id === brandId) || null;

const getCampaignBrandValue = (select) => {
  if (!select) return '';

  let value = String(select.value || '').trim();
  if (!value) {
    const selectedOption = select.options[select.selectedIndex] || null;
    value = String(selectedOption.value || '').trim();
  }

  if (!value) {
    const pendingId = String(state.ui.pendingCampaignBrandId || '').trim();
    if (pendingId && Array.from(select.options).some((option) => String(option.value || '').trim() === pendingId)) {
      select.value = pendingId;
      value = pendingId;
    }
  }

  if (!value) {
    const nonEmptyOptions = Array.from(select.options).filter((option) => String(option.value || '').trim() !== '');
    if (nonEmptyOptions.length === 1) {
      value = String(nonEmptyOptions[0].value || '').trim();
      select.value = value;
    }
  }

  return value;
};

const toggleNextActionCustomRow = (form, value) => {
  const customRow = document.getElementById('campaign-next-action-custom-row');
  const customInput = form.querySelector('input[name="nextActionCustomType"]');
  const show = value === 'outro';
  if (customRow) customRow.style.display = show ? '' : 'none';
  if (customInput) {
    customInput.required = show;
    if (!show) customInput.value = '';
  }
};

const setModalMode = ({ mode, campaign }) => {
  const { title, subtitle, assetsButton } = getCampaignModal();
  const isEdit = mode === 'edit';
  if (title) title.textContent = isEdit ? 'Editar campanha' : 'Nova campanha';
  if (subtitle) subtitle.textContent = isEdit ? 'Atualize o que precisar e salve.' : 'Só o básico para começar.';

  if (assetsButton) {
    assetsButton.style.display = isEdit ? '' : 'none';
    if (isEdit && campaign.id) assetsButton.dataset.campaignId = campaign.id;
    else delete assetsButton.dataset.campaignId;
  }
  const { form } = getCampaignModal();
  if (!form) return;
  form.dataset.mode = mode || 'create';
  form.dataset.campaignId = campaign?.id || '';
  form.querySelectorAll('[data-campaign-create-only]').forEach((element) => {
    element.style.display = isEdit ? 'none' : '';
  });
};

const CAMPAIGN_WIZARD_TOTAL = 3;
let campaignWizardEnabled = false;
let campaignWizardStep = 1;

const getCampaignWizardRefs = () => {
  const form = document.getElementById('campaign-form');
  return {
    form,
    steps: form ? Array.from(form.querySelectorAll('[data-campaign-step]')) : [],
    progress: form ? form.querySelector('[data-campaign-wizard-progress]') : null,
    progressSteps: form ? Array.from(form.querySelectorAll('.campaign-wizard-step')) : [],
    nav: form ? form.querySelector('[data-campaign-wizard-actions]') : null,
    prevBtn: document.getElementById('campaign-step-prev-btn'),
    nextBtn: document.getElementById('campaign-step-next-btn')
  };
};

const applyCampaignWizardStep = () => {
  const { form, steps, progress, progressSteps, nav, prevBtn, nextBtn } = getCampaignWizardRefs();
  if (!form) return;

  steps.forEach((row) => {
    const step = Number(row.dataset.campaignStep || 1);
    row.classList.toggle('campaign-step-hidden', campaignWizardEnabled && step !== campaignWizardStep);
  });

  if (progress) progress.style.display = campaignWizardEnabled ? '' : 'none';
  if (nav) nav.style.display = campaignWizardEnabled ? '' : 'none';

  progressSteps.forEach((item) => {
    const step = Number(item.dataset.step || 0);
    const active = campaignWizardEnabled && step === campaignWizardStep;
    item.classList.toggle('is-active', active);
    item.classList.toggle('is-done', campaignWizardEnabled && step < campaignWizardStep);
    item.setAttribute('aria-current', active ? 'step' : 'false');
  });

  if (prevBtn) prevBtn.style.visibility = campaignWizardEnabled && campaignWizardStep > 1 ? 'visible' : 'hidden';
  if (nextBtn) {
    if (!campaignWizardEnabled || campaignWizardStep >= CAMPAIGN_WIZARD_TOTAL) {
      nextBtn.style.display = 'none';
    } else {
      nextBtn.style.display = '';
      nextBtn.textContent = 'Próximo';
      nextBtn.disabled = false;
    }
  }
};

const setCampaignWizardMode = (mode) => {
  campaignWizardEnabled = mode === 'create';
  campaignWizardStep = 1;
  applyCampaignWizardStep();
};

const setCampaignWizardStep = (step) => {
  if (!campaignWizardEnabled) return false;
  const next = Math.max(1, Math.min(CAMPAIGN_WIZARD_TOTAL, Number(step) || 1));
  campaignWizardStep = next;
  applyCampaignWizardStep();
  return true;
};

const openCampaignModal = (campaignId) => {
  const { modal, form, msg } = getCampaignModal();
  if (!modal || !form) return;

  form.reset();
  resetCampaignDraftResources();
  const valueInput = form.querySelector('input[name="value"]');
  const barterSelect = form.querySelector('select[name="barter"]');
  if (valueInput) valueInput.value = 'R$ 0';
  if (barterSelect) barterSelect.value = '0';

  const paymentPresetSelect = form.querySelector('select[name="paymentPreset"]');
  if (paymentPresetSelect) paymentPresetSelect.value = '0';
  const paymentDateInput = form.querySelector('input[name="paymentDate"]');
  if (paymentDateInput) paymentDateInput.value = '';
  const paymentReceivedInput = form.querySelector('input[name="paymentReceivedAt"]');
  if (paymentReceivedInput) paymentReceivedInput.value = '';

  const startMethodSelect = form.querySelector('select[name="startMethod"]');
  if (startMethodSelect) startMethodSelect.value = '';
  const startOtherRow = document.getElementById('campaign-start-other-row');
  if (startOtherRow) startOtherRow.style.display = 'none';
  const startOtherInput = form.querySelector('input[name="startMethodOther"]');
  if (startOtherInput) startOtherInput.value = '';

  const contactNameInput = form.querySelector('input[name="contactName"]');
  const contactEmailInput = form.querySelector('input[name="contactEmail"]');
  const brandSelect = form.querySelector('select[name="brandId"]');
  const nextActionTypeSelect = form.querySelector('select[name="nextActionType"]');
  const nextActionDateInput = form.querySelector('input[name="nextActionDate"]');
  const nextActionNoteInput = form.querySelector('input[name="nextActionNote"]');
  const nextActionCustomInput = form.querySelector('input[name="nextActionCustomType"]');
  const photoCountInput = form.querySelector('input[name="photoCount"]');
  const videoCountInput = form.querySelector('input[name="videoCount"]');
  if (contactNameInput) contactNameInput.value = '';
  if (contactEmailInput) contactEmailInput.value = '';
  if (nextActionTypeSelect) nextActionTypeSelect.value = '';
  if (nextActionDateInput) nextActionDateInput.value = '';
  if (nextActionNoteInput) nextActionNoteInput.value = '';
  if (nextActionCustomInput) nextActionCustomInput.value = '';
  if (photoCountInput) photoCountInput.value = '';
  if (videoCountInput) videoCountInput.value = '';
  toggleNextActionCustomRow(form, '');
  populateCampaignBrandSelect(state.ui.pendingCampaignBrandId || '');

  if (msg) msg.textContent = '';

  if (campaignId) {
    const campaign = state.campaigns.find((item) => item.id === campaignId);
    if (campaign) {
      setModalMode({ mode: 'edit', campaign });
      const idInput = form.querySelector('input[name="id"]');
      if (idInput) idInput.value = campaign.id;

      if (brandSelect) {
        populateCampaignBrandSelect(campaign.brandId || state.ui.pendingCampaignBrandId || '');
        brandSelect.value = campaign.brandId || state.ui.pendingCampaignBrandId || '';
        getCampaignBrandValue(brandSelect);
      }

      if (valueInput) valueInput.value = formatMoneyBRL(campaign.value) || 'R$ 0';
      if (barterSelect) barterSelect.value = campaign.barter ? '1' : '0';

      const dueInput = form.querySelector('input[name="dueDate"]');
      if (dueInput) dueInput.value = campaign.dueDate || '';

      if (photoCountInput) photoCountInput.value = Number.isFinite(campaign.photoCount) ? campaign.photoCount : '';
      if (videoCountInput) videoCountInput.value = Number.isFinite(campaign.videoCount) ? campaign.videoCount : '';

      const hoursInput = form.querySelector('input[name="estimatedHours"]');
      if (hoursInput) hoursInput.value = campaign.estimatedHours || '';

      if (startMethodSelect) {
        startMethodSelect.value = campaign.startMethod || '';
        if (startMethodSelect.value === 'other') {
          if (startOtherRow) startOtherRow.style.display = '';
          if (startOtherInput) startOtherInput.value = campaign.startMethodOther || '';
        }
      }

      if (paymentPresetSelect) {
        const raw = Number.isFinite(campaign.paymentPercent)
          ? campaign.paymentPercent
          : parseInt(campaign.paymentPercent, 10);
        const clamped = Number.isFinite(raw) ? Math.max(0, Math.min(100, Math.round(raw))) : 0;
        paymentPresetSelect.value = clamped >= 100 ? '100' : clamped > 0 ? '50' : '0';
      }
      if (paymentDateInput) paymentDateInput.value = campaign.paymentDate || '';
      if (paymentReceivedInput) paymentReceivedInput.value = campaign.paymentReceivedAt || '';

      // Contato
      if (contactNameInput) contactNameInput.value = campaign.contactName || '';
      if (contactEmailInput) contactEmailInput.value = campaign.contactEmail || '';
      if (nextActionTypeSelect) nextActionTypeSelect.value = campaign.nextActionType || '';
      if (nextActionDateInput) nextActionDateInput.value = campaign.nextActionDate || '';
      if (nextActionNoteInput) nextActionNoteInput.value = campaign.nextActionNote || '';
      if (nextActionCustomInput) nextActionCustomInput.value = campaign.nextActionCustomType || '';
      toggleNextActionCustomRow(form, campaign.nextActionType || '');

      const lifeSelect = form.querySelector('select[name="lifecycle"]');
      if (lifeSelect) {
        const lifecycle = campaign.archived ? 'archived' : campaign.paused ? 'paused' : 'active';
        lifeSelect.value = lifecycle;
      }
    }
  } else {
    setModalMode({ mode: 'create', campaign: null });
    const idInput = form.querySelector('input[name="id"]');
    if (idInput) idInput.value = '';
    if (brandSelect) {
      populateCampaignBrandSelect(state.ui.pendingCampaignBrandId || '');
      const selectedBrandId = getCampaignBrandValue(brandSelect);
      const selectedBrand = getBrandById(selectedBrandId);
      if (selectedBrand) {
        if (contactNameInput && !contactNameInput.value) contactNameInput.value = selectedBrand.contact || '';
        if (contactEmailInput && !contactEmailInput.value) contactEmailInput.value = selectedBrand.email || '';
      }
    }

    // Pre-preenchimento vindo do fluxo de precificacao do onboarding: valor
    // sugerido e quantidade de entregas, para o usuario nao redigitar o que ja
    // respondeu. Continua editavel, e so um ponto de partida.
    const prefill = state.ui.pendingCampaignPrefill;
    if (prefill && typeof prefill === 'object') {
      // Number(null) e 0, entao null precisa ser descartado antes da conversao,
      // senao um campo que o fluxo deixou em branco vira um zero explicito.
      const numeroDoPrefill = (valor) => {
        if (valor === null || valor === undefined || valor === '') return null;
        const convertido = Number(valor);
        return Number.isFinite(convertido) ? convertido : null;
      };

      const valorSugerido = numeroDoPrefill(prefill.value);
      const fotos = numeroDoPrefill(prefill.photoCount);
      const videos = numeroDoPrefill(prefill.videoCount);

      if (valueInput && valorSugerido !== null) valueInput.value = formatMoneyBRL(valorSugerido) || 'R$ 0';
      if (photoCountInput && fotos !== null) photoCountInput.value = fotos;
      if (videoCountInput && videos !== null) videoCountInput.value = videos;
    }
  }

  setCampaignWizardMode(campaignId ? 'edit' : 'create');

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');

  // Show/hide inline delete button
  const inlineDeleteBtn = document.getElementById('campaign-delete-inline-btn');
  if (inlineDeleteBtn) {
    if (campaignId) {
      inlineDeleteBtn.style.display = '';
      inlineDeleteBtn.dataset.campaignId = campaignId;
    } else {
      inlineDeleteBtn.style.display = 'none';
      delete inlineDeleteBtn.dataset.campaignId;
    }
  }

  state.ui.pendingCampaignBrandId = null;
  state.ui.pendingCampaignPrefill = null;

  try {
    document.dispatchEvent(new CustomEvent('ugc:campaign-modal-opened', {
      detail: {
        campaignId: campaignId || '',
        mode: campaignId ? 'edit' : 'create'
      }
    }));
  } catch (error) {}

  if (brandSelect) brandSelect.focus();
};

const closeCampaignModal = () => {
  const { modal, form, msg } = getCampaignModal();
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  if (form) form.reset();
  resetCampaignDraftResources();
  if (msg) msg.textContent = '';
  if (form) {
    delete form.dataset.mode;
    delete form.dataset.campaignId;
  }
  campaignWizardEnabled = false;
  campaignWizardStep = 1;
  applyCampaignWizardStep();
};

const applyLifecycle = (campaign, lifecycle) => {
  const next = String(lifecycle || 'active');
  if (next === 'archived') {
    campaign.archived = true;
    campaign.paused = false;
    return;
  }
  if (next === 'paused') {
    campaign.paused = true;
    campaign.archived = false;
    return;
  }
  campaign.paused = false;
  campaign.archived = false;
};

const handleCampaignSubmit = (event) => {
  event.preventDefault();
  const { form, msg } = getCampaignModal();
  if (!form) return;

  const data = new FormData(form);
  const id = String(data.get('id') || '').trim();
  const brandId = String(data.get('brandId') || '').trim();
  const value = Math.max(parseMoneyBRL(data.get('value')), 0);
  const barter = String(data.get('barter') || '0') === '1';
  const dueDate = String(data.get('dueDate') || '');
  const estimatedHours = Math.max(0, parseFloat(data.get('estimatedHours')) || 0);
  const lifecycle = String(data.get('lifecycle') || 'active');
  const startMethod = String(data.get('startMethod') || '').trim();
  const startMethodOther = String(data.get('startMethodOther') || '').trim();
  const paymentPresetRaw = String(data.get('paymentPreset') || '0').trim();
  const paymentPresetParsed = parseInt(paymentPresetRaw, 10);
  const paymentPercent = [0, 50, 100].includes(paymentPresetParsed) ? paymentPresetParsed : 0;
  const paymentDate = String(data.get('paymentDate') || '').trim();
  const paymentReceivedAtRaw = String(data.get('paymentReceivedAt') || '').trim();
  const contactName = String(data.get('contactName') || '').trim();
  const contactEmail = String(data.get('contactEmail') || '').trim();
  const nextActionTypeRaw = String(data.get('nextActionType') || '').trim();
  const nextActionType = nextActionOptions.includes(nextActionTypeRaw) ? nextActionTypeRaw : '';
  const nextActionCustomType = String(data.get('nextActionCustomType') || '').trim().slice(0, 80);
  const nextActionDate = String(data.get('nextActionDate') || '').trim();
  const nextActionNote = String(data.get('nextActionNote') || '').trim().slice(0, 140);
  const photoCount = Math.max(0, parseInt(String(data.get('photoCount') || '0').trim(), 10) || 0);
  const videoCount = Math.max(0, parseInt(String(data.get('videoCount') || '0').trim(), 10) || 0);
  const paymentReceivedAt =
    paymentPercent >= 100
      ? (paymentReceivedAtRaw || todayIso())
      : '';
  const brandRecord = getBrandById(brandId);
  const brand = brandRecord ? String(brandRecord.name || '').trim() : '';
  if (nextActionType && !nextActionDate) {
    if (msg) msg.textContent = 'Defina a data da próxima ação.';
    return;
  }
  if (nextActionType === 'outro' && !nextActionCustomType) {
    if (msg) msg.textContent = 'Descreva o tipo personalizado da próxima ação.';
    return;
  }

  const nowIso = new Date().toISOString();
  const startMethodNormalized = (() => {
    if (startMethod === 'outreach') return 'outbound'; // legado
    return startMethod;
  })();
  const allowedStartMethods = ['ugc_platform', 'inbound', 'outbound', 'instagram', 'agencia', 'comunidade', 'other'];
  const startMethodSafe = allowedStartMethods.includes(startMethodNormalized) ? startMethodNormalized : '';

  if (brandRecord) {
    if (contactName && !brandRecord.contact) brandRecord.contact = contactName;
    if (contactEmail && !brandRecord.email) brandRecord.email = contactEmail;
    brandRecord.updatedAt = nowIso;
  }

  if (id) {
    const campaign = state.campaigns.find((item) => item.id === id);
    if (!campaign) {
      if (msg) msg.textContent = 'Não encontrei essa campanha. Tente de novo.';
      return;
    }

    const previousDue = campaign.dueDate || '';
    const previousLife = campaign.archived ? 'archived' : campaign.paused ? 'paused' : 'active';

    campaign.brandId = brandRecord ? brandRecord.id : '';
    campaign.brand = brand;
    campaign.value = value;
    campaign.barter = barter;
    campaign.dueDate = dueDate;
    campaign.photoCount = photoCount;
    campaign.videoCount = videoCount;
    campaign.estimatedHours = estimatedHours;
    campaign.startMethod = startMethodSafe;
    campaign.startMethodOther = startMethodSafe === 'other' ? startMethodOther : '';
    campaign.paymentPercent = paymentPercent;
    campaign.paymentDate = paymentDate;
    campaign.paymentReceivedAt = paymentReceivedAt;
    campaign.contactName = contactName;
    campaign.contactEmail = contactEmail;
    campaign.nextActionType = nextActionType;
    campaign.nextActionCustomType = nextActionType === 'outro' ? nextActionCustomType : '';
    campaign.nextActionDate = nextActionType ? nextActionDate : '';
    campaign.nextActionNote = nextActionType ? nextActionNote : '';
    campaign.resources = Array.isArray(campaign.resources) ? campaign.resources : [];
    applyLifecycle(campaign, lifecycle);
    campaign.updatedAt = nowIso;

    if (previousDue !== campaign.dueDate) {
      trackEvent('campaign_due_set', { campaignId: campaign.id, dueDate: campaign.dueDate, campaign });
    }

    const nextLife = campaign.archived ? 'archived' : campaign.paused ? 'paused' : 'active';
    if (previousLife !== nextLife) {
      if (nextLife === 'archived') trackEvent('campaign_archived', { campaignId: campaign.id, campaign });
      else if (nextLife === 'paused') trackEvent('campaign_paused', { campaignId: campaign.id, campaign });
      else trackEvent('campaign_resumed', { campaignId: campaign.id, campaign });
    }

    trackEvent('campaign_updated', { campaignId: campaign.id, campaign });

    saveState();
    renderAll();
    try {
      document.dispatchEvent(new CustomEvent('ugc:campaigns-changed', { detail: { campaignId: campaign.id, reason: 'update' } }));
    } catch (error) {}
    closeCampaignModal();
    showToast('Campanha atualizada!');
    return;
  }

  const brandKey = brand.toLowerCase();
  const existingCount = brandRecord
    ? state.campaigns.filter((c) => String(c.brandId || '').trim() === brandRecord.id || String(c.brand || '').toLowerCase() === brandKey).length
    : state.campaigns.filter((c) => !String(c.brandId || '').trim() && !String(c.brand || '').trim()).length;
  const baseTitle = brand || 'Campanha sem marca';
  const title = existingCount ? `${baseTitle} #${existingCount + 1}` : baseTitle;

  const campaign = {
    id: `c-${Date.now()}`,
    title,
    brandId: brandRecord ? brandRecord.id : '',
    brand,
    status: 'prospeccao',
    stage: getDefaultCampaignStage('prospeccao'),
    value,
    barter,
    dueDate,
    photoCount,
    videoCount,
    estimatedHours,
    startMethod: startMethodSafe,
    startMethodOther: startMethodSafe === 'other' ? startMethodOther : '',
    paymentPercent,
    paymentDate,
    paymentReceivedAt,
    contactName,
    contactEmail,
    nextActionType,
    nextActionCustomType: nextActionType === 'outro' ? nextActionCustomType : '',
    nextActionDate: nextActionType ? nextActionDate : '',
    nextActionNote: nextActionType ? nextActionNote : '',
    resources: campaignDraftResources.map((resource) => ({ ...resource })),
    paused: false,
    archived: false,
    createdAt: nowIso,
    updatedAt: nowIso
  };
  applyLifecycle(campaign, lifecycle);

  state.campaigns.unshift(campaign);
  trackEvent('campaign_created', { campaignId: campaign.id, campaign });

  if (campaign.dueDate) {
    trackEvent('campaign_due_set', { campaignId: campaign.id, dueDate: campaign.dueDate, campaign });
  }

  if (campaign.archived) trackEvent('campaign_archived', { campaignId: campaign.id, campaign });
  if (campaign.paused) trackEvent('campaign_paused', { campaignId: campaign.id, campaign });

  saveState();
  renderAll();
  try {
    document.dispatchEvent(new CustomEvent('ugc:campaigns-changed', { detail: { campaignId: campaign.id, reason: 'create' } }));
  } catch (error) {}
  closeCampaignModal();
  showToast('Campanha salva!');
};

const initCampaignForm = () => {
  const campaignForm = document.getElementById('campaign-form');
  if (!campaignForm) return;
  if (campaignForm.dataset.bound === '1') return;
  campaignForm.dataset.bound = '1';

  campaignForm.addEventListener('submit', handleCampaignSubmit);

  const startMethodSelect = campaignForm.querySelector('select[name="startMethod"]');
  const startOtherRow = document.getElementById('campaign-start-other-row');
  const startOtherInput = campaignForm.querySelector('input[name="startMethodOther"]');
  const nextActionTypeSelect = campaignForm.querySelector('select[name="nextActionType"]');
  const brandSelect = campaignForm.querySelector('select[name="brandId"]');
  if (startMethodSelect) {
    startMethodSelect.addEventListener('change', () => {
      const show = startMethodSelect.value === 'other';
      if (startOtherRow) startOtherRow.style.display = show ? '' : 'none';
      if (!show && startOtherInput) startOtherInput.value = '';
    });
  }
  if (nextActionTypeSelect) {
    nextActionTypeSelect.addEventListener('change', () => {
      toggleNextActionCustomRow(campaignForm, nextActionTypeSelect.value);
    });
  }
  if (brandSelect) {
    brandSelect.addEventListener('change', () => {
      const selectedBrand = getBrandById(getCampaignBrandValue(brandSelect));
      const contactNameInput = campaignForm.querySelector('input[name="contactName"]');
      const contactEmailInput = campaignForm.querySelector('input[name="contactEmail"]');
      if (!selectedBrand) {
        return;
      }
      if (contactNameInput && !contactNameInput.value.trim()) contactNameInput.value = selectedBrand.contact || '';
      if (contactEmailInput && !contactEmailInput.value.trim()) contactEmailInput.value = selectedBrand.email || '';
    });
  }

  const draftFilesBtn = document.getElementById('campaign-draft-files-btn');
  const draftFilesList = document.querySelector('[data-campaign-draft-list]');
  if (draftFilesBtn && draftFilesBtn.dataset.bound !== '1') {
    draftFilesBtn.dataset.bound = '1';
    draftFilesBtn.addEventListener('click', () => {
      addCampaignDraftFiles();
    });
  }
  if (draftFilesList && draftFilesList.dataset.bound !== '1') {
    draftFilesList.dataset.bound = '1';
    draftFilesList.addEventListener('click', (event) => {
      const removeBtn = event.target.closest('[data-draft-resource-remove]');
      if (!removeBtn) return;
      const resourceId = String(removeBtn.dataset.draftResourceRemove || '').trim();
      if (!resourceId) return;
      campaignDraftResources = campaignDraftResources.filter((resource) => resource.id !== resourceId);
      renderCampaignDraftResources();
    });
  }
  renderCampaignDraftResources();

  const prevStepBtn = document.getElementById('campaign-step-prev-btn');
  const nextStepBtn = document.getElementById('campaign-step-next-btn');
  if (prevStepBtn && prevStepBtn.dataset.bound !== '1') {
    prevStepBtn.dataset.bound = '1';
    prevStepBtn.addEventListener('click', () => {
      if (!campaignWizardEnabled) return;
      setCampaignWizardStep(campaignWizardStep - 1);
    });
  }
  if (nextStepBtn && nextStepBtn.dataset.bound !== '1') {
    nextStepBtn.dataset.bound = '1';
    nextStepBtn.addEventListener('click', () => {
      if (!campaignWizardEnabled) return;

      const { msg } = getCampaignModal();
      if (msg) msg.textContent = '';
      setCampaignWizardStep(campaignWizardStep + 1);
    });
  }

  campaignForm.querySelectorAll('.campaign-wizard-step[data-step]').forEach((stepButton) => {
    if (stepButton.dataset.bound === '1') return;
    stepButton.dataset.bound = '1';
    const goToStep = () => {
      if (!campaignWizardEnabled) return;
      setCampaignWizardStep(Number(stepButton.dataset.step || 1));
    };
    stepButton.addEventListener('click', goToStep);
    stepButton.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      goToStep();
    });
  });

  const moneyInput = campaignForm.querySelector('input[data-money]');
  if (!moneyInput) return;

  moneyInput.addEventListener('input', () => {
    const formatted = formatMoneyBRL(moneyInput.value);
    moneyInput.value = formatted;
  });

  moneyInput.addEventListener('blur', () => {
    if (!moneyInput.value) {
      moneyInput.value = 'R$ 0';
      return;
    }
    moneyInput.value = formatMoneyBRL(moneyInput.value) || 'R$ 0';
  });

  moneyInput.addEventListener('focus', () => {
    if (moneyInput.value === 'R$ 0') {
      moneyInput.setSelectionRange(moneyInput.value.length, moneyInput.value.length);
    }
  });

  try {
    document.addEventListener('ugc:brands-changed', () => {
      const selectedId = state.ui.pendingCampaignBrandId || brandSelect.value || '';
      populateCampaignBrandSelect(selectedId);
      if (brandSelect && selectedId) brandSelect.value = selectedId;
    });
  } catch (error) {}

  if (!window.__ugcCampaignWizard || typeof window.__ugcCampaignWizard !== 'object') {
    window.__ugcCampaignWizard = {};
  }
  window.__ugcCampaignWizard.setStep = (step) => setCampaignWizardStep(step);
  window.__ugcCampaignWizard.isEnabled = () => campaignWizardEnabled;
};

export { openCampaignModal, closeCampaignModal, initCampaignForm };
