import {
  state,
  statusLabels,
  campaignStatusOrder,
  campaignStagesByStatus,
  getCampaignStageOptions,
  getDefaultCampaignStage,
  typeLabels,
  statusDot,
  brandStatuses,
  brandOptions,
  formatCurrency,
  formatPercent,
  xpForLevel,
  getAchievementById
} from './state.js';
import { setScriptOutput } from './ui.js';

const ICONS = {
  radar: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 12l6-2" />
      <path d="M12 12l-3 5" />
    </svg>
  `,
  cash: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 1v22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  `,
  time: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  `,
  trend: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M21 7v6h-6" />
    </svg>
  `,
  send: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4z" />
    </svg>
  `,
  chat: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
    </svg>
  `,
  bars: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M4 19V5" />
      <path d="M8 19V9" />
      <path d="M12 19V12" />
      <path d="M16 19V8" />
      <path d="M20 19V6" />
    </svg>
  `,
  ticket: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h7" />
      <path d="M18 2h4v4" />
      <path d="M10 14L22 2" />
    </svg>
  `
};

const iconSvg = (name) => ICONS[name] || '';

const renderProfile = () => {
  const greetings = document.querySelectorAll('[data-greeting]');
  const profileName = document.querySelectorAll('[data-profile-name]');
  const profileLevel = document.querySelectorAll('[data-profile-level]');
  const profileXp = document.querySelectorAll('[data-profile-xp]');
  const profileXpGoal = document.querySelectorAll('[data-profile-xp-goal]');
  const profileXpRemaining = document.querySelectorAll('[data-profile-xp-remaining]');
  const profileXpBar = document.querySelectorAll('[data-profile-xpbar]');
  const profileStreak = document.querySelectorAll('[data-profile-streak]');
  const profileStreakBar = document.querySelectorAll('[data-profile-streakbar]');
  const dashboardNarrative = document.querySelectorAll('[data-dashboard-narrative]');
  const streakTip = document.querySelectorAll('[data-streak-tip]');
  const focusCurrent = document.querySelectorAll('[data-focus-current]');
  const focusTarget = document.querySelectorAll('[data-focus-target]');
  const focusXp = document.querySelectorAll('[data-focus-xp]');
  const focusLabel = document.querySelectorAll('[data-focus-label]');
  const focusBar = document.querySelectorAll('[data-focus-bar]');

  const isMax = state.profile.level >= 10;
  const goal = xpForLevel(state.profile.level);
  const remaining = isMax ? 0 : Math.max(goal - state.profile.xp, 0);
  const progress = isMax ? 1 : goal ? Math.min(state.profile.xp / goal, 1) : 0;
  const streakGoal = 30;
  const streakProgress = Math.min(Math.max(state.profile.streak / streakGoal, 0), 1);
  const focusGoal = Number.isFinite(state.focus?.target) ? state.focus.target : 0;
  const focusCurrentValue = Number.isFinite(state.focus?.current) ? state.focus.current : 0;
  const focusProgress = focusGoal ? Math.min(Math.max(focusCurrentValue / focusGoal, 0), 1) : 0;

  const campaigns = Array.isArray(state.campaigns) ? state.campaigns : [];
  const scripts = Array.isArray(state.scripts) ? state.scripts : [];
  const brands = Array.isArray(state.brands) ? state.brands : [];

  const hour = new Date().getHours();
  const greeting = hour >= 5 && hour < 12 ? 'Bom dia' : hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite';

  const actionsLeft = remaining ? Math.max(1, Math.ceil(remaining / 20)) : 0;
  let narrative = '';

  if (state.profile.level === 1 && state.profile.xp <= 40) {
    narrative = 'Todo mundo começa do zero. Você já deu o primeiro passo.';
  } else if (!campaigns.length) {
    narrative = 'Cria uma campanha (mesmo de teste). Isso já destrava XP e deixa tudo mais claro.';
  } else if (!scripts.length) {
    narrative = 'Gera um roteiro rapidinho. É XP por esforço e já te coloca no ritmo.';
  } else if (!brands.length) {
    narrative = 'Salva um contato de marca. Mesmo que seja “outros”, vale o registro.';
  } else if (remaining > 0 && remaining <= 25) {
    narrative = `Tá na beirinha do próximo nível. Só mais ${remaining} XP.`;
  } else if (remaining > 0) {
    narrative = `Faltam ~${actionsLeft} ações pra subir de nível. Vai no passo a passo.`;
  } else {
    narrative = 'Bora manter o ritmo e desbloquear as próximas conquistas.';
  }

  let streakText = 'Sua melhor sequência do mês.';
  if (state.profile.streak <= 1) {
    streakText = 'É difícil começar. Amanhã você mantém a chama acesa.';
  } else if (state.profile.streak < 4) {
    streakText = 'Boa! Você já entrou na sequência.';
  } else if (state.profile.streak < 7) {
    streakText = 'Consistência tá on. Mantém mais um dia.';
  } else {
    streakText = 'Tá quente! Você tá virando o jogo na marra.';
  }

  greetings.forEach((el) => (el.textContent = greeting));
  profileName.forEach((el) => (el.textContent = state.profile.name));
  profileLevel.forEach((el) => (el.textContent = state.profile.level));
  profileXp.forEach((el) => (el.textContent = state.profile.xp));
  profileXpGoal.forEach((el) => (el.textContent = isMax ? 'MAX' : goal));
  profileXpRemaining.forEach((el) => (el.textContent = remaining));
  profileXpBar.forEach((el) => (el.style.width = `${progress * 100}%`));
  profileStreak.forEach((el) => (el.textContent = state.profile.streak));
  profileStreakBar.forEach((el) => (el.style.width = `${streakProgress * 100}%`));
  dashboardNarrative.forEach((el) => (el.textContent = narrative));
  streakTip.forEach((el) => (el.textContent = streakText));

  // Cores dinâmicas do foguinho baseadas no streak
  const streakIcons = document.querySelectorAll('[data-streak-icon]');
  streakIcons.forEach((icon) => {
    const streak = state.profile.streak;
    icon.classList.remove('streak-10', 'streak-20', 'streak-30', 'streak-40', 'streak-50', 'streak-60', 'streak-70', 'streak-80', 'streak-90', 'streak-100');
    
    if (streak >= 100) icon.classList.add('streak-100');
    else if (streak >= 90) icon.classList.add('streak-90');
    else if (streak >= 80) icon.classList.add('streak-80');
    else if (streak >= 70) icon.classList.add('streak-70');
    else if (streak >= 60) icon.classList.add('streak-60');
    else if (streak >= 50) icon.classList.add('streak-50');
    else if (streak >= 40) icon.classList.add('streak-40');
    else if (streak >= 30) icon.classList.add('streak-30');
    else if (streak >= 20) icon.classList.add('streak-20');
    else if (streak >= 10) icon.classList.add('streak-10');
  });

  focusLabel.forEach((el) => (el.textContent = state.focus?.label || 'Foco'));
  focusCurrent.forEach((el) => (el.textContent = String(state.focus?.current ?? 0)));
  focusTarget.forEach((el) => (el.textContent = String(state.focus?.target ?? 0)));
  focusXp.forEach((el) => (el.textContent = String(state.focus?.xp ?? 0)));
  focusBar.forEach((el) => (el.style.width = `${focusProgress * 100}%`));
};

