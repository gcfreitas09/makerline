import { state, saveState, typeLabels } from '../../core/state.js';
import { setScriptOutput, showToast } from '../../core/ui.js?v=20260302f';
import { trackEvent } from '../../core/gamification.js?v=20260302f';
import { renderAll } from '../../core/renderers.js?v=20260302f';
import { generateScript } from '../../core/scripts.js';

const getCampaignLabel = (campaign) => campaign?.title || campaign?.brand || 'Campanha';

const populateCampaignSelect = (selectEl) => {
  if (!selectEl) return;
  const current = String(selectEl.value || '');
  const campaigns = Array.isArray(state.campaigns) ? state.campaigns : [];
  const options = campaigns.map((campaign) => ({ id: campaign.id, label: getCampaignLabel(campaign) }));

  selectEl.innerHTML = [
    '<option value="">Sem campanha</option>',
    ...options.map((item) => `<option value="${item.id}">${item.label}</option>`)
  ].join('');

  if (current && options.some((item) => item.id === current)) {
    selectEl.value = current;
  } else {
    selectEl.value = '';
  }
};

const handleScriptSubmit = (event) => {
  event.preventDefault();
  const brand = document.getElementById('script-brand')?.value || 'essa marca';
  const campaignSelect = document.getElementById('script-campaign');
  const campaignId = campaignSelect ? String(campaignSelect.value || '') : '';
  const type = document.getElementById('script-type')?.value || 'review';
  const length = document.getElementById('script-length')?.value || '30s';
  const tone = document.getElementById('script-tone')?.value || 'leve';
  const audience = document.getElementById('script-audience')?.value || 'público geral';
  const goal = document.getElementById('script-goal')?.value || 'gerar mais interesse.';

  const text = generateScript({ brand, type, length, tone, audience, goal });
  const scriptId = `s-${Date.now()}`;
  setScriptOutput(text);

  const script = {
    id: scriptId,
    text,
    brand,
    type,
    campaignId: campaignId || null,
    finalized: false,
    title: `${typeLabels[type] || type} - ${brand}`
  };

  state.scripts.unshift(script);
  state.focus.current = Math.min(state.focus.current + 1, state.focus.target);
  state.ui.openScript = scriptId;
  trackEvent('script_created', { scriptId, campaignId: campaignId || null, script });
  saveState();
  renderAll();
  showToast('Roteiro pronto!');

  const form = document.getElementById('script-form');
  if (form) {
    form.dispatchEvent(new CustomEvent('quiz:reset'));
  }
};

