import { state, saveState, getDefaultCampaignStage } from '../../core/state.js';
import { renderAll } from '../../core/renderers.js';
import { showToast } from '../../core/ui.js';
import { trackEvent } from '../../core/gamification.js';

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

  const startMethodSelect = form.querySelector('select[name="startMethod"]');
  if (startMethodSelect) startMethodSelect.value = '';
  const startOtherRow = document.getElementById('campaign-start-other-row');
  if (startOtherRow) startOtherRow.style.display = 'none';
  const startOtherInput = form.querySelector('input[name="startMethodOther"]');
  if (startOtherInput) startOtherInput.value = '';

  const contactNameInput = form.querySelector('input[name="contactName"]');
  const contactEmailInput = form.querySelector('input[name="contactEmail"]');
  const mailtoBtn = document.getElementById('campaign-mailto-btn');
  if (contactNameInput) contactNameInput.value = '';
  if (contactEmailInput) contactEmailInput.value = '';
  if (mailtoBtn) mailtoBtn.style.display = 'none';

  if (msg) msg.textContent = '';

  if (campaignId) {
    const campaign = state.campaigns.find((item) => item.id === campaignId);
    if (campaign) {
      setModalMode({ mode: 'edit', campaign });
      const idInput = form.querySelector('input[name="id"]');
      if (idInput) idInput.value = campaign.id;

      const brandInput = form.querySelector('input[name="brand"]');
      if (brandInput) brandInput.value = campaign.brand || '';

      if (valueInput) valueInput.value = formatMoneyBRL(campaign.value) || 'R$ 0';
      if (barterSelect) barterSelect.value = campaign.barter ? '1' : '0';

      const dueInput = form.querySelector('input[name="dueDate"]');
      if (dueInput) dueInput.value = campaign.dueDate || '';

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

      // Contato
      if (contactNameInput) contactNameInput.value = campaign.contactName || '';
      if (contactEmailInput) contactEmailInput.value = campaign.contactEmail || '';
      if (mailtoBtn && campaign.contactEmail) {
        mailtoBtn.href = `mailto:${encodeURIComponent(campaign.contactEmail)}`;
        mailtoBtn.style.display = '';
      }

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

  const brandInput = form.querySelector('input[name="brand"]');
  if (brandInput) brandInput.focus();
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
  const brand = String(data.get('brand') || '').trim();
  const value = Math.max(parseMoneyBRL(data.get('value')), 0);
  const barter = String(data.get('barter') || '0') === '1';
  const dueDate = String(data.get('dueDate') || '');
  const lifecycle = String(data.get('lifecycle') || 'active');
  const startMethod = String(data.get('startMethod') || '').trim();
  const startMethodOther = String(data.get('startMethodOther') || '').trim();
  const paymentPresetRaw = String(data.get('paymentPreset') || '0').trim();
  const paymentPresetParsed = parseInt(paymentPresetRaw, 10);
  const paymentPercent = [0, 50, 100].includes(paymentPresetParsed) ? paymentPresetParsed : 0;
  const paymentDate = String(data.get('paymentDate') || '').trim();
  const contactName = String(data.get('contactName') || '').trim();
  const contactEmail = String(data.get('contactEmail') || '').trim();

  if (!brand) {
    if (msg) msg.textContent = 'Coloca a marca pra salvar.';
    return;
  }

  const nowIso = new Date().toISOString();
  const startMethodNormalized = (() => {
    if (startMethod === 'outreach') return 'outbound'; // legado
    return startMethod;
  })();
  const allowedStartMethods = ['ugc_platform', 'inbound', 'outbound', 'instagram', 'agencia', 'comunidade', 'other'];
  const startMethodSafe = allowedStartMethods.includes(startMethodNormalized) ? startMethodNormalized : '';

  if (id) {
    const campaign = state.campaigns.find((item) => item.id === id);
    if (!campaign) {
      if (msg) msg.textContent = 'Não achei essa campanha. Tenta de novo.';
      return;
    }

    const previousDue = campaign.dueDate || '';
    const previousLife = campaign.archived ? 'archived' : campaign.paused ? 'paused' : 'active';

    campaign.brand = brand;
    campaign.value = value;
    campaign.barter = barter;
    campaign.dueDate = dueDate;
    campaign.startMethod = startMethodSafe;
    campaign.startMethodOther = startMethodSafe === 'other' ? startMethodOther : '';
    campaign.paymentPercent = paymentPercent;
    campaign.paymentDate = paymentDate;
    campaign.contactName = contactName;
    campaign.contactEmail = contactEmail;
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
  const existingCount = state.campaigns.filter((c) => String(c.brand || '').toLowerCase() === brandKey).length;
  const title = existingCount ? `${brand} #${existingCount + 1}` : `${brand}`;

  const campaign = {
    id: `c-${Date.now()}`,
    title,
    brand,
    status: 'prospeccao',
    stage: getDefaultCampaignStage('prospeccao'),
    value,
    barter,
    dueDate,
    startMethod: startMethodSafe,
    startMethodOther: startMethodSafe === 'other' ? startMethodOther : '',
    paymentPercent,
    paymentDate,
    contactName,
    contactEmail,
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
  if (startMethodSelect) {
    startMethodSelect.addEventListener('change', () => {
      const show = startMethodSelect.value === 'other';
      if (startOtherRow) startOtherRow.style.display = show ? '' : 'none';
      if (!show && startOtherInput) startOtherInput.value = '';
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
};

export { openCampaignModal, closeCampaignModal, initCampaignForm };