const renderMissions = () => {
  const container = document.querySelector('[data-missions]');
  if (!container) return;

  const onboarding = state.progress?.onboarding && typeof state.progress.onboarding === 'object' ? state.progress.onboarding : null;
  const welcomeCard =
    onboarding?.welcomeAwarded === true
      ? `
        <div class="card mission-card mission-card--welcome">
          <div class="badge">boas-vindas</div>
          <div>
            <h4>Conta criada</h4>
            <p class="muted">1/1</p>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width: 100%"></div>
          </div>
          <div class="mission-footer">
            <span class="chip">+${onboarding?.welcomeXp ?? 30} XP</span>
            <span class="muted">Feito</span>
          </div>
        </div>
      `
      : '';

  const tourDone = onboarding?.tourRewardGranted === true;
  const tourCard =
    onboarding?.welcomeAwarded === true
      ? `
        <div class="card mission-card mission-card--welcome">
          <div class="badge">boas-vindas</div>
          <div>
            <h4>Tutorial completo</h4>
            <p class="muted">${tourDone ? '1/1' : '0/1'}</p>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width: ${tourDone ? 100 : 0}%"></div>
          </div>
          <div class="mission-footer">
            <span class="chip">+${onboarding?.tourXp ?? 30} XP</span>
            <span class="muted">${tourDone ? 'Feito' : 'Automático'}</span>
          </div>
        </div>
      `
      : '';

  container.innerHTML =
    welcomeCard +
    tourCard +
    state.missions
    .map((mission) => {
      const progress = Math.round((mission.progress / mission.total) * 100);
      const isDone = mission.progress >= mission.total;
      return `
        <div class="card mission-card" data-mission-id="${mission.id}">
          <div class="badge">${mission.type}</div>
          <div>
            <h4>${mission.label}</h4>
            <p class="muted">${mission.progress}/${mission.total}</p>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width: ${progress}%"></div>
          </div>
          <div class="mission-footer">
            <span class="chip">+${mission.xp} XP</span>
            <span class="muted">${isDone ? 'Feito' : 'Automático'}</span>
          </div>
        </div>
      `;
    })
    .join('');
};

const renderChallenges = () => {
  const container = document.querySelector('[data-challenges]');
  if (!container) return;

  container.innerHTML = state.challenges
    .map((challenge) => {
      const progress = Math.round((challenge.progress / challenge.total) * 100);
      const isDone = challenge.progress >= challenge.total;
      return `
        <div class="card mission-card" data-challenge-id="${challenge.id}">
          <div class="badge">${challenge.type}</div>
          <div>
            <h4>${challenge.label}</h4>
            <p class="muted">${challenge.progress}/${challenge.total}</p>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width: ${progress}%"></div>
          </div>
          <div class="mission-footer">
            <span class="chip">+${challenge.xp} XP</span>
            <span class="muted">${isDone ? 'Feito' : 'Automático'}</span>
          </div>
        </div>
      `;
    })
    .join('');
};

/* ── Model campaign rendering helpers ──────────────────────── */

