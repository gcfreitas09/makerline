import { state, saveState } from '../../core/state.js';
import { renderAll } from '../../core/renderers.js';
import { showToast } from '../../core/ui.js';
import { trackEvent } from '../../core/gamification.js';

const getBrandModal = () => ({
  modal: document.getElementById('brand-modal'),
  form: document.getElementById('brand-form'),
  msg: document.getElementById('brand-msg'),
  preset: document.getElementById('brand-preset'),
  otherRow: document.getElementById('brand-other-row'),
  otherInput: document.getElementById('brand-name')
});

const unique = (values) => {
  const seen = new Set();
  const list = [];
  values.forEach((value) => {
    const text = String(value || '').trim();
    if (!text) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    list.push(text);
  });
  return list;
};

const getPresets = () => {
  const campaignBrands = (Array.isArray(state.campaigns) ? state.campaigns : []).map((c) => c.brand);
  return unique([...campaignBrands]);
};

const populatePresetSelect = (selectEl) => {
  if (!selectEl) return;
  const current = String(selectEl.value || '');
  const presets = getPresets();

  if (!presets.length) {
    selectEl.innerHTML = ['<option value="other">Outros</option>'].join('');
    selectEl.value = 'other';
    return;
  }

  selectEl.innerHTML = [
    '<option value="">Escolher...</option>',
    ...presets.map((name) => `<option value="${name}">${name}</option>`),
    '<option value="other">Outros</option>'
  ].join('');

  if (current && (current === 'other' || presets.includes(current))) {
    selectEl.value = current;
    return;
  }

  selectEl.value = '';
};

const setOtherVisibility = (isOther) => {
  const { otherRow, otherInput } = getBrandModal();
  if (!otherRow || !otherInput) return;
  otherRow.style.display = isOther ? '' : 'none';
  otherInput.required = Boolean(isOther);
  if (!isOther) {
    otherInput.value = '';
  }
};

const openBrandModal = () => {
  const { modal, form, msg, preset } = getBrandModal();
  if (!modal || !form) return;
  if (msg) msg.textContent = '';
  form.reset();
  if (preset) populatePresetSelect(preset);
  setOtherVisibility(preset?.value === 'other');

  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  if (preset) preset.focus();
};

const closeBrandModal = () => {
  const { modal, form, msg } = getBrandModal();
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  if (form) form.reset();
  if (msg) msg.textContent = '';
  setOtherVisibility(false);
};

const handleBrandSubmit = (event) => {
  event.preventDefault();
  const { form, msg, preset, otherInput } = getBrandModal();
  if (!form) return;
  if (msg) msg.textContent = '';

  const data = new FormData(form);
  const presetValue = String(data.get('brandPreset') || '').trim();
  const otherName = String(otherInput?.value || '').trim();
  const name = presetValue === 'other' ? otherName : presetValue;
  const contact = String(data.get('contact') || '').trim();
  const email = String(data.get('email') || '').trim();
  const status = String(data.get('status') || 'enviado');

  if (!name) {
    if (msg) msg.textContent = 'Escolhe a marca ou coloca em “Outros”.';
    return;
  }
  if (!contact) {
    if (msg) msg.textContent = 'Coloca o nome do contato.';
    return;
  }
  if (!email || !email.includes('@')) {
    if (msg) msg.textContent = 'Coloca um e-mail válido.';
    return;
  }

  const brand = {
    id: `b-${Date.now()}`,
    name,
    contact,
    email,
    status: ['enviado', 'negociando', 'fechado'].includes(status) ? status : 'enviado'
  };

  state.brands.unshift(brand);
  trackEvent('brand_created', { brandId: brand.id, brand });
  saveState();
  renderAll();
  closeBrandModal();
  showToast('Marca salva.');
};

const initBrandForm = () => {
  const { form, preset } = getBrandModal();
  if (!form || !preset) return;
  if (form.dataset.bound === '1') return;
  form.dataset.bound = '1';

  preset.addEventListener('focus', () => populatePresetSelect(preset));
  preset.addEventListener('mousedown', () => populatePresetSelect(preset));
  preset.addEventListener('change', () => setOtherVisibility(preset.value === 'other'));
  form.addEventListener('submit', handleBrandSubmit);

  try {
    document.addEventListener('ugc:campaigns-changed', () => {
      populatePresetSelect(preset);
      setOtherVisibility(preset.value === 'other');
    });
  } catch (error) {}
};

export { openBrandModal, closeBrandModal, initBrandForm };