const initScriptQuiz = () => {
  const form = document.getElementById('script-form');
  if (!form) return;
  if (form.dataset.quizReady === '1') return;

  const rows = Array.from(form.querySelectorAll('.form-row'));
  const submitBtn = form.querySelector('button[type="submit"]');
  if (rows.length < 2 || !submitBtn) return;

  const inputBrand = document.getElementById('script-brand');
  const selectCampaign = document.getElementById('script-campaign');
  const selectType = document.getElementById('script-type');
  const selectLength = document.getElementById('script-length');
  const selectTone = document.getElementById('script-tone');
  const inputAudience = document.getElementById('script-audience');
  const inputGoal = document.getElementById('script-goal');

  if (!inputBrand || !selectType || !selectLength || !selectTone || !inputAudience || !inputGoal) return;

  if (selectCampaign) {
    populateCampaignSelect(selectCampaign);
    selectCampaign.addEventListener('focus', () => populateCampaignSelect(selectCampaign));
    selectCampaign.addEventListener('mousedown', () => populateCampaignSelect(selectCampaign));
  }

  form.dataset.quizReady = '1';
  rows.forEach((row) => row.classList.add('quiz-step'));

  const stepMetaByField = {
    'script-brand': {
      title: 'Qual é a marca/produto?',
      subtitle: 'Se quiser, escolha uma sugestão ou digite.'
    },
    'script-campaign': {
      title: 'Vincular em uma campanha?',
      subtitle: 'Opcional — se já existe, escolha aqui.'
    },
    'script-type': {
      title: 'Qual formato?',
      subtitle: 'Escolha o estilo do vídeo.'
    },
    'script-length': {
      title: 'Duração',
      subtitle: 'Qual o tempo do vídeo?'
    },
    'script-tone': {
      title: 'Tom do vídeo',
      subtitle: 'Qual vibe você quer?'
    },
    'script-audience': {
      title: 'Público',
      subtitle: 'Para quem é esse vídeo?'
    },
    'script-goal': {
      title: 'Objetivo',
      subtitle: 'O que você quer que aconteça depois?'
    }
  };

  const findStepMeta = (row) => {
    for (const fieldId of Object.keys(stepMetaByField)) {
      if (row.querySelector(`#${fieldId}`)) return stepMetaByField[fieldId];
    }
    return null;
  };

  const ensureDefaults = () => {
    if (!selectType.value) selectType.value = selectType.options[0]?.value || 'review';
    if (!selectLength.value) selectLength.value = selectLength.options[0]?.value || '30s';
    if (!selectTone.value) selectTone.value = selectTone.options[0]?.value || 'leve';
    if (!inputAudience.value) inputAudience.value = 'público geral';
    if (!inputGoal.value) inputGoal.value = 'gerar vendas';
    if (selectCampaign && !selectCampaign.value) selectCampaign.value = '';
  };

  ensureDefaults();

  const header = document.createElement('div');
  header.className = 'quiz-progress';
  header.innerHTML = `
    <div class="quiz-progress-top">
      <div class="muted" data-quiz-progress-text>Pergunta 1 de ${rows.length}</div>
      <div class="chip">Quiz</div>
    </div>
    <div class="progress-track">
      <div class="progress-fill" data-quiz-progress-bar style="width: 10%"></div>
    </div>
  `;
  form.insertBefore(header, form.firstChild);

  const msg = document.createElement('div');
  msg.className = 'muted';
  msg.dataset.quizMsg = '1';
  msg.textContent = '';
  form.insertBefore(msg, submitBtn);

  const nav = document.createElement('div');
  nav.className = 'quiz-actions';
  nav.innerHTML = `
    <button class="btn btn-ghost" data-quiz-nav="back" type="button">Voltar</button>
    <button class="btn btn-primary" data-quiz-nav="next" type="button">Continuar</button>
  `;
  form.insertBefore(nav, submitBtn);

  const progressText = header.querySelector('[data-quiz-progress-text]');
  const progressBar = header.querySelector('[data-quiz-progress-bar]');
  const backBtn = nav.querySelector('[data-quiz-nav="back"]');
  const nextBtn = nav.querySelector('[data-quiz-nav="next"]');

  const setStepHeading = (row) => {
    const meta = findStepMeta(row);
    if (!meta) return;
    const existing = row.querySelector('.quiz-question');
    if (existing) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'quiz-question';
    wrapper.innerHTML = `<h3>${meta.title}</h3><p class="muted">${meta.subtitle}</p>`;
    row.insertBefore(wrapper, row.firstChild);
  };

  rows.forEach((row) => setStepHeading(row));

  const buildOptionButtonsFromSelect = (row, selectEl) => {
    const container = document.createElement('div');
    container.className = 'quiz-options';

    Array.from(selectEl.options).forEach((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quiz-option';
      button.dataset.quizSelect = selectEl.id;
      button.dataset.quizValue = option.value;
      button.textContent = option.textContent.trim();
      container.appendChild(button);
    });

    selectEl.classList.add('quiz-hidden');
    row.appendChild(container);
    return container;
  };

  const buildSuggestionButtons = (row, inputEl, suggestions) => {
    const container = document.createElement('div');
    container.className = 'quiz-options';

    suggestions.forEach((text) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quiz-option';
      button.dataset.quizInput = inputEl.id;
      button.dataset.quizValue = text;
      button.textContent = text;
      container.appendChild(button);
    });

    const field = row.querySelector(`#${inputEl.id}`);
    if (field && field.parentElement === row) {
      row.insertBefore(container, field);
    } else {
      row.appendChild(container);
    }

    return container;
  };

  const getBrandSuggestions = () => {
    const list = [];
    const seen = new Set();
    const add = (value) => {
      const text = String(value || '').trim();
      if (!text) return;
      const key = text.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      list.push(text);
    };

    (Array.isArray(state.campaigns) ? state.campaigns : []).forEach((campaign) => add(campaign.brand));

    if (!list.length) return ['Outros'];

    const limited = list.slice(0, 5);
    limited.push('Outros');
    return limited;
  };

  const brandRow = rows.find((row) => row.querySelector('#script-brand'));
  const campaignRow = rows.find((row) => row.querySelector('#script-campaign'));
  const typeRow = rows.find((row) => row.querySelector('#script-type'));
  const lengthRow = rows.find((row) => row.querySelector('#script-length'));
  const toneRow = rows.find((row) => row.querySelector('#script-tone'));
  const audienceRow = rows.find((row) => row.querySelector('#script-audience'));
  const goalRow = rows.find((row) => row.querySelector('#script-goal'));

  const brandOptions = brandRow ? buildSuggestionButtons(brandRow, inputBrand, getBrandSuggestions()) : null;
  const refreshBrandSuggestions = () => {
    if (!brandOptions || !inputBrand) return;
    const suggestions = getBrandSuggestions();
    brandOptions.innerHTML = '';
    suggestions.forEach((text) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quiz-option';
      button.dataset.quizInput = inputBrand.id;
      button.dataset.quizValue = text;
      button.textContent = text;
      brandOptions.appendChild(button);
    });
  };
  refreshBrandSuggestions();
  const typeOptions = typeRow ? buildOptionButtonsFromSelect(typeRow, selectType) : null;
  const lengthOptions = lengthRow ? buildOptionButtonsFromSelect(lengthRow, selectLength) : null;
  const toneOptions = toneRow ? buildOptionButtonsFromSelect(toneRow, selectTone) : null;

  if (inputBrand) {
    inputBrand.classList.add('quiz-hidden');
  }

  if (campaignRow && selectCampaign) {
    const maxButtons = 7;
    const limited = document.createElement('select');
    limited.innerHTML = selectCampaign.innerHTML;
    while (limited.options.length > maxButtons) {
      limited.remove(maxButtons - 1);
    }
    const container = document.createElement('div');
    container.className = 'quiz-options';
    Array.from(limited.options).forEach((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quiz-option';
      button.dataset.quizSelect = selectCampaign.id;
      button.dataset.quizValue = option.value;
      button.textContent = option.textContent.trim();
      container.appendChild(button);
    });
    campaignRow.appendChild(container);
  }

  const audienceSuggestions = [
    'público geral',
    'pessoas de skincare e beleza',
    'pessoas de fitness e bem-estar',
    'pessoas de tech e apps',
    'pessoas de moda e estilo'
  ];
  const goalSuggestions = ['gerar vendas', 'aumentar awareness', 'gerar leads', 'levar para DM', 'downloads do app'];

  const audienceOptions = audienceRow ? buildSuggestionButtons(audienceRow, inputAudience, audienceSuggestions) : null;
  const goalOptions = goalRow ? buildSuggestionButtons(goalRow, inputGoal, goalSuggestions) : null;

  const highlightSelected = (container, currentValue) => {
    if (!container) return;
    const value = String(currentValue || '').trim();
    container.querySelectorAll('.quiz-option').forEach((btn) => {
      btn.classList.toggle('selected', String(btn.dataset.quizValue || '').trim() === value);
    });
  };

  let step = 0;

  const resetQuiz = () => {
    step = 0;
    if (inputBrand) {
      inputBrand.value = '';
      inputBrand.classList.add('quiz-hidden');
    }
    if (selectCampaign) {
      populateCampaignSelect(selectCampaign);
      selectCampaign.value = '';
    }
    if (selectType) selectType.value = selectType.options[0]?.value || 'review';
    if (selectLength) selectLength.value = selectLength.options[0]?.value || '30s';
    if (selectTone) selectTone.value = selectTone.options[0]?.value || 'leve';
    if (inputAudience) inputAudience.value = 'público geral';
    if (inputGoal) inputGoal.value = 'gerar vendas';
    updateUI();
    const activeRow = rows[0];
    if (activeRow) {
      const focusable = activeRow.querySelector('button, input, select, textarea, .quiz-option');
      if (focusable && focusable.focus) focusable.focus();
    }
  };

  const updateUI = () => {
    rows.forEach((row, index) => {
      row.classList.toggle('active', index === step);
      row.hidden = index !== step;
    });

    if (progressText) progressText.textContent = `Pergunta ${step + 1} de ${rows.length}`;
    if (progressBar) progressBar.style.width = `${Math.round(((step + 1) / rows.length) * 100)}%`;

    if (backBtn) backBtn.disabled = step === 0;
    if (nextBtn) nextBtn.style.display = step === rows.length - 1 ? 'none' : '';
    submitBtn.style.display = step === rows.length - 1 ? '' : 'none';

    refreshBrandSuggestions();
    const brandSelected = inputBrand.classList.contains('quiz-hidden') ? inputBrand.value : 'Outros';
    highlightSelected(brandOptions, brandSelected);
    highlightSelected(typeOptions, selectType.value);
    highlightSelected(lengthOptions, selectLength.value);
    highlightSelected(toneOptions, selectTone.value);
    highlightSelected(audienceOptions, inputAudience.value);
    highlightSelected(goalOptions, inputGoal.value);
  };

  try {
    document.addEventListener('ugc:campaigns-changed', () => {
      if (selectCampaign) populateCampaignSelect(selectCampaign);
      updateUI();
    });
  } catch (error) {}

  const go = (delta) => {
    ensureDefaults();
    msg.textContent = '';
    const next = Math.max(0, Math.min(rows.length - 1, step + delta));
    step = next;
    updateUI();

    const activeRow = rows[step];
    const focusable = activeRow.querySelector('input, textarea, select, .quiz-option, button');
    if (focusable && focusable.focus) focusable.focus();
  };

  nav.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-quiz-nav]');
    if (!btn) return;
    if (btn.dataset.quizNav === 'back') {
      go(-1);
      return;
    }
    if (btn.dataset.quizNav === 'next') {
      if (step === rows.length - 1) return;
      go(1);
    }
  });

  form.addEventListener('click', (e) => {
    const optionBtn = e.target.closest('.quiz-option');
    if (!optionBtn) return;

    const value = optionBtn.dataset.quizValue || '';

    if (optionBtn.dataset.quizSelect) {
      const selectId = optionBtn.dataset.quizSelect;
      const selectEl = document.getElementById(selectId);
      if (selectEl) {
        if (selectEl.id === 'script-campaign') populateCampaignSelect(selectEl);
        selectEl.value = value;
      }
      updateUI();
      if (step < rows.length - 1) go(1);
      return;
    }

    if (optionBtn.dataset.quizInput) {
      const inputId = optionBtn.dataset.quizInput;
      const inputEl = document.getElementById(inputId);
      if (!inputEl) return;

      if (inputId === 'script-brand') {
        if (value === 'Outros') {
          inputEl.value = '';
          inputEl.classList.remove('quiz-hidden');
          updateUI();
          inputEl.focus();
          return;
        }

        inputEl.value = value;
        inputEl.classList.add('quiz-hidden');
        updateUI();
        if (step < rows.length - 1) go(1);
        return;
      }

      inputEl.value = value;
      updateUI();
      if (step < rows.length - 1) go(1);
    }
  });

  form.addEventListener('quiz:reset', resetQuiz);
  form.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    if (step >= rows.length - 1) return;
    const target = e.target;
    if (!target || target.tagName === 'TEXTAREA') return;
    if (target.tagName === 'INPUT') {
      e.preventDefault();
      go(1);
    }
  });

  updateUI();
};

const initScriptFlow = () => {
  const scriptForm = document.getElementById('script-form');
  if (!scriptForm) return;
  if (scriptForm.dataset.bound === '1') return;
  scriptForm.dataset.bound = '1';

  scriptForm.addEventListener('submit', handleScriptSubmit);
  initScriptQuiz();
};

export { initScriptFlow };
