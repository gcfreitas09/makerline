import { state, saveState, getDefaultCampaignStage, nextActionOptions } from '../../core/state.js';
import { renderAll } from '../../core/renderers.js?v=20260301h';
import { showToast } from '../../core/ui.js?v=20260301h';
import { trackEvent } from '../../core/gamification.js?v=20260301h';
import { populateCampaignBrandSelect } from '../brands/modal.js';

const getCampaignModal = () => ({
  modal: document.getElementById('campaign-modal'),
  form: document.getElementById('campaign-form'),
  msg: document.getElementById('campaign-msg'),
  title: document.querySelector('[data-campaign-modal-title]'),
  subtitle: document.querySelector('[data-campaign-modal-subtitle]')
});

const formatMoneyBRL = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  const value = parseInt(digits, 10) || 0;
  const formatted = value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${formatted}`;
};

const parseMoneyBRL = (raw) => {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : 0;
};

const todayIso = () => new Date().toISOString().slice(0, 10);

const getBrandById = (brandId) => (Array.isArray(state.brands) ? state.brands : []).find((brand) => brand.id === brandId) || null;

const toggleNextActionCustomRow = (form, value) => {
  const customRow = document.getElementById('campaign-next-action-custom-row');
  const customInput = form?.querySelector('input[name="nextActionCustomType"]');
  const show = value === 'outro';
  if (customRow) customRow.style.display = show ? '' : 'none';
  if (customInput) {
    customInput.required = show;
    if (!show) customInput.value = '';
  }
};

const setModalMode = ({ mode, campaign }) => {
  const { title, subtitle } = getCampaignModal();
  const isEdit = mode === 'edit';
  if (title) title.textContent = isEdit ? 'Editar campanha' : 'Nova campanha';
  if (subtitle) subtitle.textContent = isEdit ? 'Atualiza o que precisar e salva.' : 'Só o básico pra já entrar no jogo.';

  const { form } = getCampaignModal();
  if (!form) return;
  form.dataset.mode = mode || 'create';
  form.dataset.campaignId = campaign?.id || '';
};

const openCampaignModal = (campaignId) => {
  const { modal, form, msg } = getCampaignModal();
  if (!modal || !form) return;

  form.reset();
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
  const mailtoBtn = document.getElementById('campaign-mailto-btn');
  const nextActionTypeSelect = form.querySelector('select[name="nextActionType"]');
  const nextActionDateInput = form.querySelector('input[name="nextActionDate"]');
  const nextActionNoteInput = form.querySelector('input[name="nextActionNote"]');
  const nextActionCustomInput = form.querySelector('input[name="nextActionCustomType"]');
  if (contactNameInput) contactNameInput.value = '';
  if (contactEmailInput) contactEmailInput.value = '';
  if (mailtoBtn) mailtoBtn.style.display = 'none';
  if (nextActionTypeSelect) nextActionTypeSelect.value = '';
  if (nextActionDateInput) nextActionDateInput.value = '';
  if (nextActionNoteInput) nextActionNoteInput.value = '';
  if (nextActionCustomInput) nextActionCustomInput.value = '';
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
      }

      if (valueInput) valueInput.value = formatMoneyBRL(campaign.value) || 'R$ 0';
      if (barterSelect) barterSelect.value = campaign.barter ? '1' : '0';

      const dueInput = form.querySelector('input[name="dueDate"]');
      if (dueInput) dueInput.value = campaign.dueDate || '';

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
      if (mailtoBtn && campaign.contactEmail) {
        mailtoBtn.href = `mailto:${encodeURIComponent(campaign.contactEmail)}`;
        mailtoBtn.style.display = '';
      }
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
      brandSelect.value = state.ui.pendingCampaignBrandId || '';
      const selectedBrand = getBrandById(brandSelect.value);
      if (selectedBrand) {
        if (contactNameInput && !contactNameInput.value) contactNameInput.value = selectedBrand.contact || '';
        if (contactEmailInput && !contactEmailInput.value) contactEmailInput.value = selectedBrand.email || '';
        if (mailtoBtn && selectedBrand.email) {
          mailtoBtn.href = `mailto:${encodeURIComponent(selectedBrand.email)}`;
          mailtoBtn.style.display = '';
        }
      }
    }
  }

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

  if (brandSelect) brandSelect.focus();
};

const closeCampaignModal = () => {
  const { modal, form, msg } = getCampaignModal();
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  if (form) form.reset();
  if (msg) msg.textContent = '';
  if (form) {
    delete form.dataset.mode;
    delete form.dataset.campaignId;
  }
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
  const paymentReceivedAt =
    paymentPercent >= 100
      ? (paymentReceivedAtRaw || todayIso())
      : '';
  const brandRecord = getBrandById(brandId);
  const brand = brandRecord?.name || '';

  if (!brandRecord) {
    if (msg) msg.textContent = 'Escolha uma marca para salvar a campanha.';
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

  const nowIso = new Date().toISOString();
  const startMethodNormalized = (() => {
    if (startMethod === 'outreach') return 'outbound'; // legado
    return startMethod;
  })();
  const allowedStartMethods = ['ugc_platform', 'inbound', 'outbound', 'instagram', 'agencia', 'comunidade', 'other'];
  const startMethodSafe = allowedStartMethods.includes(startMethodNormalized) ? startMethodNormalized : '';

  if (contactName && !brandRecord.contact) brandRecord.contact = contactName;
  if (contactEmail && !brandRecord.email) brandRecord.email = contactEmail;
  brandRecord.updatedAt = nowIso;

  if (id) {
    const campaign = state.campaigns.find((item) => item.id === id);
    if (!campaign) {
      if (msg) msg.textContent = 'Não achei essa campanha. Tenta de novo.';
      return;
    }

    const previousDue = campaign.dueDate || '';
    const previousLife = campaign.archived ? 'archived' : campaign.paused ? 'paused' : 'active';

    campaign.brandId = brandRecord.id;
    campaign.brand = brand;
    campaign.value = value;
    campaign.barter = barter;
    campaign.dueDate = dueDate;
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
  const existingCount = state.campaigns.filter((c) => String(c.brandId || '').trim() === brandRecord.id || String(c.brand || '').toLowerCase() === brandKey).length;
  const title = existingCount ? `${brand} #${existingCount + 1}` : `${brand}`;

  const campaign = {
    id: `c-${Date.now()}`,
    title,
    brandId: brandRecord.id,
    brand,
    status: 'prospeccao',
    stage: getDefaultCampaignStage('prospeccao'),
    value,
    barter,
    dueDate,
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
      const selectedBrand = getBrandById(brandSelect.value);
      const contactNameInput = campaignForm.querySelector('input[name="contactName"]');
      const contactEmailInput = campaignForm.querySelector('input[name="contactEmail"]');
      const mailtoBtn = document.getElementById('campaign-mailto-btn');
      if (!selectedBrand) {
        if (mailtoBtn) mailtoBtn.style.display = 'none';
        return;
      }
      if (contactNameInput && !contactNameInput.value.trim()) contactNameInput.value = selectedBrand.contact || '';
      if (contactEmailInput && !contactEmailInput.value.trim()) contactEmailInput.value = selectedBrand.email || '';
      if (mailtoBtn && (contactEmailInput?.value || selectedBrand.email)) {
        mailtoBtn.href = `mailto:${encodeURIComponent(contactEmailInput?.value || selectedBrand.email)}`;
        mailtoBtn.style.display = (contactEmailInput?.value || selectedBrand.email) ? '' : 'none';
      }
    });
  }

  const contactEmailInput = campaignForm.querySelector('input[name="contactEmail"]');
  const mailtoBtn = document.getElementById('campaign-mailto-btn');
  if (contactEmailInput && mailtoBtn) {
    contactEmailInput.addEventListener('input', () => {
      const email = contactEmailInput.value.trim();
      if (email) {
        mailtoBtn.href = `mailto:${encodeURIComponent(email)}`;
        mailtoBtn.style.display = '';
      } else {
        mailtoBtn.style.display = 'none';
      }
    });
  }

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
      const selectedId = state.ui.pendingCampaignBrandId || brandSelect?.value || '';
      populateCampaignBrandSelect(selectedId);
      if (brandSelect && selectedId) brandSelect.value = selectedId;
    });
  } catch (error) {}
};

export { openCampaignModal, closeCampaignModal, initCampaignForm };
