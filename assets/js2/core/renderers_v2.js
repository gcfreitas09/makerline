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
    narrative = 'Todo mundo come�a do zero. Voc� j� deu o primeiro passo.';
  } else if (!campaigns.length) {
    narrative = 'Cria uma campanha (mesmo de teste). Isso j� destrava XP e deixa tudo mais claro.';
  } else if (!scripts.length) {
    narrative = 'Gera um roteiro rapidinho. � XP por esfor�o e j� te coloca no ritmo.';
  } else if (!brands.length) {
    narrative = 'Salva um contato de marca. Mesmo que seja �outros�, vale o registro.';
  } else if (remaining > 0 && remaining <= 25) {
    narrative = `T� na beirinha do pr�ximo n�vel. S� mais ${remaining} XP.`;
  } else if (remaining > 0) {
    narrative = `Faltam ~${actionsLeft} a��es pra subir de n�vel. Vai no passo a passo.`;
  } else {
    narrative = 'Bora manter o ritmo e desbloquear as pr�ximas conquistas.';
  }

  let streakText = 'Sua melhor sequ�ncia do m�s.';
  if (state.profile.streak <= 1) {
    streakText = '� dif�cil come�ar. Amanh� voc� mant�m a chama acesa.';
  } else if (state.profile.streak < 4) {
    streakText = 'Boa! Voc� j� entrou na sequ�ncia.';
  } else if (state.profile.streak < 7) {
    streakText = 'Consist�ncia t� on. Mant�m mais um dia.';
  } else {
    streakText = 'T� quente! Voc� t� virando o jogo na marra.';
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

  // Cores din�micas do foguinho baseadas no streak
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
            <span class="muted">${tourDone ? 'Feito' : 'Autom�tico'}</span>
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
            <span class="muted">${isDone ? 'Feito' : 'Autom�tico'}</span>
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
            <span class="muted">${isDone ? 'Feito' : 'Autom�tico'}</span>
          </div>
        </div>
      `;
    })
    .join('');
};

/* ════════════════════════════════════════════
   DASHBOARD FINANCEIRO – Situação do Mês,
   Ações Críticas e Rentabilidade
   ════════════════════════════════════════════ */

const computeDashboardFinance = () => {
  const campaigns = Array.isArray(state.campaigns) ? state.campaigns : [];
  const now = new Date();
  const curMonth = now.getMonth();
  const curYear = now.getFullYear();

  const isCurrentMonth = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d.getMonth() === curMonth && d.getFullYear() === curYear;
  };

  const isPrevMonth = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const pm = curMonth === 0 ? 11 : curMonth - 1;
    const py = curMonth === 0 ? curYear - 1 : curYear;
    return d.getMonth() === pm && d.getFullYear() === py;
  };

  const todayStr = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const monthCampaigns = campaigns.filter((c) =>
    isCurrentMonth(c.createdAt) || isCurrentMonth(c.updatedAt) || isCurrentMonth(c.dueDate) || isCurrentMonth(c.paymentDate)
  );
  const receitaPrevista = monthCampaigns.reduce((s, c) => s + (c.value || 0), 0);
  const receitaConfirmada = monthCampaigns
    .filter((c) => c.status === 'concluida' || (c.paymentPercent && c.paymentPercent >= 100))
    .reduce((s, c) => s + (c.value || 0), 0);

  const meta = state.settings?.monthlyGoal || receitaPrevista || 0;
  const diffValor = receitaConfirmada - meta;
  const diffPercent = meta ? ((receitaConfirmada / meta) * 100) : 0;
  const metaOk = diffValor >= 0;

  const hoje = todayStr;
  const vencendoHoje = campaigns.filter((c) => c.dueDate === hoje && c.status !== 'concluida');
  const pagamentosAtrasados = campaigns.filter((c) => {
    if (!c.paymentDate || c.status === 'concluida') return false;
    const pp = Number.isFinite(c.paymentPercent) ? c.paymentPercent : 0;
    return c.paymentDate < hoje && pp < 100;
  });
  const metaEmRisco = !metaOk && receitaPrevista > 0;

  const brandMap = {};
  campaigns.forEach((c) => {
    const brand = c.brand || 'Sem marca';
    if (!brandMap[brand]) brandMap[brand] = { total: 0, count: 0 };
    brandMap[brand].total += c.value || 0;
    brandMap[brand].count += 1;
  });
  const brandEntries = Object.entries(brandMap).filter(([, v]) => v.count > 0);
  brandEntries.sort((a, b) => (b[1].total / b[1].count) - (a[1].total / a[1].count));

  const maisLucrativa = brandEntries.length > 0 ? { name: brandEntries[0][0], avg: Math.round(brandEntries[0][1].total / brandEntries[0][1].count) } : null;
  const menosLucrativa = brandEntries.length > 1 ? { name: brandEntries[brandEntries.length - 1][0], avg: Math.round(brandEntries[brandEntries.length - 1][1].total / brandEntries[brandEntries.length - 1][1].count) } : null;

  const doneCampaigns = campaigns.filter((c) => c.status === 'concluida');
  const ticketMedio = doneCampaigns.length ? Math.round(doneCampaigns.reduce((s, c) => s + (c.value || 0), 0) / doneCampaigns.length) : 0;

  const prevMonthCampaigns = campaigns.filter((c) =>
    isPrevMonth(c.createdAt) || isPrevMonth(c.updatedAt) || isPrevMonth(c.dueDate)
  );
  const prevReceita = prevMonthCampaigns
    .filter((c) => c.status === 'concluida' || (c.paymentPercent && c.paymentPercent >= 100))
    .reduce((s, c) => s + (c.value || 0), 0);
  const crescimento = prevReceita ? (((receitaConfirmada - prevReceita) / prevReceita) * 100) : 0;

  return {
    receitaPrevista, receitaConfirmada, meta, diffValor, diffPercent, metaOk,
    vencendoHoje, pagamentosAtrasados, metaEmRisco,
    maisLucrativa, menosLucrativa, ticketMedio, crescimento
  };
};

const renderDashboardFinancials = () => {
  const financeContainer = document.querySelector('[data-finance-month]');
  const alertsContainer = document.querySelector('[data-critical-actions]');
  const profitContainer = document.querySelector('[data-profitability]');
  if (!financeContainer) return;

  const d = computeDashboardFinance();

  // Barra de progresso da meta
  const progressPct = Math.min(Math.round(d.diffPercent), 100);
  const progressBarClass = d.metaOk ? '' : 'finance-progress-fill--red';

  // Indicador
  const indicatorClass = d.metaOk ? 'finance-indicator--green' : 'finance-indicator--red';
  const indicatorIcon = d.metaOk
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  const indicatorLabel = d.metaOk
    ? 'Meta atingida'
    : `Voc\u00ea est\u00e1 ${formatCurrency(Math.abs(d.diffValor))} abaixo da meta.`;

  financeContainer.innerHTML = `
    <div class="card finance-card finance-card--hero">
      <div class="finance-hero-top">
        <div class="finance-card-block finance-card-block--main">
          <div class="finance-label">Receita confirmada</div>
          <div class="finance-value finance-value--xl finance-value--accent">${formatCurrency(d.receitaConfirmada)}</div>
        </div>
        <div class="finance-indicator ${indicatorClass}">
          <span class="finance-indicator-icon">${indicatorIcon}</span>
          <span>${d.metaOk ? 'No caminho' : 'Abaixo'}</span>
        </div>
      </div>

      <div class="finance-progress">
        <div class="finance-progress-track">
          <div class="finance-progress-fill ${progressBarClass}" style="width: ${progressPct}%"></div>
        </div>
        <div class="finance-progress-labels">
          <span class="muted">${Math.round(d.diffPercent)}% da meta</span>
          <span class="muted">${formatCurrency(d.meta)}</span>
        </div>
      </div>

      <div class="finance-card-row">
        <div class="finance-card-block">
          <div class="finance-label">Receita prevista</div>
          <div class="finance-value">${formatCurrency(d.receitaPrevista)}</div>
        </div>
        <div class="finance-card-block">
          <div class="finance-label">Meta do m\u00eas</div>
          <div class="finance-value">${formatCurrency(d.meta)}</div>
        </div>
        <div class="finance-card-block">
          <div class="finance-label">Diferen\u00e7a</div>
          <div class="finance-value ${d.metaOk ? 'finance-value--green' : 'finance-value--red'}">
            ${d.diffValor >= 0 ? '+' : ''}${formatCurrency(d.diffValor)}
          </div>
        </div>
      </div>

      ${!d.metaOk ? `
        <div class="finance-alert-banner">
          <span class="finance-alert-icon">${indicatorIcon}</span>
          <span>${indicatorLabel}</span>
        </div>
      ` : ''}
    </div>
  `;

  // A\u00e7\u00f5es Cr\u00edticas
  if (alertsContainer) {
    const items = [];

    d.vencendoHoje.forEach((c) => {
      items.push(`
        <button class="alert-item alert-item--warning" data-action="open-campaign" data-campaign-id="${c.id}" type="button">
          <span class="alert-icon alert-icon--warning">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </span>
          <span class="alert-text"><strong>Vence hoje:</strong> ${c.brand || c.title || 'Campanha'}</span>
          <span class="alert-arrow">\u2192</span>
        </button>
      `);
    });

    d.pagamentosAtrasados.forEach((c) => {
      items.push(`
        <button class="alert-item alert-item--danger" data-action="open-campaign" data-campaign-id="${c.id}" type="button">
          <span class="alert-icon alert-icon--danger">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"/></svg>
          </span>
          <span class="alert-text"><strong>Pagamento atrasado:</strong> ${c.brand || c.title || 'Campanha'} \u2014 ${formatCurrency(c.value || 0)}</span>
          <span class="alert-arrow">\u2192</span>
        </button>
      `);
    });

    if (d.metaEmRisco) {
      items.push(`
        <button class="alert-item alert-item--danger" data-action="goto-metrics" type="button">
          <span class="alert-icon alert-icon--danger">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </span>
          <span class="alert-text"><strong>Meta em risco:</strong> faltam ${formatCurrency(Math.abs(d.diffValor))} para bater</span>
          <span class="alert-arrow">\u2192</span>
        </button>
      `);
    }

    if (items.length === 0) {
      alertsContainer.innerHTML = `
        <div class="alert-empty">
          <span class="alert-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </span>
          <div>
            <div class="alert-empty-title">Tudo em dia</div>
            <div class="muted">Sem prazos vencendo, pagamentos atrasados ou metas em risco.</div>
          </div>
        </div>
      `;
    } else {
      alertsContainer.innerHTML = items.join('');
    }
  }

  // Rentabilidade
  if (profitContainer) {
    const crescLabel = d.crescimento >= 0 ? `+${Math.round(d.crescimento)}%` : `${Math.round(d.crescimento)}%`;
    const crescClass = d.crescimento >= 0 ? 'finance-value--green' : 'finance-value--red';

    profitContainer.innerHTML = `
      <div class="card profit-card">
        <div class="profit-icon">${iconSvg('trend')}</div>
        <div class="profit-label">Marca mais lucrativa</div>
        <div class="profit-value">${d.maisLucrativa ? d.maisLucrativa.name : '\u2014'}</div>
        <div class="profit-sub">${d.maisLucrativa ? formatCurrency(d.maisLucrativa.avg) + '/campanha' : 'Sem dados'}</div>
      </div>
      <div class="card profit-card">
        <div class="profit-icon">${iconSvg('bars')}</div>
        <div class="profit-label">Marca menos lucrativa</div>
        <div class="profit-value">${d.menosLucrativa ? d.menosLucrativa.name : '\u2014'}</div>
        <div class="profit-sub">${d.menosLucrativa ? formatCurrency(d.menosLucrativa.avg) + '/campanha' : 'Sem dados'}</div>
      </div>
      <div class="card profit-card">
        <div class="profit-icon">${iconSvg('ticket')}</div>
        <div class="profit-label">Ticket m\u00e9dio</div>
        <div class="profit-value">${formatCurrency(d.ticketMedio)}</div>
        <div class="profit-sub">Campanhas conclu\u00eddas</div>
      </div>
      <div class="card profit-card">
        <div class="profit-icon">${iconSvg('cash')}</div>
        <div class="profit-label">Crescimento vs m\u00eas anterior</div>
        <div class="profit-value ${crescClass}">${crescLabel}</div>
        <div class="profit-sub">${d.crescimento >= 0 ? 'Acima do m\u00eas passado' : 'Abaixo do m\u00eas passado'}</div>
      </div>
    `;
  }
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
    const currentIndex = campaignStatusOrder.indexOf(current);
    return campaignStatusOrder
      .map((key, index) => {
        const disabled = index < currentIndex ? 'disabled' : '';
        return `<option value="${key}" ${key === current ? 'selected' : ''} ${disabled}>${statusLabels[key]}</option>`;
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
            <th>Pre�o</th>
            <th>Status</th>
            <th>Etapa</th>
            <th>A��es</th>
          </tr>
        </thead>
        <tbody>
          ${list
            .map((campaign) => {
              const statusSafe = Object.prototype.hasOwnProperty.call(statusLabels, campaign.status) ? campaign.status : 'prospeccao';
              const stageOptions = getCampaignStageOptions(statusSafe);
              const stageSafe = stageOptions.some((opt) => opt.id === campaign.stage) ? campaign.stage : stageOptions[0]?.id || '';
              const stageDisabled = stageOptions.length ? '' : 'disabled';

              const currentStageIndex = stageOptions.findIndex((opt) => opt.id === stageSafe);
              const stageOptionsHtml = stageOptions.length
                ? stageOptions
                    .map((opt, index) => {
                      const disabled = index < currentStageIndex ? 'disabled' : '';
                      return `<option value="${opt.id}" ${opt.id === stageSafe ? 'selected' : ''} ${disabled}>${opt.label}</option>`;
                    })
                    .join('')
                : '<option value="">-</option>';

              // Calcular pr�xima etapa para bot�o de avan�o
              const isLastStage = currentStageIndex >= stageOptions.length - 1;
              const currentStatusIndex = campaignStatusOrder.indexOf(statusSafe);
              const isLastStatus = currentStatusIndex >= campaignStatusOrder.length - 1;
              let advanceBtnHtml = '';

              if (!isLastStatus || !isLastStage) {
                if (!isLastStage) {
                  const nextStage = stageOptions[currentStageIndex + 1];
                  advanceBtnHtml = `
                    <button class="btn-advance" data-action="advance-stage" data-campaign-id="${campaign.id}" type="button">
                      <span class="btn-advance-label">Avan�ar para ${escapeHtml(nextStage.label)}</span>
                      <span class="btn-advance-xp">+5XP</span>
                    </button>`;
                } else if (!isLastStatus) {
                  const nextStatus = campaignStatusOrder[currentStatusIndex + 1];
                  const nextStatusLabel = statusLabels[nextStatus] || nextStatus;
                  advanceBtnHtml = `
                    <button class="btn-advance btn-advance-status" data-action="advance-stage" data-campaign-id="${campaign.id}" type="button">
                      <span class="btn-advance-label">Avan�ar para ${escapeHtml(nextStatusLabel)}</span>
                      <span class="btn-advance-xp">+5XP</span>
                    </button>`;
                }
              }

              const isPriority = campaign.priority === true;
              const priorityIcon = isPriority
                ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>'
                : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';

              return `
                <tr data-campaign-id="${campaign.id}" class="${isPriority ? 'campaign-priority' : ''}">
                  <td data-label="Marca">
                    <div style="display:flex;align-items:center;gap:4px">
                      <button class="btn-priority ${isPriority ? 'active' : ''}" data-action="toggle-priority" data-campaign-id="${campaign.id}" type="button" title="${isPriority ? 'Remover prioridade' : 'Marcar como prioridade'}">
                        ${priorityIcon}
                      </button>
                      <span class="chip chip-pill brand-status-${statusSafe}">${escapeHtml(campaign.brand || 'Marca')}</span>
                    </div>
                  </td>
                  <td data-label="Prazo">${escapeHtml(formatDateShortBR(campaign.dueDate))}</td>
                  <td data-label="Pre�o">${escapeHtml(getValueLabel(campaign))}</td>
                  <td data-label="Status">
                    <select class="select select-compact status-${statusSafe}" data-campaign-status data-campaign-id="${campaign.id}">
                      ${renderStatusOptions(statusSafe)}
                    </select>
                  </td>
                  <td data-label="Etapa">
                    <select class="select select-compact stage-${statusSafe}" ${stageDisabled} data-campaign-stage data-campaign-id="${campaign.id}">
                      ${stageOptionsHtml}
                    </select>
                    ${advanceBtnHtml}
                  </td>
                  <td data-label="A��es">
                    <div class="campaign-action-btns">
                      <button class="btn btn-outline btn-small" data-action="edit-campaign" data-campaign-id="${campaign.id}" type="button">
                        Visualizar
                      </button>
                      <button class="btn btn-danger btn-small" data-action="delete-campaign" data-campaign-id="${campaign.id}" type="button">
                        Excluir
                      </button>
                    </div>
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
            <p class="muted">Adiciona uma marca e come�a a registrar tudo por aqui.</p>
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
              <strong>${total}</strong> marcas no radar � ${respondedCount} responderam (${formatPercent(responseRate)}).
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
        title: 'Bora come�ar',
        text: 'Clica em �+ Marca nova� e adiciona seu primeiro contato.'
      });
    }

    if (sentCount > 0) {
      insights.push({
        icon: 'send',
        title: 'Follow-up r�pido',
        text: `Voc� tem ${sentCount} contato(s) esperando resposta. Faz 1 follow-up hoje e pronto.`
      });
    }

    if (negotiatingCount > 0) {
      insights.push({
        icon: 'chat',
        title: 'Negocia��o quente',
        text: `Tem ${negotiatingCount} em negocia��o. Simplifica: 2 v�deos + 3 cortes e fecha.`
      });
    }

    if (closedCount > 0) {
      insights.push({
        icon: 'trend',
        title: 'Repetir a dose',
        text: 'Fechou uma? J� puxa a pr�xima com a mesma marca. � o jeito mais f�cil de crescer.'
      });
    }

    while (insights.length < 3) {
      insights.push({
        icon: 'radar',
        title: 'Ritmo constante',
        text: 'Todo dia um passo: abordagem, follow-up, proposta. Sem press�o, s� const�ncia.'
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
      first: `Oi ${contact}! Tudo certo?\n\nAqui � o ${creator}. Eu curti a ${brandName} e pensei em umas ideias de UGC que combinam com voc�s.\n\nPosso te mandar 3 ideias rapidinhas e valores?`,
      followup: `Oi ${contact}! Passando s� pra dar um toque.\n\nSe fizer sentido, eu j� consigo te mandar 2 op��es de roteiro + um plano de entrega bem simples.`,
      deliver: `Oi ${contact}! T� tudo pronto por aqui.\n\nSegue o link/arquivos dos entreg�veis: [colar link aqui]\n\nSe quiser algum ajuste, me fala que eu deixo redondo.`,
      review: `Oi ${contact}! Vi seus feedbacks.\n\nJ� t� com a revis�o encaminhada � tem algo que voc� quer que eu priorize primeiro?`,
      approve: `Oi ${contact}! �ltima checagem: posso considerar aprovado?\n\nSe estiver tudo ok, eu j� sigo com a publica��o/entrega final.`
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
      if (composerHint) composerHint.textContent = 'Cria uma marca ali em cima e volta aqui.';
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
            <div class="muted">${brand.contact} � ${brand.email}</div>
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

const computeMetrics = () => {
  const campaigns = Array.isArray(state.campaigns) ? state.campaigns : [];
  const totalCampaigns = campaigns.length;
  const prospeccaoCount = campaigns.filter((campaign) => campaign.status === 'prospeccao').length;
  const producaoCount = campaigns.filter((campaign) => campaign.status === 'producao').length;
  const finalizacaoCount = campaigns.filter((campaign) => campaign.status === 'finalizacao').length;
  const doneCampaigns = campaigns.filter((campaign) => campaign.status === 'concluida');
  const doneCount = doneCampaigns.length;
  const negociacaoCount = campaigns.filter((campaign) => campaign.status === 'prospeccao' && campaign.stage === 'negociacao').length;

  const totalValue = campaigns.reduce((sum, campaign) => sum + (campaign.value || 0), 0);
  const totalReceived = doneCampaigns.reduce((sum, campaign) => sum + (campaign.value || 0), 0);
  const totalPotential = campaigns
    .filter((campaign) => campaign.status !== 'concluida')
    .reduce((sum, campaign) => sum + (campaign.value || 0), 0);

  const closeRate = totalCampaigns ? doneCount / totalCampaigns : 0;
  const avgTicket = doneCount ? Math.round(totalReceived / doneCount) : 0;

  const daysBetween = (startIso, endIso) => {
    const startDate = startIso ? new Date(startIso) : null;
    const endDate = endIso ? new Date(endIso) : null;
    if (!startDate || Number.isNaN(startDate.getTime())) return 0;
    if (!endDate || Number.isNaN(endDate.getTime())) return 0;
    const start = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
    const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));
    return Math.max(0, Math.floor((end - start) / 86400000));
  };

  const measuredAvgTime = doneCampaigns.length
    ? Math.round(
        doneCampaigns.reduce((sum, campaign) => sum + daysBetween(campaign.createdAt, campaign.updatedAt || campaign.createdAt), 0) /
          doneCampaigns.length
      )
    : 0;
  const avgTime = measuredAvgTime > 0 ? measuredAvgTime : state.metrics.avgTime;

  const brands = Array.isArray(state.brands) ? state.brands : [];
  const brandTotal = brands.length;
  const brandResponded = brands.filter((brand) => ['negociando', 'fechado'].includes(brand.status)).length;
  const responseRate = brandTotal ? brandResponded / brandTotal : 0;

  return {
    totalCampaigns,
    prospeccaoCount,
    producaoCount,
    finalizacaoCount,
    doneCount,
    negociacaoCount,
    closeRate,
    totalValue,
    totalReceived,
    totalPotential,
    avgTicket,
    avgTime,
    brandTotal,
    brandResponded,
    responseRate,
    monthEarnings: totalReceived
  };
};

const renderMetrics = () => {
  const hero = document.querySelector('[data-metric-hero]');
  const container = document.querySelector('[data-metrics]');
  const stepsContainer = document.querySelector('[data-metric-steps]');
  const insightsContainer = document.querySelector('[data-metric-insights]');
  if (!container || !stepsContainer) return;

  const metrics = computeMetrics();

  if (hero) {
    hero.innerHTML = `
      <div class="metric-hero">
        <div class="metric-hero-title">
          <h3>Seu resumo de hoje</h3>
          <p class="muted">Voc� tem <strong>${metrics.totalCampaigns}</strong> campanhas rolando agora.</p>
        </div>
        <div class="metric-hero-badges">
          <span class="chip chip-pendente">Prospec��o: ${metrics.prospeccaoCount}</span>
          <span class="chip chip-negociando">Produ��o: ${metrics.producaoCount}</span>
          <span class="chip chip-pay-partial">Finaliza��o: ${metrics.finalizacaoCount}</span>
          <span class="chip chip-realizado">Conclu�da: ${metrics.doneCount}</span>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="card metric-card">
      <div class="metric-icon">${iconSvg('cash')}</div>
      <div class="muted">Entrou no bolso</div>
      <div class="stat-value">${formatCurrency(metrics.totalReceived)}</div>
      <p class="muted">${metrics.doneCount} campanha(s) paga(s).</p>
    </div>
    <div class="card metric-card">
      <div class="metric-icon">${iconSvg('trend')}</div>
      <div class="muted">Na mesa</div>
      <div class="stat-value">${formatCurrency(metrics.totalPotential)}</div>
      <p class="muted">Tudo que ainda n�o virou pago.</p>
    </div>
    <div class="card metric-card">
      <div class="metric-icon">${iconSvg('bars')}</div>
      <div class="muted">Fechamento</div>
      <div class="stat-value">${formatPercent(metrics.closeRate)}</div>
      <div class="progress-track"><div class="progress-fill" style="width: ${metrics.closeRate * 100}%"></div></div>
      <p class="muted">Pagas ${metrics.doneCount} de ${metrics.totalCampaigns}.</p>
    </div>
    <div class="card metric-card">
      <div class="metric-icon">${iconSvg('ticket')}</div>
      <div class="muted">M�dia por campanha</div>
      <div class="stat-value">${formatCurrency(metrics.avgTicket)}</div>
      <p class="muted">Nas campanhas fechadas.</p>
    </div>
    <div class="card metric-card">
      <div class="metric-icon">${iconSvg('chat')}</div>
      <div class="muted">Respostas das marcas</div>
      <div class="stat-value">${formatPercent(metrics.responseRate)}</div>
      <p class="muted">${metrics.brandResponded} de ${metrics.brandTotal} marcas.</p>
    </div>
    <div class="card metric-card">
      <div class="metric-icon">${iconSvg('time')}</div>
      <div class="muted">Tempo pra pagar</div>
      <div class="stat-value">${metrics.avgTime} dias</div>
      <p class="muted">Da cria��o at� pagar.</p>
    </div>
  `;

  const funnel = [
    { label: 'Prospec��o', value: metrics.prospeccaoCount },
    { label: 'Produ��o', value: metrics.producaoCount },
    { label: 'Finaliza��o', value: metrics.finalizacaoCount },
    { label: 'Conclu�da', value: metrics.doneCount }
  ];

  const maxStep = Math.max(...funnel.map((step) => step.value), 1);
  stepsContainer.innerHTML = funnel
    .map((step) => {
      const width = Math.round((step.value / maxStep) * 100);
      return `
        <div style="margin-bottom: 12px;">
          <div class="muted" style="margin-bottom: 6px; display: flex; justify-content: space-between; gap: 10px;">
            <span>${step.label}</span>
            <span>${step.value}</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width: ${width}%"></div>
          </div>
        </div>
      `;
    })
    .join('');

  if (insightsContainer) {
    const insights = [];
    if (metrics.prospeccaoCount > 0) {
      insights.push({
        icon: 'send',
        title: 'Destrava a prospec��o',
        text: `Voc� tem ${metrics.prospeccaoCount} campanha(s) em prospec��o. Faz 1 follow-up hoje e j� melhora o jogo.`
      });
    }
    if (metrics.negociacaoCount > 0) {
      insights.push({
        icon: 'chat',
        title: 'Negocia��o quente',
        text: `Tem ${metrics.negociacaoCount} em negocia��o. Manda um pacote simples (2 v�deos + 3 cortes) e fecha.`
      });
    }
    if (metrics.doneCount === 0) {
      insights.push({
        icon: 'radar',
        title: 'Primeira paga do m�s',
        text: 'Escolhe 1 marca e vai at� o "sim". Uma vit�ria puxa a outra.'
      });
    }
    while (insights.length < 3) {
      insights.push({
        icon: 'trend',
        title: 'Ritmo constante',
        text: 'Todo dia um passo: roteiro, contato, follow-up. Sem press�o, s� consist�ncia.'
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
              ${achievement.lockedByLevel ? `<span class="chip">N�vel ${achievement.unlockLevel}</span>` : ''}
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
    el.textContent = email || '�';
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
  renderDashboardFinancials();
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