const renderModelOutreachBar = (campaign) => {
  if (!campaign.isModel || !campaign.modelMeta) return '';
  const meta = campaign.modelMeta;
  const sent = meta.outreachSent || 0;
  const goal = meta.weeklyGoal || 5;
  const pct = Math.min(100, Math.round((sent / goal) * 100));
  return `
    <div class="model-outreach-bar">
      <div class="model-outreach-info">
        <span>Propostas: <strong>${sent}/${goal}</strong></span>
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

const renderCampaigns = () => {
  const container = document.querySelector('[data-campaigns]');
  if (!container) return;

  const filter = state.ui.campaignFilter || 'all';

  const escapeHtml = (value) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const formatDateShortBR = (raw) => {
    const value = String(raw || '').trim();
    if (!value) return 'indefinido';
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return value;
    const day = match[3];
    const month = match[2];
    const year = match[1];
    const currentYear = String(new Date().getFullYear());
    return year === currentYear ? `${day}/${month}` : `${day}/${month}/${year}`;
  };

  const getValueLabel = (campaign) => {
    const value = Number.isFinite(campaign?.value) ? campaign.value : parseInt(String(campaign?.value || ''), 10) || 0;
    const hasMoney = value > 0;
    if (!hasMoney && !campaign?.barter) return 'indefinido';
    if (!hasMoney && campaign?.barter) return 'permuta';
    return formatCurrency(value);
  };

  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });

  const allCampaigns = Array.isArray(state.campaigns) ? state.campaigns : [];
  const list = allCampaigns
    .filter((campaign) => {
      if (filter !== 'all' && campaign.status !== filter) return false;
      return true;
    })
    .sort((a, b) => {
      // Prioridades primeiro
      if (a.priority && !b.priority) return -1;
      if (!a.priority && b.priority) return 1;
      return 0;
    });

  if (!list.length) {
    container.innerHTML = '<div class="card">Nenhuma campanha por aqui.</div>';
    return;
  }

  const renderStatusOptions = (current) => {
    return campaignStatusOrder
      .map((key) => {
        return `<option value="${key}" ${key === current ? 'selected' : ''}>${statusLabels[key]}</option>`;
      })
      .join('');
  };

  container.innerHTML = `
    <div class="table-wrap campaign-table-wrap">
      <table class="campaign-table">
        <thead>
          <tr>
            <th>Marca</th>
            <th>Prazo</th>
            <th>Pre\u00e7o</th>
            <th>Status</th>
            <th>Etapa</th>
            <th>Avan\u00e7ar</th>
            <th>A\u00e7\u00f5es</th>
          </tr>
        </thead>
        <tbody>
          ${list
            .map((campaign) => {
              const statusSafe = Object.prototype.hasOwnProperty.call(statusLabels, campaign.status) ? campaign.status : 'prospeccao';
              const stageOptions = getCampaignStageOptions(statusSafe);
              const stageSafe = stageOptions.some((opt) => opt.id === campaign.stage) ? campaign.stage : stageOptions[0]?.id || '';
              const stageDisabled = stageOptions.length ? '' : 'disabled';

              const stageOptionsHtml = stageOptions.length
                ? stageOptions
                    .map((opt) => {
                      return `<option value="${opt.id}" ${opt.id === stageSafe ? 'selected' : ''}>${opt.label}</option>`;
                    })
                    .join('')
                : '<option value="">-</option>';

              // Calcular próxima etapa para botão de avanço
              const currentStageIndex = stageOptions.findIndex((opt) => opt.id === stageSafe);
              const isLastStage = currentStageIndex >= stageOptions.length - 1;
              const currentStatusIndex = campaignStatusOrder.indexOf(statusSafe);
              const isLastStatus = currentStatusIndex >= campaignStatusOrder.length - 1;

              let advanceBtnHtml = '';
              if (!isLastStatus || !isLastStage) {
                if (!isLastStage) {
                  const nextStage = stageOptions[currentStageIndex + 1];
                  advanceBtnHtml = `
                    <button class="btn-advance" data-action="advance-stage" data-campaign-id="${campaign.id}" type="button">
                      <span class="btn-advance-label">Avançar: ${escapeHtml(nextStage.label)}</span>
                      <span class="btn-advance-xp">+5 XP</span>
                    </button>`;
                } else if (!isLastStatus) {
                  const nextStatus = campaignStatusOrder[currentStatusIndex + 1];
                  const nextStatusLabel = statusLabels[nextStatus] || nextStatus;
                  advanceBtnHtml = `
                    <button class="btn-advance btn-advance-status" data-action="advance-stage" data-campaign-id="${campaign.id}" type="button">
                      <span class="btn-advance-label">Avançar: ${escapeHtml(nextStatusLabel)}</span>
                      <span class="btn-advance-xp">+5 XP</span>
                    </button>`;
                }
              }


              const isPriority = campaign.priority === true;
              const isModel = campaign.isModel === true;
              const priorityIcon = isPriority
                ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>'
                : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';

              // Model campaigns: locked selects, outreach bar, convert button
              const modelConvertBtn = isModel ? renderModelAdvanceBtn(campaign) : null;
              const modelOutreach = isModel ? renderModelOutreachBar(campaign) : '';

              return `
                <tr data-campaign-id="${campaign.id}" class="${isPriority ? 'campaign-priority' : ''}${isModel ? ' campaign-model' : ''}">
                  <td data-label="Marca">
                    <div style="display:flex;align-items:center;gap:4px">
                      <button class="btn-priority ${isPriority ? 'active' : ''}" data-action="toggle-priority" data-campaign-id="${campaign.id}" type="button" title="${isPriority ? 'Remover prioridade' : 'Marcar como prioridade'}">
                        ${priorityIcon}
                      </button>
                      <span class="chip chip-pill brand-status-${statusSafe}">${escapeHtml(campaign.brand || 'Marca')}</span>
                      ${isModel ? '<span class="badge-model">MODELO</span>' : ''}
                    </div>
                  </td>
                  <td data-label="Prazo">${isModel ? '<span class="model-locked">—</span>' : escapeHtml(formatDateShortBR(campaign.dueDate))}</td>
                  <td data-label="Preço">${isModel ? '<span class="model-locked">—</span>' : escapeHtml(getValueLabel(campaign))}</td>
                  <td data-label="Status">
                    ${isModel
                      ? `<span class="select select-compact status-${statusSafe} model-select-locked">${statusLabels[statusSafe] || statusSafe}</span>`
                      : `<select class="select select-compact status-${statusSafe}" data-campaign-status data-campaign-id="${campaign.id}">${renderStatusOptions(statusSafe)}</select>`
                    }
                  </td>
                  <td data-label="Etapa">
                    ${isModel
                      ? `<span class="select select-compact stage-${statusSafe} model-select-locked">${stageOptions.find(o => o.id === stageSafe)?.label || '—'}</span>`
                      : `<select class="select select-compact stage-${statusSafe}" ${stageDisabled} data-campaign-stage data-campaign-id="${campaign.id}">${stageOptionsHtml}</select>`
                    }
                  </td>
                  <td data-label="Avançar" ${isModel ? 'colspan="1"' : ''}>
                    <div class="stage-btns">
                      ${isModel ? (modelConvertBtn || '') : advanceBtnHtml}
                    </div>
                  </td>
                  <td data-label="Ações">
                    ${isModel
                      ? modelOutreach
                      : `<div class="campaign-action-btns">
                          <button class="btn-action btn-action--duplicate" data-action="duplicate-campaign" data-campaign-id="${campaign.id}" type="button">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                            Duplicar
                          </button>
                          <button class="btn-action btn-action--edit" data-action="edit-campaign" data-campaign-id="${campaign.id}" type="button">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            Editar
                          </button>
                        </div>`
                    }
                  </td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;
};

const renderBrands = () => {
  const container = document.querySelector('[data-brands]');
  if (!container) return;

  const hero = document.querySelector('[data-brand-hero]');
  const insightsContainer = document.querySelector('[data-brand-insights]');
  const brandsSection = container.closest('section');

  const composerBrandSelect = document.querySelector('[data-brand-composer="brand"]');
  const composerTypeSelect = document.querySelector('[data-brand-composer="type"]');
  const composerTextArea = document.querySelector('[data-brand-composer="text"]');
  const composerHint = document.querySelector('[data-brand-composer="hint"]');

  if (insightsContainer && brandsSection) {
    const insightsCard = insightsContainer.closest('.card');
    const spacer = insightsCard?.previousElementSibling;
    const shouldMoveSpacer = spacer?.tagName === 'DIV' && String(spacer.getAttribute('style') || '').includes('margin-top');
    if (shouldMoveSpacer) brandsSection.appendChild(spacer);
    if (insightsCard) brandsSection.appendChild(insightsCard);
  }

  const brands = Array.isArray(state.brands) ? state.brands : [];
  const total = brands.length;
  const sentCount = brands.filter((brand) => brand.status === 'enviado').length;
  const negotiatingCount = brands.filter((brand) => brand.status === 'negociando').length;
  const closedCount = brands.filter((brand) => brand.status === 'fechado').length;
  const respondedCount = brands.filter((brand) => ['negociando', 'fechado'].includes(brand.status)).length;
  const responseRate = total ? respondedCount / total : 0;

  if (hero) {
    if (!total) {
      hero.innerHTML = `
        <div class="metric-hero">
          <div class="metric-hero-title">
            <h3>Suas conversas com marcas</h3>
            <p class="muted">Adiciona uma marca e começa a registrar tudo por aqui.</p>
          </div>
          <div class="metric-hero-badges">
            <span class="chip">0 marcas</span>
          </div>
        </div>
      `;
    } else {
      hero.innerHTML = `
        <div class="metric-hero">
          <div class="metric-hero-title">
            <h3>Suas conversas com marcas</h3>
            <p class="muted">
              <strong>${total}</strong> marcas no radar • ${respondedCount} responderam (${formatPercent(responseRate)}).
            </p>
          </div>
          <div class="metric-hero-badges">
            <span class="chip chip-pendente">Mandei msg: ${sentCount}</span>
            <span class="chip chip-negociando">Negociando: ${negotiatingCount}</span>
            <span class="chip chip-realizado">Fechou: ${closedCount}</span>
          </div>
        </div>
      `;
    }
  }

  if (insightsContainer) {
    const insights = [];

    if (!total) {
      insights.push({
        icon: 'send',
        title: 'Bora começar',
        text: 'Clica em “+ Marca nova” e adiciona seu primeiro contato.'
      });
    }

    if (sentCount > 0) {
      insights.push({
        icon: 'send',
        title: 'Follow-up rápido',
        text: `Você tem ${sentCount} contato(s) esperando resposta. Faz 1 follow-up hoje e pronto.`
      });
    }

    if (negotiatingCount > 0) {
      insights.push({
        icon: 'chat',
        title: 'Negociação quente',
        text: `Tem ${negotiatingCount} em negociação. Simplifica: 2 vídeos + 3 cortes e fecha.`
      });
    }

    if (closedCount > 0) {
      insights.push({
        icon: 'trend',
        title: 'Repetir a dose',
        text: 'Fechou uma? Já puxa a próxima com a mesma marca. É o jeito mais fácil de crescer.'
      });
    }

    while (insights.length < 3) {
      insights.push({
        icon: 'radar',
        title: 'Ritmo constante',
        text: 'Todo dia um passo: abordagem, follow-up, proposta. Sem pressão, só constância.'
      });
    }

    insightsContainer.innerHTML = `
      <div class="insight-list">
        ${insights
          .slice(0, 3)
          .map(
            (item) => `
              <div class="insight-item">
                <div class="metric-icon">${iconSvg(item.icon)}</div>
                <div>
                  <div style="font-weight: 600; margin-bottom: 4px;">${item.title}</div>
                  <div class="muted">${item.text}</div>
                </div>
              </div>
            `
          )
          .join('')}
      </div>
    `;
  }

  const buildBrandMessage = (brand, type) => {
    const creator = state.profile.name || 'eu';
    const contact = brand?.contact || 'pessoal';
    const brandName = brand?.name || 'a marca';

    const templates = {
      first: `Oi ${contact}! Tudo certo?\n\nAqui é o ${creator}. Eu curti a ${brandName} e pensei em umas ideias de UGC que combinam com vocês.\n\nPosso te mandar 3 ideias rapidinhas e valores?`,
      followup: `Oi ${contact}! Passando só pra dar um toque.\n\nSe fizer sentido, eu já consigo te mandar 2 opções de roteiro + um plano de entrega bem simples.`,
      deliver: `Oi ${contact}! Tá tudo pronto por aqui.\n\nSegue o link/arquivos dos entregáveis: [colar link aqui]\n\nSe quiser algum ajuste, me fala que eu deixo redondo.`,
      review: `Oi ${contact}! Vi seus feedbacks.\n\nJá tô com a revisão encaminhada — tem algo que você quer que eu priorize primeiro?`,
      approve: `Oi ${contact}! Última checagem: posso considerar aprovado?\n\nSe estiver tudo ok, eu já sigo com a publicação/entrega final.`
    };

    return templates[type] || templates.first;
  };

  if (composerBrandSelect && composerTypeSelect && composerTextArea) {
    state.ui.brandComposer = state.ui.brandComposer || { brandId: null, type: 'first', text: '' };

    if (!brands.length) {
      composerBrandSelect.innerHTML = '<option value="">Adicione uma marca primeiro</option>';
      composerBrandSelect.disabled = true;
      composerTypeSelect.disabled = true;
      composerTextArea.disabled = true;
      if (composerHint) composerHint.textContent = 'Crie uma marca acima para continuar.';
    } else {
      composerBrandSelect.disabled = false;
      composerTypeSelect.disabled = false;
      composerTextArea.disabled = false;
      if (composerHint) composerHint.textContent = 'Dica: troca o texto e deixa com a sua cara.';

      const storedBrandId = state.ui.brandComposer.brandId;
      const fallbackBrandId = brands[0]?.id;
      const selectedBrandId = brands.some((b) => b.id === storedBrandId)
        ? storedBrandId
        : fallbackBrandId;

      const storedType = state.ui.brandComposer.type || 'first';
      const hasType = Boolean(composerTypeSelect.querySelector(`option[value="${storedType}"]`));
      const selectedType = hasType ? storedType : 'first';

      state.ui.brandComposer.brandId = selectedBrandId;
      state.ui.brandComposer.type = selectedType;

      composerBrandSelect.innerHTML = brands
        .map((brand) => `<option value="${brand.id}">${brand.name}</option>`)
        .join('');
      composerBrandSelect.value = selectedBrandId;
      composerTypeSelect.value = selectedType;

      const selectedBrand = brands.find((b) => b.id === selectedBrandId);
      const shouldRegen =
        !state.ui.brandComposer.text ||
        state.ui.brandComposer.lastBrandId !== selectedBrandId ||
        state.ui.brandComposer.lastType !== selectedType;

      if (shouldRegen) {
        state.ui.brandComposer.text = buildBrandMessage(selectedBrand, selectedType);
        state.ui.brandComposer.lastBrandId = selectedBrandId;
        state.ui.brandComposer.lastType = selectedType;
      }

      if (document.activeElement !== composerTextArea) {
        composerTextArea.value = state.ui.brandComposer.text || '';
      }
    }
  }

  container.innerHTML = brands
    .map((brand) => {
      return `
        <div class="card brand-card" data-brand-id="${brand.id}">
          <div class="brand-info">
            <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
              <strong>${brand.name}</strong>
              <span class="chip chip-pill">${brandStatuses[brand.status]}</span>
            </div>
            <div class="muted">${brand.contact} • ${brand.email}</div>
          </div>
          <div class="brand-controls">
            <button class="btn btn-ghost btn-small" data-action="copy-brand-email" data-brand-id="${brand.id}" type="button">
              Copiar email
            </button>
            <button class="btn btn-danger btn-small" data-action="delete-brand" data-brand-id="${brand.id}" type="button">
              Excluir
            </button>
            <select class="select" data-brand-status data-brand-id="${brand.id}">
              ${brandOptions
                .map(
                  (status) =>
                    `<option value="${status}" ${status === brand.status ? 'selected' : ''}>${brandStatuses[status]}</option>`
                )
                .join('')}
            </select>
          </div>
        </div>
      `;
    })
    .join('');
};

/* ──────────────────── MÉTRICAS ──────────────────── */

const METRIC_RANGE_OPTIONS = [7, 15, 30, 45, 90];
const METRIC_COLORS = ['#34d399','#38bdf8','#f59e0b','#a78bfa','#fb7185','#22d3ee','#818cf8','#f97316'];

const escapeHtml = (v) =>
  String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

const getCampaignName = (c) => String(c?.title || c?.brand || 'Campanha sem nome').trim() || 'Campanha sem nome';

const toSafe = (v) => { if (Number.isFinite(v)) return v; const p = Number.parseFloat(String(v||'').replace(',','.')); return Number.isFinite(p) ? p : 0; };

const parseDate = (v) => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; };

const toDayStart = (v) => { const d = parseDate(v); if (!d) return null; return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); };

const addDays = (d, n) => { const x = new Date(d.getTime()); x.setUTCDate(x.getUTCDate() + n); return x; };

const dateKey = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;

const fmtDateBR = (v) => { const d = parseDate(v); if (!d) return '-'; return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()}`; };

const inWindow = (d, s, e) => Boolean(d && d >= s && d < e);

const daysBetweenD = (a, b) => { const s = toDayStart(a), e = toDayStart(b); if (!s||!e) return 0; return Math.max(0, Math.floor((e-s)/86400000)); };

const getPaidAt = (c) => parseDate(c?.paymentDate || c?.paidAt || c?.paidDate);

const getDaysStalled = (c, now) => { const r = parseDate(c?.updatedAt) || parseDate(c?.createdAt); if (!r) return 0; const d = daysBetweenD(r, now); return Number.isFinite(d) ? d : 0; };

const buildDateRange = (start, days) => Array.from({ length: days }, (_, i) => addDays(start, i));

/* ── computeMetrics ── */

const computeMetrics = () => {
  const now = new Date();
  const rangeDays = METRIC_RANGE_OPTIONS.includes(Number(state.metrics?.rangeDays)) ? Number(state.metrics.rangeDays) : 30;
  const today = toDayStart(now) || new Date();
  const curStart = addDays(today, -(rangeDays - 1));
  const curEnd = addDays(today, 1);
  const prevStart = addDays(curStart, -rangeDays);
  const prevEnd = curStart;

  const campaigns = (Array.isArray(state.campaigns) ? state.campaigns : []).map(c => {
    const createdAt = parseDate(c.createdAt);
    const updatedAt = parseDate(c.updatedAt) || createdAt;
    const paidAt = getPaidAt(c);
    return { ...c, value: Math.max(0, toSafe(c.value)), createdAt, updatedAt, paidAt };
  });

  const total = campaigns.length;
  const prospeccaoCount = campaigns.filter(c => c.status === 'prospeccao').length;
  const producaoCount = campaigns.filter(c => c.status === 'producao').length;
  const finalizacaoCount = campaigns.filter(c => c.status === 'finalizacao').length;
  const done = campaigns.filter(c => c.status === 'concluida');
  const doneCount = done.length;

  /* POCKET */
  const totalHist = done.reduce((s, c) => s + c.value, 0);
  const paidTimeline = [...done]
    .sort((a, b) => (b.paidAt || b.updatedAt || 0) - (a.paidAt || a.updatedAt || 0))
    .map(c => ({ name: getCampaignName(c), value: c.value, date: fmtDateBR(c.paidAt || c.updatedAt || c.createdAt) }));
  const pieTotal = totalHist || 1;
  const paidPie = done.map((c, i) => ({ label: getCampaignName(c), value: c.value, color: METRIC_COLORS[i % METRIC_COLORS.length] }));

  /* TABLE */
  const openC = campaigns.filter(c => c.status !== 'concluida');
  const totalOpen = openC.reduce((s, c) => s + c.value, 0);
  const statusBk = {
    prospeccao: openC.filter(c => c.status === 'prospeccao').reduce((s, c) => s + c.value, 0),
    producao: openC.filter(c => c.status === 'producao').reduce((s, c) => s + c.value, 0),
    finalizacao: openC.filter(c => c.status === 'finalizacao').reduce((s, c) => s + c.value, 0)
  };
  const oldest = [...openC]
    .map(c => ({ name: getCampaignName(c), value: c.value, days: getDaysStalled(c, now) }))
    .sort((a, b) => b.days - a.days).slice(0, 5);

  /* CLOSING */
  const days = buildDateRange(curStart, rangeDays);
  const dKeys = days.map(d => dateKey(d));
  const dLabels = days.map(d => fmtDateBR(d));

  const paidCur = done.filter(c => { const d = c.paidAt || c.updatedAt; return d && inWindow(d, curStart, curEnd); });
  const paidPrev = done.filter(c => { const d = c.paidAt || c.updatedAt; return d && inWindow(d, prevStart, prevEnd); });

  const closedByDay = {};
  paidCur.forEach(c => { const k = dateKey(toDayStart(c.paidAt || c.updatedAt)); closedByDay[k] = (closedByDay[k] || 0) + 1; });
  const closeSeries = dKeys.map(k => closedByDay[k] || 0);

  const abordagem = campaigns.filter(c => c.createdAt && inWindow(c.createdAt, curStart, curEnd)).length;
  const respostas = campaigns.filter(c => {
    const d = c.updatedAt || c.createdAt;
    if (!d || !inWindow(d, curStart, curEnd)) return false;
    return c.status !== 'prospeccao' || !['abordagem','abordagem_inscricao',''].includes(String(c.stage || ''));
  }).length;
  const negociacao = campaigns.filter(c => {
    const d = c.updatedAt || c.createdAt;
    return d && inWindow(d, curStart, curEnd) && String(c.stage || '') === 'negociacao';
  }).length;
  const rate = abordagem > 0 ? paidCur.length / abordagem : 0;

  let closeComp = '';
  if (paidPrev.length <= 0 && paidCur.length <= 0) closeComp = `Nos \u00faltimos ${rangeDays} dias ainda n\u00e3o rolou fechamento.`;
  else if (paidPrev.length <= 0 && paidCur.length > 0) closeComp = `Nos \u00faltimos ${rangeDays} dias voc\u00ea come\u00e7ou a fechar campanhas.`;
  else {
    const delta = Math.round(((paidCur.length - paidPrev.length) / paidPrev.length) * 100);
    if (delta > 0) closeComp = `Nos \u00faltimos ${rangeDays} dias voc\u00ea teve +${delta}% mais fechamento que no per\u00edodo anterior.`;
    else if (delta < 0) closeComp = `Nos \u00faltimos ${rangeDays} dias voc\u00ea teve ${Math.abs(delta)}% menos fechamento que no per\u00edodo anterior.`;
    else closeComp = `Nos \u00faltimos ${rangeDays} dias seu fechamento ficou est\u00e1vel.`;
  }

  /* AVERAGE */
  const avgCur = paidCur.length ? Math.round(paidCur.reduce((s, c) => s + c.value, 0) / paidCur.length) : (doneCount ? Math.round(totalHist / doneCount) : 0);
  const avgPrev = paidPrev.length ? Math.round(paidPrev.reduce((s, c) => s + c.value, 0) / paidPrev.length) : 0;
  const ticketBands = [
    { label: 'Baixo (\u2264 R$ 500)', value: done.filter(c => c.value <= 500).length },
    { label: 'M\u00e9dio (R$ 501\u20131.500)', value: done.filter(c => c.value > 500 && c.value <= 1500).length },
    { label: 'Alto (> R$ 1.500)', value: done.filter(c => c.value > 1500).length }
  ];
  const top3 = [...done].sort((a, b) => b.value - a.value).slice(0, 3).map(c => ({ name: getCampaignName(c), value: c.value, date: fmtDateBR(c.paidAt || c.updatedAt || c.createdAt) }));
  let avgComp = '';
  if (avgPrev <= 0 && avgCur <= 0) avgComp = `Ainda sem refer\u00eancia de m\u00e9dia nos \u00faltimos ${rangeDays} dias.`;
  else if (avgPrev <= 0 && avgCur > 0) avgComp = `Voc\u00ea come\u00e7ou a formar m\u00e9dia de ${formatCurrency(avgCur)} nos \u00faltimos ${rangeDays} dias.`;
  else { const diff = avgCur - avgPrev; if (diff > 0) avgComp = `Sua m\u00e9dia subiu ${formatCurrency(diff)} em rela\u00e7\u00e3o ao per\u00edodo anterior.`; else if (diff < 0) avgComp = `Sua m\u00e9dia caiu ${formatCurrency(Math.abs(diff))} em rela\u00e7\u00e3o ao per\u00edodo anterior.`; else avgComp = 'Sua m\u00e9dia ficou est\u00e1vel vs per\u00edodo anterior.'; }

  /* PAYTIME */
  const getPayDays = (c) => { const s = c.createdAt, e = c.paidAt || c.updatedAt; if (!s||!e) return null; const d = daysBetweenD(s, e); return Number.isFinite(d) ? d : null; };
  const allPay = done.map(c => ({ c, days: getPayDays(c), eff: c.paidAt || c.updatedAt })).filter(i => i.days !== null);
  const payCur = allPay.filter(i => i.eff && inWindow(i.eff, curStart, curEnd));
  const payPrev = allPay.filter(i => i.eff && inWindow(i.eff, prevStart, prevEnd));
  const paySrc = payCur.length > 0 ? payCur : allPay.slice(0, 10);
  const avgPayCur = paySrc.length ? Math.round(paySrc.reduce((s, i) => s + i.days, 0) / paySrc.length) : 0;
  const avgPayPrev = payPrev.length ? Math.round(payPrev.reduce((s, i) => s + i.days, 0) / payPrev.length) : 0;

  const tByDay = {};
  paySrc.forEach(i => { const k = dateKey(toDayStart(i.eff)); if (!tByDay[k]) tByDay[k] = []; tByDay[k].push(i.days); });
  const paySeries = dKeys.map(k => { const v = tByDay[k] || []; return v.length ? Math.round(v.reduce((s,x)=>s+x,0)/v.length) : 0; });
  const payList = [...paySrc].sort((a, b) => (b.eff||0)-(a.eff||0)).map(i => ({ name: getCampaignName(i.c), days: i.days, date: fmtDateBR(i.eff) }));

  return {
    rangeDays, total, prospeccaoCount, producaoCount, finalizacaoCount, doneCount,
    pocket: { totalHist, paidTimeline, paidPie, pieTotal },
    table: { totalOpen, statusBk, oldest },
    closing: { series: closeSeries, labels: dLabels, funnel: { abordagens: abordagem, respostas, negociacao, fechadas: paidCur.length }, rate, comp: closeComp },
    average: { cur: avgCur, prev: avgPrev, ticketBands, top3, comp: avgComp },
    paytime: { cur: avgPayCur, prev: avgPayPrev, series: paySeries, labels: dLabels, list: payList }
  };
};

/* ── SVG Charts ── */

const renderPieChart = (slices, total) => {
  if (!slices.length || total <= 0) return '<div class="metric-empty">Sem dados para gr\u00e1fico.</div>';
  const sz = 200, cx = sz/2, cy = sz/2, r = 80;
  let sa = -Math.PI / 2;
  const paths = slices.map((sl) => {
    const frac = sl.value / total;
    const ang = frac * Math.PI * 2;
    const ea = sa + ang;
    const la = ang > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(sa), y1 = cy + r * Math.sin(sa);
    const x2 = cx + r * Math.cos(ea), y2 = cy + r * Math.sin(ea);
    const d = frac >= 0.9999
      ? `M ${cx} ${cy-r} A ${r} ${r} 0 1 1 ${cx-0.01} ${cy-r} A ${r} ${r} 0 1 1 ${cx} ${cy-r}`
      : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${la} 1 ${x2} ${y2} Z`;
    sa = ea;
    return `<path d="${d}" fill="${sl.color}" opacity="0.85"><title>${escapeHtml(sl.label)}: ${formatCurrency(sl.value)}</title></path>`;
  });
  return `<svg viewBox="0 0 ${sz} ${sz}" class="metric-pie-svg">${paths.join('')}</svg>`;
};

const renderLineChartSvg = (series, labels, unit) => {
  if (!series.length) return '<div class="metric-empty">Sem dados.</div>';
  const mx = Math.max(...series, 1);
  const w = 400, h = 160, pad = 30;
  const stepX = series.length > 1 ? (w - pad*2) / (series.length - 1) : 0;
  const pts = series.map((v, i) => { const x = pad + i*stepX; const y = h - pad - ((v/mx)*(h-pad*2)); return `${x.toFixed(1)},${y.toFixed(1)}`; });
  const lStep = Math.max(1, Math.floor(labels.length / 5));
  const ticks = labels.map((l, i) => {
    if (i % lStep !== 0 && i !== labels.length - 1) return '';
    return `<text x="${(pad + i*stepX).toFixed(1)}" y="${h-5}" text-anchor="middle" fill="var(--muted)" font-size="10">${l.slice(0,5)}</text>`;
  }).join('');
  const dots = series.map((v, i) => {
    const x = pad + i*stepX, y = h - pad - ((v/mx)*(h-pad*2));
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" fill="var(--accent)"><title>${labels[i]}: ${v}${unit||''}</title></circle>`;
  }).join('');
  return `<svg viewBox="0 0 ${w} ${h}" class="metric-line-svg" preserveAspectRatio="xMidYMid meet">
    <polyline points="${pts.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    ${dots}${ticks}
  </svg>`;
};

const renderBarChartHtml = (items) => {
  const mx = Math.max(...items.map(i => i.value), 1);
  return `<div class="metric-bars">${items.map(i => {
    const w = Math.round((i.value / mx) * 100);
    return `<div class="metric-bar-row"><span class="metric-bar-lbl">${escapeHtml(i.label)}</span><div class="metric-bar-track"><div class="metric-bar-fill" style="width:${w}%"></div><span class="metric-bar-val">${i.value}</span></div></div>`;
  }).join('')}</div>`;
};

/* ── Render Metric Details ── */

const renderPocketDetail = (m) => {
  const timeline = m.pocket.paidTimeline.length
    ? `<ul class="metric-list">${m.pocket.paidTimeline.map((t, i) => {
        const color = METRIC_COLORS[i % METRIC_COLORS.length];
        return `<li style="border-left:3px solid ${color}"><span>${escapeHtml(t.name)}</span><strong>${formatCurrency(t.value)}</strong><small>pago em ${t.date}</small></li>`;
      }).join('')}</ul>`
    : '<div class="metric-empty">Nenhuma campanha conclu\u00edda ainda.</div>';
  return `
    <div class="metric-detail-grid">
      <div>
        <h4>Total hist\u00f3rico</h4>
        <div class="stat-value" style="font-size:2rem;margin:8px 0">${formatCurrency(m.pocket.totalHist)}</div>
        <p class="muted">Total recebido desde que voc\u00ea come\u00e7ou a usar o Makerline.</p>
      </div>
      <div>
        <h4>Distribui\u00e7\u00e3o por campanha</h4>
        ${renderPieChart(m.pocket.paidPie, m.pocket.pieTotal)}
      </div>
    </div>
    <div style="margin-top:20px">
      <h4>Linha do tempo</h4>
      ${timeline}
    </div>
  `;
};

const renderTableDetail = (m) => {
  const sbTotal = m.table.statusBk.prospeccao + m.table.statusBk.producao + m.table.statusBk.finalizacao;
  const segments = [
    { label: 'Prospec\u00e7\u00e3o', value: m.table.statusBk.prospeccao, cls: 'seg-prospeccao' },
    { label: 'Produ\u00e7\u00e3o', value: m.table.statusBk.producao, cls: 'seg-producao' },
    { label: 'Finaliza\u00e7\u00e3o', value: m.table.statusBk.finalizacao, cls: 'seg-finalizacao' }
  ];
  const barHtml = sbTotal > 0
    ? `<div class="metric-stack">${segments.map(seg => {
        const pct = Math.round((seg.value / sbTotal) * 100);
        const w = Math.max(4, pct);
        return `<div class="metric-stack-seg ${seg.cls}" style="width:${w}%" title="${escapeHtml(seg.label)}: ${formatCurrency(seg.value)} (${pct}%)">${w > 15 ? `<span>${pct}%</span>` : ''}</div>`;
      }).join('')}</div>
      <div class="metric-stack-legend">${segments.map(seg => `<div class="metric-legend-item ${seg.cls}"><div class="metric-legend-dot"></div><span>${escapeHtml(seg.label)}: ${formatCurrency(seg.value)}</span></div>`).join('')}</div>`
    : '<div class="metric-empty">Sem campanhas abertas.</div>';
  const oldHtml = m.table.oldest.length
    ? `<ul class="metric-list">${m.table.oldest.map(o => `<li><span>${escapeHtml(o.name)}</span><strong>${formatCurrency(o.value)}</strong><small>${o.days} dia(s) parado</small></li>`).join('')}</ul>`
    : '<div class="metric-empty">Nenhuma campanha parada.</div>';
  return `
    <div>
      <h4>Valor total em aberto</h4>
      <div class="stat-value" style="font-size:2rem;margin:8px 0">${formatCurrency(m.table.totalOpen)}</div>
    </div>
    <div style="margin-top:20px">
      <h4>Quebra por status</h4>
      ${barHtml}
    </div>
    <div style="margin-top:20px">
      <h4>Campanhas mais antigas</h4>
      ${oldHtml}
    </div>
  `;
};

const renderClosingDetail = (m) => {
  const funnelItems = [
    { label: 'Abordagens', value: m.closing.funnel.abordagens },
    { label: 'Respostas', value: m.closing.funnel.respostas },
    { label: 'Negocia\u00e7\u00e3o', value: m.closing.funnel.negociacao },
    { label: 'Fechadas', value: m.closing.funnel.fechadas }
  ];
  return `
    <div class="metric-detail-grid">
      <div>
        <h4>Evolu\u00e7\u00e3o do fechamento</h4>
        ${renderLineChartSvg(m.closing.series, m.closing.labels, '')}
      </div>
      <div>
        <h4>Funil simplificado</h4>
        ${renderBarChartHtml(funnelItems)}
      </div>
    </div>
    <div style="margin-top:16px">
      <p class="muted metric-compare-text">${escapeHtml(m.closing.comp)}</p>
    </div>
  `;
};

const renderAverageDetail = (m) => {
  const topHtml = m.average.top3.length
    ? `<ul class="metric-list">${m.average.top3.map((t, i) => {
        const color = METRIC_COLORS[i % METRIC_COLORS.length];
        return `<li style="border-left:3px solid ${color}"><span>${escapeHtml(t.name)}</span><strong>${formatCurrency(t.value)}</strong><small>${t.date}</small></li>`;
      }).join('')}</ul>`
    : '<div class="metric-empty">Sem campanhas conclu\u00eddas.</div>';
  return `
    <div class="metric-detail-grid">
      <div>
        <h4>Distribui\u00e7\u00e3o por ticket</h4>
        ${renderBarChartHtml(m.average.ticketBands)}
      </div>
      <div>
        <h4>Top campanhas que puxaram a m\u00e9dia</h4>
        ${topHtml}
      </div>
    </div>
    <div style="margin-top:16px">
      <p class="muted metric-compare-text">${escapeHtml(m.average.comp)}</p>
    </div>
  `;
};

const renderPaytimeDetail = (m) => {
  const listHtml = m.paytime.list.length
    ? `<ul class="metric-list">${m.paytime.list.map(i => `<li><span>${escapeHtml(i.name)}</span><strong>${i.days} dia(s)</strong><small>${i.date}</small></li>`).join('')}</ul>`
    : '<div class="metric-empty">Sem dados de tempo.</div>';
  return `
    <div class="metric-detail-grid">
      <div>
        <h4>Tend\u00eancia do tempo para pagar</h4>
        ${renderLineChartSvg(m.paytime.series, m.paytime.labels, ' dias')}
      </div>
      <div>
        <h4>Tempo por campanha</h4>
        ${listHtml}
      </div>
    </div>
  `;
};

const METRIC_DETAIL_FN = { pocket: renderPocketDetail, table: renderTableDetail, closing: renderClosingDetail, average: renderAverageDetail, paytime: renderPaytimeDetail };

/* ── renderMetrics ── */

const renderMetrics = () => {
  const rangeBar = document.querySelector('[data-metric-range]');
  const container = document.querySelector('[data-metrics]');
  const expandedEl = document.querySelector('[data-metric-expanded]');
  if (!container) return;

  const metrics = computeMetrics();
  const openMetric = String(state.ui?.openMetric || '');

  /* filtro de per\u00edodo */
  if (rangeBar) {
    rangeBar.innerHTML = METRIC_RANGE_OPTIONS.map(d => {
      const active = d === metrics.rangeDays;
      return `<button class="metric-range-btn ${active ? 'is-active' : ''}" data-action="metric-range" data-range-days="${d}" type="button">${d}d</button>`;
    }).join('');
  }

  /* 6 cards no estilo original */
  const cards = [
    { key: 'pocket', icon: 'cash', label: 'J\u00e1 recebido', value: formatCurrency(metrics.pocket.totalHist), caption: `${metrics.doneCount} campanha(s) paga(s).` },
    { key: 'table', icon: 'trend', label: 'Ainda pendente', value: formatCurrency(metrics.table.totalOpen), caption: `${metrics.total - metrics.doneCount} campanha(s) aberta(s).` },
    { key: 'closing', icon: 'bars', label: 'Taxa de fechamento', value: formatPercent(metrics.closing.rate), caption: `${metrics.closing.funnel.fechadas} fechada(s) no per\u00edodo.` },
    { key: 'average', icon: 'ticket', label: 'M\u00e9dia por campanha', value: formatCurrency(metrics.average.cur), caption: 'Nas campanhas conclu\u00eddas.' },
    { key: 'paytime', icon: 'time', label: 'Tempo m\u00e9dio', value: `${metrics.paytime.cur} dias`, caption: 'Da cria\u00e7\u00e3o at\u00e9 o pagamento.' },
    { key: 'total', icon: 'radar', label: 'Total em campanhas', value: formatCurrency(metrics.pocket.totalHist + metrics.table.totalOpen), caption: `${metrics.total} campanha(s) no total.` }
  ];

  container.innerHTML = cards.map(card => {
    const hasDetail = Boolean(METRIC_DETAIL_FN[card.key]);
    const isOpen = openMetric === card.key;
    const clickAttr = hasDetail ? `data-action="metric-toggle" data-metric-key="${card.key}"` : '';
    const clickCls = hasDetail ? 'metric-card-click' : '';
    const activeCls = isOpen ? 'is-active' : '';
    const extra = card.key === 'closing'
      ? `<div class="progress-track"><div class="progress-fill" style="width: ${metrics.closing.rate * 100}%"></div></div>`
      : '';
    return `
      <div class="card metric-card ${clickCls} ${activeCls}" ${clickAttr}>
        <div class="metric-icon">${iconSvg(card.icon)}</div>
        <div class="muted">${card.label}</div>
        <div class="stat-value">${card.value}</div>
        ${extra}
        <p class="muted">${card.caption}</p>
      </div>
    `;
  }).join('');

  /* painel expandido */
  if (expandedEl && openMetric && METRIC_DETAIL_FN[openMetric]) {
    const cardDef = cards.find(c => c.key === openMetric);
    expandedEl.innerHTML = `
      <div class="card metric-expanded-card">
        <div class="metric-expanded-header">
          <div>
            <div class="metric-expanded-icon">${iconSvg(cardDef?.icon || 'trend')}</div>
            <h3>${cardDef?.label || ''}</h3>
            <p class="muted">${cardDef?.caption || ''}</p>
          </div>
          <button class="btn btn-ghost btn-small" data-action="metric-close" type="button">Fechar</button>
        </div>
        <div class="metric-expanded-body">
          ${METRIC_DETAIL_FN[openMetric](metrics)}
        </div>
      </div>
    `;
  } else if (expandedEl) {
    expandedEl.innerHTML = '';
  }
};


const getAchievements = () => {
  const unlockedIds = new Set(
    Array.isArray(state.progress?.achievements?.unlocked) ? state.progress.achievements.unlocked : []
  );

  const currentLevel = Number.isFinite(state.profile?.level) ? Math.floor(state.profile.level) : parseInt(state.profile?.level, 10) || 1;
  const activeIds = Array.isArray(state.progress?.achievements?.active) ? state.progress.achievements.active : [];
  const activePool = activeIds.map((id) => getAchievementById(id)).filter(Boolean);
  const ordered = [...activePool].sort((a, b) => (a.unlockLevel || 1) - (b.unlockLevel || 1));

  return ordered.map((achievement) => {
    const unlockLevel = parseInt(achievement.unlockLevel, 10) || 1;
    const done = unlockedIds.has(achievement.id);
    const lockedByLevel = currentLevel < unlockLevel;
    return {
      id: achievement.id,
      title: achievement.title,
      desc: achievement.desc,
      xp: achievement.xp,
      unlockLevel,
      lockedByLevel,
      done
    };
  });
};

const renderAchievements = () => {
  const container = document.querySelector('[data-achievements]');
  const progressText = document.querySelector('[data-achievement-progress]');
  const progressBar = document.querySelector('[data-achievement-bar]');
  if (!container || !progressText || !progressBar) return;

  const achievements = getAchievements();
  const total = achievements.length;
  const unlocked = achievements.filter((achievement) => achievement.done).length;
  const percent = total ? Math.round((unlocked / total) * 100) : 0;

  progressText.textContent = percent;
  progressBar.style.width = `${percent}%`;

  if (!achievements.length) {
    container.innerHTML = '<div class="card">Sem conquistas por enquanto.</div>';
    return;
  }

  container.innerHTML = achievements
    .map((achievement) => {
      const cardLocked = !achievement.done && achievement.lockedByLevel;
      const badgeText = achievement.done ? 'Feito' : achievement.lockedByLevel ? 'Bloqueado' : 'Desafio';
      const badgeClass = achievement.done ? 'success' : achievement.lockedByLevel ? 'locked' : '';
      return `
        <div class="card achievement-card ${cardLocked ? 'locked' : ''}">
          <div style="display: flex; justify-content: space-between; gap: 10px; align-items: center;">
            <div class="badge ${badgeClass}">
              ${badgeText}
            </div>
            <div style="display: inline-flex; gap: 8px; align-items: center;">
              ${achievement.lockedByLevel ? `<span class="chip">Nível ${achievement.unlockLevel}</span>` : ''}
              <span class="chip">+${achievement.xp} XP</span>
            </div>
          </div>
          <div>
            <h4>${achievement.title}</h4>
            <p class="muted">${achievement.desc}</p>
          </div>
        </div>
      `;
    })
    .join('');
};

const renderSettings = () => {
  const settingsInputs = document.querySelectorAll('[data-setting]');
  settingsInputs.forEach((input) => {
    const key = input.dataset.setting;
    input.checked = Boolean(state.settings[key]);
  });

  const email =
    state.profile.email ||
    (() => {
      try {
        return sessionStorage.getItem('ugcQuestUserEmail') || '';
      } catch (e) {
        return '';
      }
    })() ||
    '';
  document.querySelectorAll('[data-account-email]').forEach((el) => {
    el.textContent = email || '—';
  });

  const weeklyBtn = document.querySelector('[data-action="send-weekly-summary"]');
  if (weeklyBtn) {
    weeklyBtn.disabled = !state.settings.weekly;
  }
};

const renderScriptHistory = () => {
  const container = document.querySelector('[data-script-history]');
  if (!container) return;

  if (!state.scripts.length) {
    container.innerHTML = '<div class="muted">Nada por aqui ainda. Gere seu primeiro roteiro.</div>';
    return;
  }

  container.innerHTML = state.scripts
    .slice(0, 10)
    .map((script) => {
      const isOpen = state.ui.openScript === script.id;
      return `
        <div class="script-card ${isOpen ? 'active' : ''}">
          <div>
            <h4>
              <button class="script-title-btn" data-action="show-script" data-script-id="${script.id}">
                ${script.title || script.brand}
              </button>
            </h4>
            <div class="script-meta">${typeLabels[script.type] || script.type} - ${script.brand}</div>
            <div class="script-meta">${new Date(Number(script.id.split('-')[1]) || Date.now()).toLocaleDateString()}</div>
            ${script.finalized ? `<div class="script-meta"><span class="chip chip-realizado">Finalizado</span></div>` : ''}
            ${isOpen ? `<div class="script-body">${script.text}</div>` : ''}
          </div>
          <div class="script-actions">
            <button class="btn btn-ghost btn-small" data-action="copy-script-history" data-script-id="${script.id}">Copiar</button>
            <button class="btn btn-danger btn-small" data-action="delete-script" data-script-id="${script.id}">Excluir</button>
          </div>
        </div>
      `;
    })
    .join('');
};

const renderAll = () => {
  renderProfile();
  renderMissions();
  renderChallenges();
  renderCampaigns();
  renderMetrics();
  renderAchievements();
  renderSettings();
  renderScriptHistory();

  if (state.ui.openScript) {
    const selected = state.scripts.find((item) => item.id === state.ui.openScript);
    if (selected) {
      setScriptOutput(selected.text);
    } else {
      state.ui.openScript = null;
      setScriptOutput('');
    }
  }

  const finalizeBtn = document.querySelector('[data-action="finalize-script"]');
  if (finalizeBtn) {
    const selected = state.ui.openScript ? state.scripts.find((item) => item.id === state.ui.openScript) : null;
    finalizeBtn.disabled = !selected || Boolean(selected.finalized);
  }
};

export { renderAll, renderScriptHistory };

// VERSAO_ATUALIZADA_070226_2350
