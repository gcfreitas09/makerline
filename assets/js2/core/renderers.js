import {
  state,
  statusLabels,
  campaignStatusOrder,
  getCampaignStageOptions,
  getDefaultCampaignStage,
  getCampaignStageLabel,
  getNextActionLabel,
  typeLabels,
  statusDot,
  brandStatuses,
  formatCurrency,
  formatPercent,
  badgeCatalog,
  getBadgeById
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
let metricsMonthlyChart = null;

const renderProfile = () => {
  const greetings = document.querySelectorAll('[data-greeting]');
  const profileName = document.querySelectorAll('[data-profile-name]');
  const profileAvatar = document.querySelectorAll('[data-profile-avatar]');
  const profileMiniAvatar = document.querySelectorAll('[data-profile-mini-avatar]');
  const dashboardNarrative = document.querySelectorAll('[data-dashboard-narrative]');

  const campaigns = Array.isArray(state.campaigns) ? state.campaigns : [];
  const brands = Array.isArray(state.brands) ? state.brands : [];
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const overdue = campaigns.filter((campaign) => campaign && !campaign.archived && campaign.dueDate && campaign.dueDate < todayKey).length;
  const pendingPayments = campaigns.filter((campaign) => campaign && !campaign.archived && campaign.stage === 'aguardando_pagamento' && (Number(campaign.paymentPercent) || 0) < 100).length;

  const hour = now.getHours();
  const greeting = hour >= 5 && hour < 12 ? 'Bom dia' : hour >= 12 && hour < 18 ? 'Boa tarde' : 'Boa noite';
  const sessionName = typeof sessionStorage !== 'undefined' ? String(sessionStorage.getItem('ugcQuestUserName') || '').trim() : '';
  const persistedName = String(state.profile?.name || '').trim();
  const safeName = persistedName && persistedName.toLowerCase() !== 'criador' ? persistedName : (sessionName || 'Criador');
  const firstLetter = safeName.charAt(0).toUpperCase() || 'C';
  let narrative = '';

  if (!brands.length && !campaigns.length) {
    narrative = 'Comece cadastrando uma marca ou campanha para organizar sua operação.';
  } else if (!brands.length) {
    narrative = 'Cadastre suas marcas para centralizar follow-ups, histórico e campanhas.';
  } else if (!campaigns.length) {
    narrative = 'Crie sua próxima campanha para alimentar o pipeline e o financeiro.';
  } else if (overdue > 0) {
    narrative = `${overdue} campanha(s) com prazo vencido pedem atenção hoje.`;
  } else if (pendingPayments > 0) {
    narrative = `${pendingPayments} campanha(s) aguardam pagamento e impactam o fechamento do mês.`;
  } else {
    narrative = 'Seu dashboard está em dia. Use os blocos abaixo para mover a operação.';
  }

  greetings.forEach((el) => (el.textContent = greeting));
  profileName.forEach((el) => (el.textContent = safeName));
  profileAvatar.forEach((el) => (el.textContent = firstLetter));
  profileMiniAvatar.forEach((el) => (el.textContent = firstLetter));
  dashboardNarrative.forEach((el) => (el.textContent = narrative));
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

/* ════════════════════════════════════════════
   DASHBOARD – Ações, Financeiro, Pipeline e Meta
   ════════════════════════════════════════════ */

const dashboardFilterMeta = {
  prospeccao: { label: 'Campanhas em prospecção' },
  producao: { label: 'Campanhas em produção' },
  finalizacao: { label: 'Campanhas em finalização' },
  concluida: { label: 'Campanhas concluídas' },
  negociacao: { label: 'Campanhas em negociação' },
  aprovacao: { label: 'Aguardando aprovação' },
  concluidas: { label: 'Campanhas concluídas' }
};

const dashboardPipelineStages = [
  { key: 'prospeccao', label: 'Prospecção' },
  { key: 'producao', label: 'Produção' },
  { key: 'finalizacao', label: 'Finalização' },
  { key: 'concluida', label: 'Concluído' }
];

const formatDateFullBR = (value) => {
  const safe = String(value || '').trim();
  if (!safe) return 'Sem prazo';
  const parts = safe.split('-');
  if (parts.length !== 3) return safe;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

const matchesDashboardCampaignFilter = (campaign, key) => {
  if (!key) return true;
  if (!campaign || campaign.archived) return false;
  switch (key) {
    case 'prospeccao':
      return campaign.status === 'prospeccao';
    case 'producao':
      return campaign.status === 'producao';
    case 'finalizacao':
      return campaign.status === 'finalizacao';
    case 'concluida':
    case 'concluidas':
      return campaign.status === 'concluida';
    case 'negociacao':
      return campaign.status === 'prospeccao' && campaign.stage === 'negociacao';
    case 'aprovacao':
      return ['aguardando_aprovacao_roteiro', 'aguardando_aprovacao_conteudo'].includes(campaign.stage);
    default:
      return true;
  }
};

const getDashboardPipelineDetailHtml = (pipelineStage) => {
  if (!pipelineStage) {
    return `
      <div class="dashboard-pipeline-panel dashboard-pipeline-panel--empty">
        <p class="muted">Clique em um status da pipeline para ver as campanhas dessa fase.</p>
      </div>
    `;
  }

  return `
    <div class="dashboard-pipeline-panel">
      <div class="dashboard-pipeline-panel-header">
        <div>
          <p class="dashboard-pipeline-panel-overline">${pipelineStage.count} campanha${pipelineStage.count === 1 ? '' : 's'} em andamento</p>
          <h3 class="dashboard-pipeline-panel-title">${pipelineStage.label}</h3>
        </div>
        <button
          class="btn btn-ghost dashboard-campaigns-btn"
          data-action="open-dashboard-pipeline-filter"
          data-pipeline-filter="${pipelineStage.key}"
          type="button"
        >
          Ver na aba campanhas
        </button>
      </div>
      <div class="dashboard-pipeline-panel-list">
        ${
          pipelineStage.items.length
            ? pipelineStage.items
                .map((item) => `
                  <article class="dashboard-pipeline-panel-item">
                    <div class="dashboard-pipeline-panel-main">
                      <strong>${escapeHtml(item.title)}</strong>
                      <div class="dashboard-pipeline-panel-sub">${escapeHtml(item.brand)}</div>
                    </div>
                    <div class="dashboard-pipeline-panel-meta">
                      <span>${escapeHtml(item.stageLabel)}</span>
                      <strong>${escapeHtml(formatDateFullBR(item.dueDate))}</strong>
                    </div>
                  </article>
                `)
                .join('')
            : '<p class="muted">Nenhuma campanha nesse status agora.</p>'
        }
      </div>
    </div>
  `;
};

const getMetricsStatusDetailHtml = (statusBucket) => {
  if (!statusBucket) {
    return `
      <div class="metrics-status-panel metrics-status-panel--empty">
        <p class="muted">Clique em um status para ver as campanhas.</p>
      </div>
    `;
  }

  return `
    <div class="metrics-status-panel">
      <div class="metrics-status-panel-head">
        <div>
          <p class="metrics-status-panel-overline">${statusBucket.count} campanha${statusBucket.count === 1 ? '' : 's'} nessa fase</p>
          <h4 class="metrics-status-panel-title">${escapeHtml(statusBucket.label)}</h4>
        </div>
      </div>
      <button class="btn btn-ghost dashboard-campaigns-btn metrics-status-panel-link" data-action="open-metrics-campaigns" data-metrics-status="${statusBucket.key}" type="button">
        Ver na aba campanhas
      </button>
      <div class="metrics-status-panel-list">
        ${
          statusBucket.items.length
            ? statusBucket.items
                .map((item) => `
                  <article class="metrics-status-item">
                    <div class="metrics-status-item-main">
                      <strong>${escapeHtml(item.title)}</strong>
                      <span>${escapeHtml(item.brand)}</span>
                    </div>
                    <div class="metrics-status-item-meta">
                      <span>${escapeHtml(item.stageLabel)}</span>
                      <strong>${item.dueDate ? escapeHtml(formatDateFullBR(item.dueDate)) : 'Sem prazo'}</strong>
                      <span>${formatCurrency(item.value)}</span>
                    </div>
                  </article>
                `)
                .join('')
            : '<p class="muted">Nenhuma campanha nesse status agora.</p>'
        }
      </div>
    </div>
  `;
};

const computeDashboardFinance = () => {
  const campaigns = Array.isArray(state.campaigns) ? state.campaigns : [];
  const brands = Array.isArray(state.brands) ? state.brands : [];
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayKey = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;
  const plusThree = new Date(today.getTime());
  plusThree.setUTCDate(plusThree.getUTCDate() + 3);

  const parseDay = (value) => {
    const safe = String(value || '').trim();
    if (!safe) return null;
    const date = new Date(`${safe}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const dayDiff = (value) => {
    const date = parseDay(value);
    if (!date) return null;
    return Math.floor((date.getTime() - today.getTime()) / 86400000);
  };

  const sumValues = (items) => items.reduce((total, item) => total + (Number(item?.value) || 0), 0);

  const isCurrentMonthDay = (value) => {
    const date = parseDay(value);
    return Boolean(date && date.getUTCMonth() === today.getUTCMonth() && date.getUTCFullYear() === today.getUTCFullYear());
  };

  const isLegacyReceivedThisMonth = (campaign) => {
    if (campaign.paymentReceivedAt) return false;
    const paymentPercent = Number.isFinite(campaign.paymentPercent) ? campaign.paymentPercent : parseInt(String(campaign.paymentPercent || ''), 10) || 0;
    if (!(campaign.status === 'concluida' || paymentPercent >= 100)) return false;
    const date = campaign.updatedAt ? new Date(campaign.updatedAt) : campaign.createdAt ? new Date(campaign.createdAt) : null;
    return Boolean(date && !Number.isNaN(date.getTime()) && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear());
  };

  const pendingPayments = campaigns.filter((campaign) => {
    if (!campaign || campaign.archived) return false;
    const paymentPercent = Number.isFinite(campaign.paymentPercent) ? campaign.paymentPercent : parseInt(String(campaign.paymentPercent || ''), 10) || 0;
    return campaign.stage === 'aguardando_pagamento' && paymentPercent < 100;
  });

  const overduePayments = pendingPayments.filter((campaign) => campaign.paymentDate && campaign.paymentDate < todayKey);
  const receivedThisMonth = campaigns.filter((campaign) => isCurrentMonthDay(campaign.paymentReceivedAt) || isLegacyReceivedThisMonth(campaign));
  const scheduledThisMonth = campaigns.filter((campaign) => campaign && !campaign.archived && isCurrentMonthDay(campaign.paymentDate));

  const followups = [];

  campaigns.forEach((campaign) => {
    if (!campaign || campaign.archived || !campaign.nextActionType || !campaign.nextActionDate) return;
    const sortDays = dayDiff(campaign.nextActionDate);
    if (sortDays === null) return;
    followups.push({
      source: 'campaign',
      id: campaign.id,
      title: campaign.brand || campaign.title || 'Campanha',
      subtitle: campaign.title && campaign.title !== campaign.brand ? campaign.title : 'Campanha',
      actionLabel: getNextActionLabel(campaign.nextActionType, campaign.nextActionCustomType),
      date: campaign.nextActionDate,
      note: campaign.nextActionNote || '',
      sortDays
    });
  });

  brands.forEach((brand) => {
    if (!brand || !brand.nextActionType || !brand.nextActionDate) return;
    const sortDays = dayDiff(brand.nextActionDate);
    if (sortDays === null) return;
    followups.push({
      source: 'brand',
      id: brand.id,
      title: brand.name || 'Marca',
      subtitle: brand.contact ? `Contato: ${brand.contact}` : '',
      actionLabel: getNextActionLabel(brand.nextActionType, brand.nextActionCustomType),
      date: brand.nextActionDate,
      note: brand.nextActionNote || '',
      sortDays
    });
  });

  followups.sort((a, b) => {
    if ((a.sortDays < 0) !== (b.sortDays < 0)) return a.sortDays < 0 ? -1 : 1;
    if (a.sortDays !== b.sortDays) return a.sortDays - b.sortDays;
    return a.title.localeCompare(b.title, 'pt-BR');
  });

  const deadlines = campaigns
    .filter((campaign) => {
      if (!campaign || campaign.archived || campaign.status === 'concluida' || !campaign.dueDate) return false;
      const due = parseDay(campaign.dueDate);
      return Boolean(due && due.getTime() <= plusThree.getTime());
    })
    .map((campaign) => ({
      id: campaign.id,
      title: campaign.title || campaign.brand || 'Campanha',
      brand: campaign.brand || 'Sem marca',
      dueDate: campaign.dueDate,
      sortDays: dayDiff(campaign.dueDate),
      statusLabel: [statusLabels[campaign.status] || campaign.status, getCampaignStageLabel(campaign.status, campaign.stage)]
        .filter(Boolean)
        .join(' · ')
    }))
    .sort((a, b) => {
      if ((a.sortDays < 0) !== (b.sortDays < 0)) return a.sortDays < 0 ? -1 : 1;
      if (a.sortDays !== b.sortDays) return a.sortDays - b.sortDays;
      return a.title.localeCompare(b.title, 'pt-BR');
    });

  const payments = pendingPayments
    .map((campaign) => ({
      id: campaign.id,
      brand: campaign.brand || 'Sem marca',
      title: campaign.title || campaign.brand || 'Campanha',
      value: Number(campaign.value) || 0,
      paymentDate: campaign.paymentDate || '',
      overdue: Boolean(campaign.paymentDate && campaign.paymentDate < todayKey),
      statusLabel: campaign.paymentDate && campaign.paymentDate < todayKey ? 'Atrasado' : 'A receber'
    }))
    .sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      if ((a.paymentDate || '9999-12-31') !== (b.paymentDate || '9999-12-31')) return (a.paymentDate || '9999-12-31').localeCompare(b.paymentDate || '9999-12-31');
      return a.brand.localeCompare(b.brand, 'pt-BR');
    });

  const financeiro = {
    aReceber: sumValues(pendingPayments),
    atrasado: sumValues(overduePayments),
    recebidoNoMes: sumValues(receivedThisMonth)
  };

  const pipeline = dashboardPipelineStages.map((stage) => {
    const items = campaigns
      .filter((campaign) => matchesDashboardCampaignFilter(campaign, stage.key))
      .slice()
      .sort((a, b) => {
        const dueA = String(a?.dueDate || '9999-12-31');
        const dueB = String(b?.dueDate || '9999-12-31');
        if (dueA !== dueB) return dueA.localeCompare(dueB);
        return (Number(b?.value) || 0) - (Number(a?.value) || 0);
      })
      .map((campaign) => ({
        id: campaign.id,
        title: campaign.title || campaign.brand || 'Campanha',
        brand: campaign.brand || 'Sem marca',
        stageLabel: getCampaignStageLabel(campaign.status, campaign.stage) || statusLabels[campaign.status] || 'Etapa não definida',
        dueDate: campaign.dueDate || ''
      }));

    return {
      ...stage,
      count: items.length,
      items
    };
  });

  return {
    todayKey,
    followups,
    deadlines,
    payments,
    financeiro,
    pipeline,
    meta: {
      metaMensal: Number(state.settings?.monthlyGoal) || 0,
      receitaConfirmada: financeiro.recebidoNoMes,
      receitaPrevista: sumValues(scheduledThisMonth)
    }
  };
};

const renderDashboardFinancials = () => {
  const financialContainer = document.querySelector('[data-dashboard-financial]');
  const pipelineContainer = document.querySelector('[data-dashboard-pipeline]');
  const pipelineDetailContainer = document.querySelector('[data-dashboard-pipeline-detail]');
  const pipelineModal = document.getElementById('dashboard-pipeline-modal');
  const pipelineModalBody = document.querySelector('[data-dashboard-pipeline-modal-body]');
  const pipelineModalTitle = document.querySelector('[data-dashboard-pipeline-modal-title]');
  const pipelineModalSubtitle = document.querySelector('[data-dashboard-pipeline-modal-subtitle]');
  const goalContainer = document.querySelector('[data-dashboard-goal]');
  const followupsContainer = document.querySelector('[data-dashboard-followups]');
  const deadlinesContainer = document.querySelector('[data-dashboard-deadlines]');
  const paymentsContainer = document.querySelector('[data-dashboard-payments]');
  if (!financialContainer || !pipelineContainer || !pipelineDetailContainer || !goalContainer || !followupsContainer || !deadlinesContainer || !paymentsContainer) return;

  const d = computeDashboardFinance();

  const formatDateShort = (value) => {
    const safe = String(value || '').trim();
    if (!safe) return 'Sem data';
    const parts = safe.split('-');
    if (parts.length !== 3) return safe;
    return `${parts[2]}/${parts[1]}`;
  };

  const renderEmpty = (label) => `<p class="muted">${label}</p>`;

  followupsContainer.innerHTML = d.followups.length
    ? d.followups.map((item) => `
        <article class="dashboard-item dashboard-item--followup">
          <div class="dashboard-item-main">
            <div class="dashboard-item-topline">
              <div>
                <strong>${escapeHtml(item.title)}</strong>
                <div class="dashboard-item-sub">${escapeHtml(item.subtitle)}</div>
              </div>
              ${item.sortDays < 0 ? `<span class="dashboard-badge dashboard-badge--danger">Atrasado ${Math.abs(item.sortDays)} dia(s)</span>` : ''}
            </div>
            <div class="dashboard-item-meta">
              <span>${escapeHtml(item.actionLabel)}</span>
              <span>${escapeHtml(formatDateShort(item.date))}</span>
            </div>
            ${item.note ? `<p class="dashboard-item-note">${escapeHtml(item.note)}</p>` : ''}
          </div>
          <div class="dashboard-item-actions">
            <button class="btn btn-ghost btn-small" data-action="${item.source === 'brand' ? 'edit-brand-action' : 'open-campaign'}" ${item.source === 'brand' ? `data-brand-id="${item.id}"` : `data-campaign-id="${item.id}"`} type="button">Editar</button>
            <button class="btn btn-primary btn-small" data-action="complete-next-action" data-source="${item.source}" data-id="${item.id}" type="button">Marcar como feito</button>
          </div>
        </article>
      `).join('')
    : renderEmpty('Nenhum follow-up pendente.');

  deadlinesContainer.innerHTML = d.deadlines.length
    ? d.deadlines.map((item) => `
        <article class="dashboard-item">
          <div class="dashboard-item-main">
            <div class="dashboard-item-topline">
              <div>
                <strong>${escapeHtml(item.title)}</strong>
                <div class="dashboard-item-sub">${escapeHtml(item.brand)}</div>
              </div>
              ${item.sortDays < 0 ? '<span class="dashboard-badge dashboard-badge--danger">Atrasada</span>' : ''}
            </div>
            <div class="dashboard-item-meta">
              <span>${escapeHtml(formatDateShort(item.dueDate))}</span>
              <span>${escapeHtml(item.statusLabel)}</span>
            </div>
          </div>
          <div class="dashboard-item-actions">
            <button class="btn btn-ghost btn-small" data-action="open-campaign" data-campaign-id="${item.id}" type="button">Abrir campanha</button>
          </div>
        </article>
      `).join('')
    : renderEmpty('Nenhum prazo próximo.');

  paymentsContainer.innerHTML = d.payments.length
    ? d.payments.map((item) => `
        <article class="dashboard-item">
          <div class="dashboard-item-main">
            <div class="dashboard-item-topline">
              <div>
                <strong>${escapeHtml(item.brand)}</strong>
                <div class="dashboard-item-sub">${escapeHtml(item.title)}</div>
              </div>
              <span class="dashboard-badge ${item.overdue ? 'dashboard-badge--danger' : 'dashboard-badge--neutral'}">${item.statusLabel}</span>
            </div>
            <div class="dashboard-item-meta">
              <span>${formatCurrency(item.value)}</span>
              <span>${escapeHtml(item.paymentDate ? formatDateShort(item.paymentDate) : 'Sem data prevista')}</span>
            </div>
          </div>
          <div class="dashboard-item-actions">
            <button class="btn btn-ghost btn-small" data-action="open-campaign" data-campaign-id="${item.id}" type="button">Abrir campanha</button>
          </div>
        </article>
      `).join('')
    : renderEmpty('Nenhum pagamento pendente.');

  financialContainer.innerHTML = `
    <div class="dashboard-metric">
      <span class="dashboard-metric-label">A receber</span>
      <strong class="dashboard-metric-value">${formatCurrency(d.financeiro.aReceber)}</strong>
    </div>
    <div class="dashboard-metric">
      <span class="dashboard-metric-label">Atrasado</span>
      <strong class="dashboard-metric-value dashboard-metric-value--danger">${formatCurrency(d.financeiro.atrasado)}</strong>
    </div>
    <div class="dashboard-metric">
      <span class="dashboard-metric-label">Recebido no mês</span>
      <strong class="dashboard-metric-value dashboard-metric-value--accent">${formatCurrency(d.financeiro.recebidoNoMes)}</strong>
    </div>
  `;

  const activePipelineKey = d.pipeline.some((item) => item.key === state.ui.dashboardPipelineOpen)
    ? state.ui.dashboardPipelineOpen
    : '';
  const activePipeline = d.pipeline.find((item) => item.key === activePipelineKey) || null;
  const isMobilePipeline = Boolean(window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
  const detailHtml = getDashboardPipelineDetailHtml(activePipeline);
  const shouldShowPipelineModal = Boolean(isMobilePipeline && activePipeline && state.ui.activePage === 'dashboard');

  pipelineContainer.innerHTML = `
    <div class="dashboard-pipeline-track">
      ${d.pipeline
        .map((item) => `
          <button
            class="dashboard-pipeline-step ${item.key === activePipelineKey ? 'is-active' : ''}"
            data-action="toggle-dashboard-pipeline-panel"
            data-pipeline-filter="${item.key}"
            type="button"
          >
            <span class="dashboard-pipeline-step-count">${item.count} campanha${item.count === 1 ? '' : 's'}</span>
            <span class="dashboard-pipeline-step-label">${item.label}</span>
          </button>
        `)
        .join('')}
    </div>
  `;

  pipelineDetailContainer.innerHTML = isMobilePipeline ? '' : detailHtml;

  if (pipelineModal && pipelineModalBody && pipelineModalTitle && pipelineModalSubtitle) {
    pipelineModalTitle.textContent = activePipeline ? activePipeline.label : 'Pipeline';
    pipelineModalSubtitle.textContent = activePipeline
      ? `Veja as campanhas que estão em ${activePipeline.label.toLowerCase()}.`
      : 'Veja as campanhas dessa fase sem sair do dashboard.';
    pipelineModalBody.innerHTML = activePipeline ? detailHtml : '';
    pipelineModal.classList.toggle('open', shouldShowPipelineModal);
    pipelineModal.setAttribute('aria-hidden', shouldShowPipelineModal ? 'false' : 'true');
  }

  goalContainer.innerHTML = `
    <div class="dashboard-metric">
      <span class="dashboard-metric-label">Meta mensal</span>
      <strong class="dashboard-metric-value">${formatCurrency(d.meta.metaMensal)}</strong>
    </div>
    <div class="dashboard-metric">
      <span class="dashboard-metric-label">Receita confirmada</span>
      <strong class="dashboard-metric-value dashboard-metric-value--accent">${formatCurrency(d.meta.receitaConfirmada)}</strong>
    </div>
    <div class="dashboard-metric">
      <span class="dashboard-metric-label">Receita prevista</span>
      <strong class="dashboard-metric-value">${formatCurrency(d.meta.receitaPrevista)}</strong>
    </div>
  `;
};

const financeRangeLabelMap = {
  15: '15 dias',
  30: '30 dias',
  45: '45 dias',
  90: '90 dias',
  0: 'Todo histórico'
};

const financeStatusMeta = {
  a_receber: { label: 'A receber', className: 'finance-payment-status--open' },
  atrasado: { label: 'Atrasado', className: 'finance-payment-status--overdue' },
  recebido: { label: 'Recebido', className: 'finance-payment-status--received' }
};

const computeFinancePageData = () => {
  const campaigns = Array.isArray(state.campaigns) ? state.campaigns : [];
  const rangeDays = [0, 15, 30, 45, 90].includes(Number(state.ui.financeRangeDays)) ? Number(state.ui.financeRangeDays) : 30;
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const todayKey = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;

  const parseDay = (value) => {
    const safe = String(value || '').trim();
    if (!safe) return null;
    const raw = safe.length > 10 ? safe : `${safe}T00:00:00Z`;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return null;
      return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    };

    const toDateKey = (value) => {
      const date = parseDay(value);
      if (!date) return '';
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
    };

  const diffDays = (valueA, valueB = today) => {
    const dateA = valueA instanceof Date ? valueA : parseDay(valueA);
    const dateB = valueB instanceof Date ? valueB : parseDay(valueB);
    if (!dateA || !dateB) return null;
    return Math.floor((dateA.getTime() - dateB.getTime()) / 86400000);
  };

  const isCurrentMonth = (value) => {
    const date = parseDay(value);
    return Boolean(date && date.getUTCMonth() === today.getUTCMonth() && date.getUTCFullYear() === today.getUTCFullYear());
  };

  const getPaymentPercent = (campaign) => {
    const raw = Number.isFinite(campaign?.paymentPercent)
      ? campaign.paymentPercent
      : parseInt(String(campaign?.paymentPercent || ''), 10);
    return Number.isFinite(raw) ? Math.max(0, Math.min(100, Math.round(raw))) : 0;
  };

  const isReceivedCampaign = (campaign) =>
    getPaymentPercent(campaign) >= 100 ||
    Boolean(String(campaign?.paymentReceivedAt || '').trim()) ||
    campaign?.status === 'concluida';

  const getFinanceStatus = (campaign) => {
    if (isReceivedCampaign(campaign)) return 'recebido';
    if (campaign.paymentDate && campaign.paymentDate < todayKey) return 'atrasado';
    return 'a_receber';
  };

  const isRelevantFinanceCampaign = (campaign) => {
    if (!campaign || campaign.archived) return false;
    const value = Number(campaign.value) || 0;
    return (
      value > 0 ||
      Boolean(campaign.barter) ||
      Boolean(campaign.paymentDate) ||
      Boolean(campaign.paymentReceivedAt) ||
      getPaymentPercent(campaign) > 0 ||
      campaign.stage === 'aguardando_pagamento' ||
      campaign.status === 'concluida'
    );
  };

  const getValueLabel = (campaign) => {
    const value = Number(campaign.value) || 0;
    if (value > 0) return formatCurrency(value);
    if (campaign.barter) return 'Permuta';
    return 'R$ 0';
  };

  const relevantCampaigns = campaigns
      .filter(isRelevantFinanceCampaign)
      .map((campaign) => {
        const statusKey = getFinanceStatus(campaign);
        const paymentDate = String(campaign.paymentDate || '').trim();
        const paymentReceivedAt = String(campaign.paymentReceivedAt || '').trim();
        const dueDate = String(campaign.dueDate || '').trim();
        const movementDate = toDateKey(campaign.updatedAt || campaign.createdAt);
        const createdAtDay = parseDay(campaign.createdAt);
        const receivedAtDay = parseDay(paymentReceivedAt);
        const delayFromDue = paymentDate
          ? statusKey === 'recebido'
            ? Math.max(0, diffDays(paymentReceivedAt, paymentDate) || 0)
          : Math.max(0, Math.abs(Math.min(diffDays(paymentDate) || 0, 0)))
        : 0;

      return {
        id: campaign.id,
        brand: campaign.brand || 'Sem marca',
        title: campaign.title || campaign.brand || 'Campanha',
        stageLabel: getCampaignStageLabel(campaign.status, campaign.stage) || statusLabels[campaign.status] || 'Sem etapa',
        statusKey,
        statusLabel: financeStatusMeta[statusKey]?.label || 'A receber',
        statusClassName: financeStatusMeta[statusKey]?.className || 'finance-payment-status--open',
          value: Number(campaign.value) || 0,
          valueLabel: getValueLabel(campaign),
          paymentDate,
          paymentReceivedAt,
          dueDate,
          paymentType: campaign.barter ? ((Number(campaign.value) || 0) > 0 ? 'Dinheiro + permuta' : 'Permuta') : 'Dinheiro',
          paymentMethod: String(campaign.paymentMethod || '').trim() || 'Não informado',
          filterDate:
            statusKey === 'recebido'
              ? paymentReceivedAt || paymentDate || movementDate || dueDate
              : paymentDate || dueDate || movementDate,
        referenceDate:
          statusKey === 'recebido'
            ? paymentReceivedAt || paymentDate || movementDate || dueDate
            : paymentDate || dueDate || movementDate,
          daysOverdue: delayFromDue,
          daysToReceive:
            createdAtDay && receivedAtDay
              ? Math.max(0, diffDays(receivedAtDay, createdAtDay) || 0)
              : null
      };
    });

  const matchesRange = (item) => {
    if (!rangeDays) return true;
    const refDay = parseDay(item.filterDate);
    if (!refDay) return false;
    const diff = diffDays(refDay, today);
    if (diff === null) return false;
    if (item.statusKey === 'recebido') return diff <= 0 && diff >= -rangeDays;
    if (item.statusKey === 'atrasado') return diff < 0 && diff >= -rangeDays;
    return diff >= 0 && diff <= rangeDays;
  };

  const filteredCampaigns = relevantCampaigns
    .filter(matchesRange)
    .sort((a, b) => {
      const order = { atrasado: 0, a_receber: 1, recebido: 2 };
      if (order[a.statusKey] !== order[b.statusKey]) return order[a.statusKey] - order[b.statusKey];
      const refA = a.referenceDate || '9999-12-31';
      const refB = b.referenceDate || '9999-12-31';
      if (refA !== refB) return refA.localeCompare(refB);
      return a.brand.localeCompare(b.brand, 'pt-BR');
    });

  const sumValues = (items) => items.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
  const receivedAll = relevantCampaigns.filter((item) => item.statusKey === 'recebido');
  const openAll = relevantCampaigns.filter((item) => item.statusKey === 'a_receber');
  const overdueAll = relevantCampaigns.filter((item) => item.statusKey === 'atrasado');
  const receivedFiltered = filteredCampaigns.filter((item) => item.statusKey === 'recebido');
  const openFiltered = filteredCampaigns.filter((item) => item.statusKey === 'a_receber');
  const overdueFiltered = filteredCampaigns.filter((item) => item.statusKey === 'atrasado');
  const receivedThisMonth = receivedAll.filter((item) => isCurrentMonth(item.paymentReceivedAt || item.filterDate));

  const flowUpcoming = (days) =>
    relevantCampaigns
      .filter((item) => item.statusKey !== 'recebido' && item.paymentDate)
      .filter((item) => {
        const diff = diffDays(item.paymentDate);
        return diff !== null && diff >= 0 && diff <= days;
      });

  const indicatorsSource = filteredCampaigns;
  const receivedInWindow = indicatorsSource.filter((item) => item.statusKey === 'recebido');
  const ticketMedio = receivedInWindow.length ? Math.round(sumValues(receivedInWindow) / receivedInWindow.length) : 0;

  const recentMonths = [0, 1, 2].map((offset) => {
    const monthDate = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - offset, 1));
    return {
      month: monthDate.getUTCMonth(),
      year: monthDate.getUTCFullYear()
    };
  });

  const monthlyAverage3 = recentMonths.length
    ? Math.round(
        recentMonths.reduce((sum, bucket) => {
          const monthTotal = receivedAll
            .filter((item) => {
              const date = parseDay(item.paymentReceivedAt || item.filterDate);
              return Boolean(date && date.getUTCMonth() === bucket.month && date.getUTCFullYear() === bucket.year);
            })
            .reduce((acc, item) => acc + (Number(item.value) || 0), 0);
          return sum + monthTotal;
        }, 0) / recentMonths.length
      )
    : 0;

  const brandTotals = receivedInWindow.reduce((acc, item) => {
    const key = item.brand || 'Sem marca';
    acc[key] = (acc[key] || 0) + (Number(item.value) || 0);
    return acc;
  }, {});

  const mostProfitableEntry = Object.entries(brandTotals).sort((a, b) => b[1] - a[1])[0] || null;
  const paidOnTimeCount = receivedInWindow.filter((item) => !item.paymentDate || item.daysOverdue === 0).length;
  const avgDaysToReceiveSource = receivedInWindow.filter((item) => Number.isFinite(item.daysToReceive));
  const avgDaysToReceive = avgDaysToReceiveSource.length
    ? Math.round(avgDaysToReceiveSource.reduce((sum, item) => sum + item.daysToReceive, 0) / avgDaysToReceiveSource.length)
    : null;

  return {
    rangeDays,
    rangeLabel: financeRangeLabelMap[rangeDays] || '30 dias',
    overview: {
      totalRecebido: sumValues(receivedAll),
      aReceber: sumValues(openFiltered),
      atrasado: sumValues(overdueFiltered),
      recebidoNoPeriodo: sumValues(receivedFiltered),
      receitaMesAtual: sumValues(receivedThisMonth)
    },
    futureFlow: {
      next7: sumValues(flowUpcoming(7)),
      next30: sumValues(flowUpcoming(30))
    },
    indicators: {
      receitaTotal: sumValues(receivedInWindow),
      ticketMedio,
      mediaMensal3: monthlyAverage3,
      marcaMaisLucrativa: mostProfitableEntry ? mostProfitableEntry[0] : '—',
      pctPagoNoPrazo: receivedInWindow.length ? Math.round((paidOnTimeCount / receivedInWindow.length) * 100) : null,
      tempoMedioReceber: avgDaysToReceive
    },
    campaigns: filteredCampaigns
  };
};

const renderFinancePage = () => {
  const overviewContainer = document.querySelector('[data-finance-overview]');
  const futureContainer = document.querySelector('[data-finance-future]');
  const indicatorsContainer = document.querySelector('[data-finance-indicators]');
  const campaignsContainer = document.querySelector('[data-finance-campaigns]');
  const rangeSelect = document.querySelector('[data-finance-range]');
  if (!overviewContainer || !futureContainer || !indicatorsContainer || !campaignsContainer) return;

  const data = computeFinancePageData();
  if (rangeSelect) rangeSelect.value = String(data.rangeDays);
  const overviewPeriodLabel = data.rangeDays === 0 ? 'Recebido no período' : 'Recebido no período';
  const overviewPeriodNote = data.rangeDays === 0
    ? 'Histórico completo recebido'
    : `Campanhas recebidas em ${data.rangeLabel.toLowerCase()}`;

  overviewContainer.innerHTML = `
      <article class="finance-stat-card">
        <span class="finance-stat-label">Total recebido</span>
        <strong class="finance-stat-value">${formatCurrency(data.overview.totalRecebido)}</strong>
      <span class="finance-stat-note">Histórico geral já pago</span>
    </article>
      <article class="finance-stat-card">
        <span class="finance-stat-label">A receber</span>
        <strong class="finance-stat-value finance-stat-value--accent">${formatCurrency(data.overview.aReceber)}</strong>
        <span class="finance-stat-note">Pagamentos em aberto na janela selecionada</span>
      </article>
      <article class="finance-stat-card">
        <span class="finance-stat-label">Atrasado</span>
        <strong class="finance-stat-value finance-stat-value--danger">${formatCurrency(data.overview.atrasado)}</strong>
        <span class="finance-stat-note">Valores vencidos na janela selecionada</span>
      </article>
      <article class="finance-stat-card">
        <span class="finance-stat-label">${overviewPeriodLabel}</span>
        <strong class="finance-stat-value finance-stat-value--success">${formatCurrency(data.overview.recebidoNoPeriodo)}</strong>
        <span class="finance-stat-note">${overviewPeriodNote}</span>
      </article>
    `;

  futureContainer.innerHTML = `
    <article class="finance-flow-item">
      <div>
        <span class="finance-flow-label">Próximos 7 dias</span>
        <strong class="finance-flow-value">${formatCurrency(data.futureFlow.next7)}</strong>
      </div>
      <span class="finance-flow-note">Entrada prevista na próxima semana</span>
    </article>
    <article class="finance-flow-item">
      <div>
        <span class="finance-flow-label">Próximos 30 dias</span>
        <strong class="finance-flow-value">${formatCurrency(data.futureFlow.next30)}</strong>
      </div>
      <span class="finance-flow-note">Entrada prevista no próximo mês</span>
    </article>
  `;

  indicatorsContainer.innerHTML = `
    <article class="finance-indicator-card">
      <span class="finance-indicator-label">Receita total</span>
      <strong class="finance-indicator-value">${formatCurrency(data.indicators.receitaTotal)}</strong>
      <span class="finance-indicator-note">${data.rangeLabel}</span>
    </article>
    <article class="finance-indicator-card">
      <span class="finance-indicator-label">Ticket médio</span>
      <strong class="finance-indicator-value">${data.indicators.ticketMedio ? formatCurrency(data.indicators.ticketMedio) : '—'}</strong>
      <span class="finance-indicator-note">Campanhas recebidas</span>
    </article>
    <article class="finance-indicator-card">
      <span class="finance-indicator-label">Média mensal (3 meses)</span>
      <strong class="finance-indicator-value">${formatCurrency(data.indicators.mediaMensal3)}</strong>
      <span class="finance-indicator-note">Últimos 3 meses</span>
    </article>
    <article class="finance-indicator-card">
      <span class="finance-indicator-label">Marca mais lucrativa</span>
      <strong class="finance-indicator-value finance-indicator-value--text">${escapeHtml(data.indicators.marcaMaisLucrativa)}</strong>
      <span class="finance-indicator-note">Na janela selecionada</span>
    </article>
    <article class="finance-indicator-card">
      <span class="finance-indicator-label">% paga no prazo</span>
      <strong class="finance-indicator-value">${data.indicators.pctPagoNoPrazo === null ? '—' : `${data.indicators.pctPagoNoPrazo}%`}</strong>
      <span class="finance-indicator-note">Campanhas já recebidas</span>
    </article>
    <article class="finance-indicator-card">
      <span class="finance-indicator-label">Tempo médio para receber</span>
      <strong class="finance-indicator-value">${data.indicators.tempoMedioReceber === null ? '—' : `${data.indicators.tempoMedioReceber} dias`}</strong>
      <span class="finance-indicator-note">Da criação ao recebimento</span>
    </article>
  `;

  const activeExpandedId = data.campaigns.some((item) => item.id === state.ui.financeExpandedCampaignId)
    ? state.ui.financeExpandedCampaignId
    : '';

  campaignsContainer.innerHTML = data.campaigns.length
    ? data.campaigns
        .map((item) => {
          const isOpen = activeExpandedId === item.id;
          return `
            <article class="finance-campaign-item ${isOpen ? 'is-open' : ''}">
              <button
                class="finance-campaign-summary"
                data-action="toggle-finance-campaign"
                data-campaign-id="${item.id}"
                type="button"
                aria-expanded="${isOpen ? 'true' : 'false'}"
              >
                <div class="finance-campaign-summary-main">
                  <span class="finance-campaign-brand">${escapeHtml(item.brand)}</span>
                  <strong class="finance-campaign-title">${escapeHtml(item.title)}</strong>
                </div>
                <strong class="finance-campaign-value">${escapeHtml(item.valueLabel)}</strong>
                <span class="finance-payment-status ${item.statusClassName}">${escapeHtml(item.statusLabel)}</span>
                <span class="finance-campaign-chevron" aria-hidden="true">${isOpen ? '−' : '+'}</span>
              </button>
              <div class="finance-campaign-details">
                <div class="finance-campaign-details-grid">
                  <div class="finance-campaign-detail-cell">
                    <span>Data prevista</span>
                    <strong>${escapeHtml(item.paymentDate ? formatDateFullBR(item.paymentDate) : 'Sem data prevista')}</strong>
                  </div>
                  <div class="finance-campaign-detail-cell">
                    <span>Data de recebimento</span>
                    <strong>${escapeHtml(item.paymentReceivedAt ? formatDateFullBR(item.paymentReceivedAt) : 'Não recebido')}</strong>
                  </div>
                  <div class="finance-campaign-detail-cell">
                    <span>Dias de atraso</span>
                    <strong>${item.daysOverdue > 0 ? `${item.daysOverdue} dia(s)` : 'Sem atraso'}</strong>
                  </div>
                  <div class="finance-campaign-detail-cell">
                    <span>Tipo</span>
                    <strong>${escapeHtml(item.paymentType)}</strong>
                  </div>
                  <div class="finance-campaign-detail-cell">
                    <span>Forma de pagamento</span>
                    <strong>${escapeHtml(item.paymentMethod)}</strong>
                  </div>
                </div>
                <div class="finance-campaign-details-footer">
                  <div class="finance-campaign-stage">
                    <span>Etapa atual</span>
                    <strong>${escapeHtml(item.stageLabel)}</strong>
                  </div>
                  <button class="btn btn-ghost btn-small" data-action="open-campaign" data-campaign-id="${item.id}" type="button">Abrir campanha</button>
                </div>
              </div>
            </article>
          `;
        })
        .join('')
    : `<div class="finance-empty">Nenhuma campanha financeira encontrada em ${escapeHtml(data.rangeLabel.toLowerCase())}.</div>`;
};

const metricsRangeLabelMap = {
  15: '15 dias',
  30: '30 dias',
  45: '45 dias',
  90: '90 dias',
  0: 'Todo histórico'
};

const metricsStatusMeta = {
  prospeccao: { label: 'Prospecção' },
  producao: { label: 'Produção' },
  finalizacao: { label: 'Finalização' },
  concluida: { label: 'Concluído' }
};

const computeMetricsPageData = () => {
  const campaigns = (Array.isArray(state.campaigns) ? state.campaigns : []).filter((campaign) => campaign && !campaign.archived);
  const rangeDays = [0, 15, 30, 45, 90].includes(Number(state.ui.metricsRangeDays)) ? Number(state.ui.metricsRangeDays) : 30;
  const statusOrder = ['prospeccao', 'producao', 'finalizacao', 'concluida'];
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const todayKey = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;

  const parseDay = (value) => {
    const safe = String(value || '').trim();
    if (!safe) return null;
    const raw = safe.length > 10 ? safe : `${safe}T00:00:00Z`;
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
  };

  const toIsoDay = (value) => {
    const date = parseDay(value);
    if (!date) return '';
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  };

  const dayDiff = (valueA, valueB = today) => {
    const dateA = valueA instanceof Date ? valueA : parseDay(valueA);
    const dateB = valueB instanceof Date ? valueB : parseDay(valueB);
    if (!dateA || !dateB) return null;
    return Math.floor((dateA.getTime() - dateB.getTime()) / 86400000);
  };

  const getPercentPaid = (campaign) => {
    const raw = Number.isFinite(campaign?.paymentPercent)
      ? campaign.paymentPercent
      : parseInt(String(campaign?.paymentPercent || ''), 10);
    return Number.isFinite(raw) ? Math.max(0, Math.min(100, Math.round(raw))) : 0;
  };

  const getReceivedDate = (campaign) => {
    if (campaign.paymentReceivedAt) return toIsoDay(campaign.paymentReceivedAt);
    if (getPercentPaid(campaign) >= 100 || campaign.status === 'concluida') {
      return toIsoDay(campaign.updatedAt || campaign.createdAt);
    }
    return '';
  };

  const getFinancialStatus = (campaign) => {
    if (getReceivedDate(campaign)) return 'recebido';
    if (campaign.paymentDate && campaign.paymentDate < todayKey) return 'atrasado';
    return 'a_receber';
  };

  const getFilterDate = (campaign) => {
    const financialStatus = getFinancialStatus(campaign);
    if (financialStatus === 'recebido') return getReceivedDate(campaign);
    return toIsoDay(campaign.paymentDate || campaign.dueDate || campaign.updatedAt || campaign.createdAt);
  };

  const isInRange = (campaign) => {
    if (rangeDays === 0) return true;
    const dateKey = getFilterDate(campaign);
    const date = parseDay(dateKey);
    if (!date) return false;
    const diff = dayDiff(date, today);
    if (diff === null) return false;
    return diff <= 0 ? Math.abs(diff) <= rangeDays : diff <= rangeDays;
  };

  const sumValues = (list) => list.reduce((sum, item) => sum + (Number(item?.value) || 0), 0);
  const hasValue = (campaign) => (Number(campaign?.value) || 0) > 0;
  const timelineReference = campaigns.map((campaign) => ({
    ...campaign,
    financialStatus: getFinancialStatus(campaign),
    receivedAt: getReceivedDate(campaign),
    filterDate: getFilterDate(campaign),
    inRange: isInRange(campaign)
  }));

  const completedCampaigns = timelineReference.filter((campaign) => campaign.status === 'concluida');
  const receivedCampaigns = timelineReference.filter((campaign) => campaign.financialStatus === 'recebido');
  const receivedInRange = receivedCampaigns.filter((campaign) => campaign.inRange);
  const openInRange = timelineReference.filter((campaign) => campaign.financialStatus === 'a_receber' && campaign.inRange);
  const overdueInRange = timelineReference.filter((campaign) => campaign.financialStatus === 'atrasado' && campaign.inRange);
  const totalCampaigns = campaigns.length;
  const completionRate = totalCampaigns ? Math.round((completedCampaigns.length / totalCampaigns) * 100) : 0;

  const statusBuckets = statusOrder.map((status) => {
    const items = timelineReference
      .filter((campaign) => campaign.status === status)
      .slice()
      .sort((a, b) => {
        const dueA = String(a?.dueDate || '9999-12-31');
        const dueB = String(b?.dueDate || '9999-12-31');
        if (dueA !== dueB) return dueA.localeCompare(dueB);
        return (Number(b?.value) || 0) - (Number(a?.value) || 0);
      });

    return {
      key: status,
      label: metricsStatusMeta[status]?.label || statusLabels[status] || status,
      count: items.length,
      items: items.map((campaign) => ({
        id: campaign.id,
        title: campaign.title || campaign.brand || 'Campanha',
        brand: campaign.brand || 'Sem marca',
        stageLabel: getCampaignStageLabel(campaign.status, campaign.stage) || statusLabels[campaign.status] || 'Sem etapa',
        dueDate: campaign.dueDate || '',
        value: Number(campaign.value) || 0
      }))
    };
  });

  const validStatusOpen = String(state.ui.metricsStatusOpen || '').trim();
  const selectedStatus = statusBuckets.find((bucket) => bucket.key === validStatusOpen) ? validStatusOpen : '';
  const activeStatus = selectedStatus || statusBuckets.find((bucket) => bucket.count > 0)?.key || 'prospeccao';

  const getMonthStart = (offset) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - offset, 1));
  const monthBuckets = [5, 4, 3, 2, 1, 0].map((offset) => getMonthStart(offset));
  const monthLabels = monthBuckets.map((monthStart) =>
    monthStart.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).replace('.', '')
  );

  const sumByMonth = (list, datePicker) =>
    monthBuckets.map((monthStart) => {
      const month = monthStart.getUTCMonth();
      const year = monthStart.getUTCFullYear();
      return list
        .filter((campaign) => {
          const date = parseDay(datePicker(campaign));
          return Boolean(date && date.getUTCMonth() === month && date.getUTCFullYear() === year);
        })
        .reduce((sum, campaign) => sum + (Number(campaign.value) || 0), 0);
    });

  const monthlyReceived = sumByMonth(receivedCampaigns, (campaign) => campaign.receivedAt);
  const monthlyForecast = sumByMonth(
    timelineReference.filter((campaign) => campaign.financialStatus !== 'recebido'),
    (campaign) => campaign.paymentDate || campaign.dueDate
  );

  const avgTicket = receivedInRange.length ? Math.round(sumValues(receivedInRange) / receivedInRange.length) : 0;
  const mostProfitableBrandEntry = Object.entries(
    receivedInRange.reduce((acc, campaign) => {
      const key = String(campaign.brand || 'Sem marca');
      acc[key] = (acc[key] || 0) + (Number(campaign.value) || 0);
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1])[0] || null;

  const avgDaysToReceiveSource = receivedCampaigns
    .map((campaign) => {
      const createdAt = parseDay(campaign.createdAt);
      const receivedAt = parseDay(campaign.receivedAt);
      if (!createdAt || !receivedAt) return null;
      const diff = dayDiff(receivedAt, createdAt);
      return Number.isFinite(diff) ? Math.max(0, diff) : null;
    })
    .filter((value) => Number.isFinite(value));

  const avgDaysToReceive = avgDaysToReceiveSource.length
    ? Math.round(avgDaysToReceiveSource.reduce((sum, value) => sum + value, 0) / avgDaysToReceiveSource.length)
    : null;

  const onTimePaid = receivedInRange.filter((campaign) => {
    if (!campaign.paymentDate) return true;
    if (!campaign.receivedAt) return false;
    return campaign.receivedAt <= campaign.paymentDate;
  }).length;
  const onTimeRate = receivedInRange.length ? Math.round((onTimePaid / receivedInRange.length) * 100) : null;

  return {
    rangeDays,
    rangeLabel: metricsRangeLabelMap[rangeDays] || '30 dias',
    overview: {
      totalRecebido: sumValues(receivedCampaigns.filter(hasValue)),
      recebidoNoPeriodo: sumValues(receivedInRange.filter(hasValue)),
      aReceber: sumValues(openInRange.filter(hasValue)),
      atrasado: sumValues(overdueInRange.filter(hasValue)),
      taxaConclusao: completionRate
    },
    funnel: statusBuckets,
    selectedStatus,
    activeStatus,
    monthly: {
      labels: monthLabels,
      received: monthlyReceived,
      forecast: monthlyForecast
    },
    indicators: {
      ticketMedio: avgTicket,
      tempoMedioReceber: avgDaysToReceive,
      marcaMaisLucrativa: mostProfitableBrandEntry ? mostProfitableBrandEntry[0] : '—',
      campanhasAtrasadas: overdueInRange.length,
      campanhasRecebidas: receivedInRange.length,
      pctPagoNoPrazo: onTimeRate
    }
  };
};

const renderMetricsPage = () => {
  const metricsSection = document.querySelector('[data-section="metrics"]');
  const statusModal = document.getElementById('metrics-status-modal');
  const statusModalBody = document.querySelector('[data-metrics-status-modal-body]');
  const statusModalTitle = document.querySelector('[data-metrics-status-modal-title]');
  const statusModalSubtitle = document.querySelector('[data-metrics-status-modal-subtitle]');
  const isMetricsOpen = Boolean(metricsSection && metricsSection.classList.contains('active'));
  if (!isMetricsOpen) {
    if (statusModal) {
      statusModal.classList.remove('open');
      statusModal.setAttribute('aria-hidden', 'true');
    }
    if (metricsMonthlyChart) {
      metricsMonthlyChart.destroy();
      metricsMonthlyChart = null;
    }
    return;
  }

  const overviewContainer = document.querySelector('[data-metrics-overview]');
  const funnelContainer = document.querySelector('[data-metrics-funnel]');
  const statusListContainer = document.querySelector('[data-metrics-status-list]');
  const indicatorsContainer = document.querySelector('[data-metrics-indicators]');
  const rangeSelect = document.querySelector('[data-metrics-range]');
  const chartCanvas = document.getElementById('metrics-monthly-chart');

  if (!overviewContainer || !funnelContainer || !statusListContainer || !indicatorsContainer) return;

  const data = computeMetricsPageData();
  const isMobileMetrics = Boolean(window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
  const funnelActiveStatus = isMobileMetrics ? data.selectedStatus : data.activeStatus;
  if (rangeSelect) rangeSelect.value = String(data.rangeDays);

  overviewContainer.innerHTML = `
    <article class="metrics-stat-card">
      <span class="metrics-stat-label">Total recebido</span>
      <strong class="metrics-stat-value">${formatCurrency(data.overview.totalRecebido)}</strong>
      <span class="metrics-stat-note">Histórico geral pago</span>
    </article>
    <article class="metrics-stat-card">
      <span class="metrics-stat-label">Recebido no período</span>
      <strong class="metrics-stat-value metrics-stat-value--success">${formatCurrency(data.overview.recebidoNoPeriodo)}</strong>
      <span class="metrics-stat-note">${escapeHtml(data.rangeLabel)}</span>
    </article>
    <article class="metrics-stat-card">
      <span class="metrics-stat-label">A receber</span>
      <strong class="metrics-stat-value metrics-stat-value--accent">${formatCurrency(data.overview.aReceber)}</strong>
      <span class="metrics-stat-note">Dentro da janela selecionada</span>
    </article>
    <article class="metrics-stat-card">
      <span class="metrics-stat-label">Atrasado</span>
      <strong class="metrics-stat-value metrics-stat-value--danger">${formatCurrency(data.overview.atrasado)}</strong>
      <span class="metrics-stat-note">Com prazo vencido</span>
    </article>
    <article class="metrics-stat-card">
      <span class="metrics-stat-label">Taxa de conclusão</span>
      <strong class="metrics-stat-value">${data.overview.taxaConclusao}%</strong>
      <span class="metrics-stat-note">Campanhas concluídas no total</span>
    </article>
  `;

  funnelContainer.innerHTML = data.funnel
    .map((bucket) => `
      <button
        class="metrics-funnel-step ${funnelActiveStatus === bucket.key ? 'is-active' : ''}"
        data-action="open-metrics-status"
        data-metrics-status="${bucket.key}"
        type="button"
      >
        <span class="metrics-funnel-count">${bucket.count} campanha${bucket.count === 1 ? '' : 's'}</span>
        <span class="metrics-funnel-label">${escapeHtml(bucket.label)}</span>
      </button>
    `)
    .join('');

  const inlineBucket = data.funnel.find((bucket) => bucket.key === data.activeStatus) || null;
  const modalBucket = data.funnel.find((bucket) => bucket.key === data.selectedStatus) || null;
  const inlineHtml = getMetricsStatusDetailHtml(inlineBucket);
  const modalHtml = getMetricsStatusDetailHtml(modalBucket);
  const shouldShowModal = Boolean(isMobileMetrics && modalBucket && state.ui.activePage === 'metrics');

  statusListContainer.innerHTML = isMobileMetrics ? '' : inlineHtml;

  if (statusModal && statusModalBody && statusModalTitle && statusModalSubtitle) {
    statusModalTitle.textContent = modalBucket ? modalBucket.label : 'Status';
    statusModalSubtitle.textContent = modalBucket
      ? `Veja as campanhas que estão em ${modalBucket.label.toLowerCase()}.`
      : 'Veja as campanhas dessa fase.';
    statusModalBody.innerHTML = modalBucket ? modalHtml : '';
    statusModal.classList.toggle('open', shouldShowModal);
    statusModal.setAttribute('aria-hidden', shouldShowModal ? 'false' : 'true');
  }

  indicatorsContainer.innerHTML = `
    <article class="metrics-indicator-card">
      <span class="metrics-indicator-label">Ticket médio</span>
      <strong class="metrics-indicator-value">${data.indicators.ticketMedio ? formatCurrency(data.indicators.ticketMedio) : '—'}</strong>
      <span class="metrics-indicator-note">Campanhas recebidas no período</span>
    </article>
    <article class="metrics-indicator-card">
      <span class="metrics-indicator-label">Tempo médio para receber</span>
      <strong class="metrics-indicator-value">${data.indicators.tempoMedioReceber === null ? '—' : `${data.indicators.tempoMedioReceber} dias`}</strong>
      <span class="metrics-indicator-note">Da criação ao recebimento</span>
    </article>
    <article class="metrics-indicator-card">
      <span class="metrics-indicator-label">Marca mais lucrativa</span>
      <strong class="metrics-indicator-value metrics-indicator-value--text">${escapeHtml(data.indicators.marcaMaisLucrativa)}</strong>
      <span class="metrics-indicator-note">Na janela selecionada</span>
    </article>
    <article class="metrics-indicator-card">
      <span class="metrics-indicator-label">% paga no prazo</span>
      <strong class="metrics-indicator-value">${data.indicators.pctPagoNoPrazo === null ? '—' : `${data.indicators.pctPagoNoPrazo}%`}</strong>
      <span class="metrics-indicator-note">${data.indicators.campanhasRecebidas} campanha(s) recebida(s)</span>
    </article>
    <article class="metrics-indicator-card">
      <span class="metrics-indicator-label">Campanhas atrasadas</span>
      <strong class="metrics-indicator-value">${data.indicators.campanhasAtrasadas}</strong>
      <span class="metrics-indicator-note">Na janela selecionada</span>
    </article>
  `;

  if (!chartCanvas || typeof window.Chart !== 'function') return;
  const context = chartCanvas.getContext('2d');
  if (!context) return;

  if (metricsMonthlyChart) {
    metricsMonthlyChart.destroy();
    metricsMonthlyChart = null;
  }

  metricsMonthlyChart = new window.Chart(context, {
    type: 'bar',
    data: {
      labels: data.monthly.labels,
      datasets: [
        {
          label: 'Recebido',
          data: data.monthly.received,
          borderRadius: 8,
          backgroundColor: 'rgba(56, 189, 248, 0.55)',
          borderColor: 'rgba(56, 189, 248, 0.95)',
          borderWidth: 1
        },
        {
          label: 'Previsto',
          data: data.monthly.forecast,
          borderRadius: 8,
          backgroundColor: 'rgba(110, 231, 183, 0.45)',
          borderColor: 'rgba(110, 231, 183, 0.9)',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#dbe7f3',
            boxWidth: 10,
            boxHeight: 10,
            useBorderRadius: true
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(Number(ctx.parsed.y) || 0)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#9fb1c6', maxRotation: 0 }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(148, 163, 184, 0.14)' },
          ticks: {
            color: '#9fb1c6',
            callback: (value) => formatCurrency(Number(value) || 0)
          }
        }
      }
    }
  });
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

const getCampaignOnboardingGuideHtml = () => {
  const onboarding = state.progress && typeof state.progress === 'object' ? state.progress.onboarding : null;
  if (!onboarding || onboarding.quizDone !== true || onboarding.firstCampaignCreated === true) return '';

  const totalCampaigns = Array.isArray(state.campaigns) ? state.campaigns.length : 0;
  if (totalCampaigns > 0) return '';

  const hasBrands = Array.isArray(state.brands) && state.brands.length > 0;
  const primaryAction = hasBrands
    ? `
      <button class="btn btn-primary btn-small" data-action="new-campaign" type="button">
        Iniciar minha campanha
      </button>
    `
    : `
      <button class="btn btn-primary btn-small" data-action="open-brand-modal" data-brand-modal-context="campaign" type="button">
        Criar marca primeiro
      </button>
    `;

  return `
    <div class="card campaign-onboarding-card">
      <div>
        <p class="dashboard-eyebrow">Passo a passo</p>
        <h3 class="campaign-onboarding-title">Como criar sua primeira campanha</h3>
      </div>
      <ol class="campaign-onboarding-list">
        <li>${hasBrands ? 'Clique em "Nova campanha".' : 'Crie sua primeira marca para poder vincular a campanha.'}</li>
        <li>${hasBrands ? 'Preencha marca, origem, valor e prazo no modal.' : 'Depois clique em "Nova campanha" para abrir o cadastro.'}</li>
        <li>Defina a próxima ação e salve. O sistema vai te guiar campo a campo.</li>
      </ol>
      <div class="campaign-onboarding-actions">
        ${primaryAction}
      </div>
    </div>
  `;
};

const renderCampaigns = () => {
  const container = document.querySelector('[data-campaigns]');
  if (!container) return;

  const filter = state.ui.campaignFilter || 'all';
  const dashboardFilter = String(state.ui.campaignDashboardFilter || '').trim();
  const sortBy = state.ui.campaignSort || 'updatedAt';
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

  /* R$/hora */
  const getHourlyRate = (c) => {
    const v = Number.isFinite(c.value) ? c.value : 0;
    const h = Number.isFinite(c.estimatedHours) && c.estimatedHours > 0 ? c.estimatedHours : 0;
    return h > 0 ? Math.round(v / h) : null;
  };
  const allCampaignsAll = Array.isArray(state.campaigns) ? state.campaigns : [];
  const allRates = allCampaignsAll.map(getHourlyRate).filter(r => r !== null);
  const avgHourlyRate = allRates.length ? Math.round(allRates.reduce((a, b) => a + b, 0) / allRates.length) : 0;
  const hourlyGoal = state.settings?.hourlyGoal || 0;
  const getHourlyClass = (rate) => {
    if (rate === null) return '';
    const ref = hourlyGoal || avgHourlyRate || 100;
    if (rate >= ref * 1.1) return 'rate-good';
    if (rate >= ref * 0.8) return 'rate-warn';
    return 'rate-bad';
  };

  /* Smart indicators */
  const todayStr = new Date().toISOString().slice(0, 10);
  const getIndicators = (c) => {
    const tags = [];
    if (c.status === 'concluida') return tags;
    if (c.dueDate) {
      const diff = Math.ceil((new Date(c.dueDate) - new Date()) / 86400000);
      if (diff < 0) tags.push({ label: 'Atrasada', cls: 'ind-danger' });
      else if (diff <= 3) tags.push({ label: `Vence em ${diff}d`, cls: 'ind-warning' });
    }
    if (c.paymentDate && c.paymentDate < todayStr) {
      const pp = Number.isFinite(c.paymentPercent) ? c.paymentPercent : 0;
      if (pp < 100) tags.push({ label: 'Pgto atrasado', cls: 'ind-danger' });
    }
    const minTicket = state.settings?.minTicket || 0;
    if (minTicket > 0 && Number.isFinite(c.value) && c.value > 0 && c.value < minTicket) {
      tags.push({ label: 'Ticket baixo', cls: 'ind-warning' });
    }
    return tags;
  };

  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });

  const sortSelect = document.querySelector('[data-campaign-sort]');
  if (sortSelect && sortSelect.value !== sortBy) sortSelect.value = sortBy;

  const allCampaigns = Array.isArray(state.campaigns) ? state.campaigns : [];
  const list = allCampaigns
    .filter((campaign) => {
      if (filter !== 'all' && campaign.status !== filter) return false;
      if (!matchesDashboardCampaignFilter(campaign, dashboardFilter)) return false;
      return true;
    })
    .sort((a, b) => {
      if (a.priority && !b.priority) return -1;
      if (!a.priority && b.priority) return 1;
      let va, vb;
      switch (sortBy) {
        case 'value': va = a.value||0; vb = b.value||0; return vb - va;
        case 'hourlyRate': va = getHourlyRate(a)||0; vb = getHourlyRate(b)||0; return vb - va;
        case 'dueDate': va = a.dueDate||'9999'; vb = b.dueDate||'9999'; return va < vb ? -1 : va > vb ? 1 : 0;
        case 'daysUntilDue': va = a.dueDate ? Math.ceil((new Date(a.dueDate)-new Date())/86400000) : 9999; vb = b.dueDate ? Math.ceil((new Date(b.dueDate)-new Date())/86400000) : 9999; return va - vb;
        case 'brand': va = (a.brand||'').toLowerCase(); vb = (b.brand||'').toLowerCase(); return va < vb ? -1 : va > vb ? 1 : 0;
        case 'status': va = campaignStatusOrder.indexOf(a.status); vb = campaignStatusOrder.indexOf(b.status); return va - vb;
        default: va = a.updatedAt||a.createdAt||''; vb = b.updatedAt||b.createdAt||''; return vb > va ? 1 : vb < va ? -1 : 0;
      }
    });

  const dashboardFilterBanner = dashboardFilterMeta[dashboardFilter]
    ? `
      <div class="campaign-context-banner">
        <div class="campaign-context-copy">
          <strong>${escapeHtml(dashboardFilterMeta[dashboardFilter].label)}</strong>
          <span>Mostrando as campanhas abertas a partir do dashboard.</span>
        </div>
        <button class="btn btn-ghost btn-small" data-action="clear-dashboard-campaign-filter" type="button">Limpar</button>
      </div>
    `
    : '';

  const onboardingGuideHtml = getCampaignOnboardingGuideHtml();

  if (!list.length) {
    container.innerHTML = `${dashboardFilterBanner}${onboardingGuideHtml}<div class="card">Nenhuma campanha encontrada nesse filtro.</div>`;
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
    ${dashboardFilterBanner}
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
                    </button>`;
                } else if (!isLastStatus) {
                  const nextStatus = campaignStatusOrder[currentStatusIndex + 1];
                  const nextStatusLabel = statusLabels[nextStatus] || nextStatus;
                  advanceBtnHtml = `
                    <button class="btn-advance btn-advance-status" data-action="advance-stage" data-campaign-id="${campaign.id}" type="button">
                      <span class="btn-advance-label">Avançar: ${escapeHtml(nextStatusLabel)}</span>
                    </button>`;
                }
              } else {
                advanceBtnHtml = `
                  <span class="btn-advance btn-advance-disabled" aria-disabled="true">
                    <span class="btn-advance-label">Etapa final</span>
                  </span>`;
              }


              const isPriority = campaign.priority === true;
              const isModel = campaign.isModel === true;
              const priorityIcon = isPriority
                ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>'
                : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';

              const modelConvertBtn = isModel ? renderModelAdvanceBtn(campaign) : null;
              const modelOutreach = isModel ? renderModelOutreachBar(campaign) : '';

              const rate = getHourlyRate(campaign);
              const rateLabel = rate !== null ? formatCurrency(rate) : '\u2014';
              const rateCls = getHourlyClass(rate);
              const indicators = getIndicators(campaign);
              const indicatorHtml = indicators.map(i => `<span class="campaign-ind ${i.cls}">${i.label}</span>`).join('');
              return `
                <tr data-campaign-id="${campaign.id}" class="${isPriority ? 'campaign-priority' : ''}${isModel ? ' campaign-model' : ''}">
                  <td data-label="Marca">
                    <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">
                      <button class="btn-priority ${isPriority ? 'active' : ''}" data-action="toggle-priority" data-campaign-id="${campaign.id}" type="button" title="${isPriority ? 'Remover prioridade' : 'Marcar como prioridade'}">
                        ${priorityIcon}
                      </button>
                      <span class="chip chip-pill brand-status-${statusSafe}">${escapeHtml(campaign.brand || 'Marca')}</span>
                      ${isModel ? '<span class="badge-model">MODELO</span>' : ''}
                      ${indicatorHtml}
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

  if (typeof window !== 'undefined' && typeof window.enableCustomSelects === 'function') {
    window.enableCustomSelects();
  }
};

const renderBrands = () => {
  const listContainer = document.querySelector('[data-brands]');
  const detailContainer = document.querySelector('[data-brand-detail]');
  const statsContainer = document.querySelector('[data-brand-stats]');
  if (!listContainer || !detailContainer || !statsContainer) return;

  const brands = (Array.isArray(state.brands) ? state.brands : []).slice();
  const campaigns = Array.isArray(state.campaigns) ? state.campaigns : [];

  const toBrandKey = (value) => String(value || '').trim().toLowerCase();
  const formatDateShort = (value) => {
    const safe = String(value || '').trim();
    if (!safe) return '—';
    const date = new Date(`${safe}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('pt-BR');
  };
  const isoToDateKey = (value) => {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  };
  const formatRelativeAction = (value) => {
    const safe = String(value || '').trim();
    if (!safe) return 'Sem follow-up';
    return formatDateShort(safe);
  };

  const brandSummaries = brands.map((brand) => {
    const linkedCampaigns = campaigns
      .filter((campaign) => {
        if (!campaign || typeof campaign !== 'object') return false;
        if (String(campaign.brandId || '').trim()) return String(campaign.brandId || '').trim() === brand.id;
        return toBrandKey(campaign.brand) === toBrandKey(brand.name);
      })
      .slice()
      .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));

    const totalFaturado = linkedCampaigns.reduce((sum, campaign) => sum + (Number(campaign?.value) || 0), 0);
    const interactions = (Array.isArray(brand.interactions) ? brand.interactions : [])
      .slice()
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const lastInteraction = interactions[0] || null;
    const lastCampaignUpdate = linkedCampaigns[0] ? isoToDateKey(linkedCampaigns[0].updatedAt || linkedCampaigns[0].createdAt) : '';
    const lastContact = lastInteraction?.date || lastCampaignUpdate || '';
    const lastCompletedCampaign = linkedCampaigns.find((campaign) => campaign.status === 'concluida' || campaign.paymentPercent >= 100) || linkedCampaigns[0] || null;
    const pendingAction = Boolean(brand.nextActionType && brand.nextActionDate);

    return {
      brand,
      linkedCampaigns,
      totalFaturado,
      campaignCount: linkedCampaigns.length,
      ticketMedio: linkedCampaigns.length ? totalFaturado / linkedCampaigns.length : 0,
      lastContact,
      interactions,
      pendingAction,
      nextFollowup: brand.nextActionDate || '',
      nextActionLabel: getNextActionLabel(brand.nextActionType, brand.nextActionCustomType),
      lastWork: lastCompletedCampaign
    };
  });

  brandSummaries.sort((a, b) => {
    if (a.pendingAction !== b.pendingAction) return a.pendingAction ? -1 : 1;
    if ((a.nextFollowup || '9999-12-31') !== (b.nextFollowup || '9999-12-31')) {
      return (a.nextFollowup || '9999-12-31').localeCompare(b.nextFollowup || '9999-12-31');
    }
    return String(a.brand.name || '').localeCompare(String(b.brand.name || ''), 'pt-BR');
  });

  const brandStatusCounts = {
    lead: brandSummaries.filter((item) => item.brand.status === 'lead').length,
    negociando: brandSummaries.filter((item) => item.brand.status === 'negociando').length,
    clientes: brandSummaries.filter((item) => ['cliente_ativo', 'cliente_recorrente'].includes(item.brand.status)).length,
    pendentes: brandSummaries.filter((item) => item.pendingAction).length
  };

  statsContainer.innerHTML = `
    <div class="brand-stat-card">
      <span class="brand-stat-label">Marcas registradas</span>
      <strong class="brand-stat-value">${brandSummaries.length}</strong>
      <span class="brand-stat-note">${brandStatusCounts.lead} lead(s) em abertura</span>
    </div>
    <div class="brand-stat-card">
      <span class="brand-stat-label">Negociando</span>
      <strong class="brand-stat-value">${brandStatusCounts.negociando}</strong>
      <span class="brand-stat-note">Conversas quentes no momento</span>
    </div>
    <div class="brand-stat-card">
      <span class="brand-stat-label">Clientes</span>
      <strong class="brand-stat-value">${brandStatusCounts.clientes}</strong>
      <span class="brand-stat-note">Ativos e recorrentes</span>
    </div>
    <div class="brand-stat-card">
      <span class="brand-stat-label">Faturado total</span>
      <strong class="brand-stat-value">${formatCurrency(brandSummaries.reduce((sum, item) => sum + item.totalFaturado, 0))}</strong>
      <span class="brand-stat-note">${brandStatusCounts.pendentes} com ação pendente</span>
    </div>
  `;

  if (!brandSummaries.length) {
    listContainer.innerHTML = `
      <div class="brand-empty-state">
        <div class="metric-icon">${iconSvg('radar')}</div>
        <div>
          <h3>Nenhuma marca registrada</h3>
          <p class="muted">Crie sua primeira marca para organizar campanhas, follow-ups e histórico comercial no mesmo lugar.</p>
        </div>
      </div>
    `;
    detailContainer.innerHTML = `
      <div class="brand-detail-empty">
        <h3>Quando você adicionar uma marca, o detalhe aparece aqui.</h3>
        <p class="muted">Você vai conseguir ver resumo, próxima ação e campanhas vinculadas no mesmo lugar.</p>
        <button class="btn btn-primary" data-action="open-brand-modal" type="button">Criar primeira marca</button>
      </div>
    `;
    return;
  }

  const hasSelected = brandSummaries.some((item) => item.brand.id === state.ui.selectedBrandId);
  if (!hasSelected) {
    state.ui.selectedBrandId = brandSummaries[0].brand.id;
  }

  const selectedSummary = brandSummaries.find((item) => item.brand.id === state.ui.selectedBrandId) || brandSummaries[0];
  const selectedBrand = selectedSummary.brand;

  listContainer.innerHTML = `
    <div class="brand-list-table">
      <div class="brand-table-head">
        <span>Status</span>
        <span>Marca</span>
        <span>Ação pendente</span>
        <span>Próximo follow-up</span>
        <span>Total faturado</span>
        <span>Campanhas</span>
        <span>Último contato</span>
        <span>Ações</span>
      </div>
      <div class="brand-table-body">
        ${brandSummaries
          .map((item) => {
            const isActive = item.brand.id === selectedBrand.id;
            const isDormant = ['inativa', 'perdida'].includes(item.brand.status);
            const actionChip = item.pendingAction
              ? `<span class="chip chip-pill chip-brand-pending">${escapeHtml(item.nextActionLabel || 'Pendente')}</span>`
              : '<span class="chip chip-pill chip-brand-neutral">Sem pendência</span>';
            return `
              <div class="brand-table-row ${isActive ? 'is-active' : ''}" data-action="select-brand" data-brand-id="${item.brand.id}">
                <div class="brand-table-cell brand-table-cell--status" data-label="Status">
                  <span class="chip chip-pill chip-brand-status chip-brand-status--${escapeHtml(item.brand.status)}">${escapeHtml(brandStatuses[item.brand.status] || item.brand.status)}</span>
                </div>
                <div class="brand-table-cell brand-table-cell--primary" data-label="Marca">
                  <strong>${escapeHtml(item.brand.name || 'Marca')}</strong>
                  <span class="muted">${escapeHtml(item.brand.contact || item.brand.instagram || item.brand.email || 'Sem contato principal')}</span>
                </div>
                <div class="brand-table-cell brand-table-cell--pending" data-label="Ação pendente">
                  ${actionChip}
                </div>
                <div class="brand-table-cell brand-table-cell--next" data-label="Próximo follow-up">
                  <span>${formatRelativeAction(item.nextFollowup)}</span>
                </div>
                <div class="brand-table-cell brand-table-cell--money" data-label="Total faturado">
                  <strong>${formatCurrency(item.totalFaturado)}</strong>
                </div>
                <div class="brand-table-cell brand-table-cell--count" data-label="Campanhas">
                  <strong>${item.campaignCount}</strong>
                </div>
                <div class="brand-table-cell brand-table-cell--date" data-label="Último contato">
                  <span>${item.lastContact ? formatDateShort(item.lastContact) : '—'}</span>
                </div>
                <div class="brand-table-cell brand-table-cell--actions" data-label="Ações">
                  <div class="brand-row-actions">
                    <button class="btn btn-ghost btn-small brand-row-btn brand-row-btn--edit" data-action="edit-brand" data-brand-id="${item.brand.id}" type="button">Editar</button>
                    <button class="btn btn-ghost btn-small brand-row-btn ${isDormant ? 'brand-row-btn--reactivate' : 'brand-row-btn--deactivate'}" data-action="toggle-brand-active" data-brand-id="${item.brand.id}" type="button">${isDormant ? 'Reativar' : 'Desativar'}</button>
                  </div>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    </div>
  `;

  const nextActionCard = selectedSummary.pendingAction
    ? `
      <div class="brand-detail-nextaction">
        <div class="brand-detail-metric">
          <span class="brand-detail-label">Próximo follow-up</span>
          <strong>${formatDateShort(selectedBrand.nextActionDate)}</strong>
        </div>
        <div class="brand-detail-metric">
          <span class="brand-detail-label">Tipo</span>
          <strong>${escapeHtml(selectedSummary.nextActionLabel || '—')}</strong>
        </div>
        <div class="brand-detail-note">${escapeHtml(selectedBrand.nextActionNote || 'Sem observação cadastrada.')}</div>
      </div>
    `
    : `
      <div class="brand-detail-nextaction brand-detail-nextaction--empty">
        <strong>Sem próxima ação definida</strong>
        <p class="muted">Defina um follow-up para essa marca e deixe o dashboard comercial sempre em dia.</p>
      </div>
    `;

  detailContainer.innerHTML = `
    <div class="brand-detail-header">
      <div>
        <p class="dashboard-eyebrow">Marca selecionada</p>
        <h2>${escapeHtml(selectedBrand.name || 'Marca')}</h2>
        <p class="muted">${escapeHtml(selectedBrand.contact || 'Sem contato principal')} · ${escapeHtml(selectedBrand.email || selectedBrand.instagram || 'Sem canal principal')}</p>
      </div>
      <div class="brand-detail-actions">
        <button class="btn btn-ghost btn-small" data-action="edit-brand" data-brand-id="${selectedBrand.id}" type="button">Editar marca</button>
        <button class="btn btn-primary btn-small" data-action="new-campaign-for-brand" data-brand-id="${selectedBrand.id}" type="button">Nova campanha</button>
      </div>
    </div>

    <div class="brand-detail-summary">
      <div class="brand-detail-summary-card">
        <span class="brand-detail-label">Instagram</span>
        <strong>${escapeHtml(selectedBrand.instagram || '—')}</strong>
      </div>
      <div class="brand-detail-summary-card">
        <span class="brand-detail-label">Status</span>
        <strong>${escapeHtml(brandStatuses[selectedBrand.status] || selectedBrand.status)}</strong>
      </div>
      <div class="brand-detail-summary-card">
        <span class="brand-detail-label">Total faturado</span>
        <strong>${formatCurrency(selectedSummary.totalFaturado)}</strong>
      </div>
      <div class="brand-detail-summary-card">
        <span class="brand-detail-label">Ticket médio</span>
        <strong>${selectedSummary.campaignCount ? formatCurrency(selectedSummary.ticketMedio) : '—'}</strong>
      </div>
      <div class="brand-detail-summary-card">
        <span class="brand-detail-label">Nº campanhas</span>
        <strong>${selectedSummary.campaignCount}</strong>
      </div>
      <div class="brand-detail-summary-card">
        <span class="brand-detail-label">Último trabalho realizado</span>
        <strong>${escapeHtml(selectedSummary.lastWork?.title || selectedSummary.lastWork?.brand || '—')}</strong>
      </div>
    </div>

    <div class="brand-detail-grid">
      <div class="brand-detail-block">
        <div class="brand-detail-block-head">
          <div>
            <h3>Próxima ação</h3>
            <p class="muted">Follow-up atual dessa marca.</p>
          </div>
          <button class="btn btn-ghost btn-small" data-action="edit-brand-action" data-brand-id="${selectedBrand.id}" type="button">Editar ação</button>
        </div>
        ${nextActionCard}
      </div>

      <div class="brand-detail-block">
        <div class="brand-detail-block-head">
          <div>
            <h3>Histórico de campanhas</h3>
            <p class="muted">Campanhas vinculadas a essa marca.</p>
          </div>
        </div>
        <div class="brand-history-list">
          ${selectedSummary.linkedCampaigns.length
            ? selectedSummary.linkedCampaigns
                .map((campaign) => `
                  <div class="brand-history-item">
                    <div>
                      <strong>${escapeHtml(campaign.title || campaign.brand || 'Campanha')}</strong>
                      <div class="muted">${escapeHtml(
                        [statusLabels[campaign.status] || campaign.status, getCampaignStageLabel(campaign.status, campaign.stage)]
                          .filter(Boolean)
                          .join(' · ')
                      )}</div>
                    </div>
                    <div class="brand-history-meta">
                      <span>${formatCurrency(Number(campaign.value) || 0)}</span>
                      <span>${campaign.paymentPercent >= 100 ? 'Pago' : campaign.paymentDate ? `Pagamento ${formatDateShort(campaign.paymentDate)}` : 'Pagamento pendente'}</span>
                      <span>Prazo ${campaign.dueDate ? formatDateShort(campaign.dueDate) : '—'}</span>
                    </div>
                    <button class="btn btn-ghost btn-small" data-action="open-campaign" data-campaign-id="${campaign.id}" type="button">Abrir campanha</button>
                  </div>
                `)
                .join('')
            : '<p class="muted">Nenhuma campanha vinculada a essa marca ainda.</p>'}
        </div>
      </div>
    </div>
  `;
};

/* ──────────────────── PERFORMANCE ──────────────────── */

const PERF_RANGE_OPTIONS = [7, 15, 30, 45, 90];
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

/* ── SVG Charts ── */

const renderLineChartSvg = (series, labels, unit) => {
  if (!series.length) return '<div class="perf-empty">Sem dados.</div>';
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
  return `<svg viewBox="0 0 ${w} ${h}" class="perf-line-svg" preserveAspectRatio="xMidYMid meet">
    <polyline points="${pts.join(' ')}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    ${dots}${ticks}
  </svg>`;
};

const renderBarChartHtml = (items) => {
  const mx = Math.max(...items.map(i => i.value), 1);
  return `<div class="perf-bars">${items.map(i => {
    const w = Math.round((i.value / mx) * 100);
    return `<div class="perf-bar-row"><span class="perf-bar-lbl">${escapeHtml(i.label)}</span><div class="perf-bar-track"><div class="perf-bar-fill" style="width:${w}%"></div><span class="perf-bar-val">${typeof i.value === 'number' && i.format === 'currency' ? formatCurrency(i.value) : i.value}</span></div></div>`;
  }).join('')}</div>`;
};

/* ── Performance data computation ── */

const computePerformance = () => {
  const now = new Date();
  const rangeDays = PERF_RANGE_OPTIONS.includes(Number(state.metrics?.rangeDays)) ? Number(state.metrics.rangeDays) : 30;
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
  const done = campaigns.filter(c => c.status === 'concluida');
  const doneCount = done.length;
  const openC = campaigns.filter(c => c.status !== 'concluida');

  /* FINANCIAL */
  const totalReceived = done.reduce((s, c) => s + c.value, 0);
  const totalOpen = openC.reduce((s, c) => s + c.value, 0);
  const prevMonthCampaigns = done.filter(c => { const d = c.paidAt || c.updatedAt; return d && inWindow(d, prevStart, prevEnd); });
  const prevReceita = prevMonthCampaigns.reduce((s, c) => s + c.value, 0);

  // Receita prevista pr\u00f3ximo m\u00eas
  const nextMonthStart = addDays(curEnd, 0);
  const nextMonthEnd = addDays(curEnd, 30);
  const nextMonthCampaigns = openC.filter(c => {
    if (!c.dueDate && !c.paymentDate) return true;
    const dd = parseDate(c.dueDate || c.paymentDate);
    return dd && inWindow(dd, nextMonthStart, nextMonthEnd);
  });
  const receitaPrevista = nextMonthCampaigns.reduce((s, c) => s + c.value, 0) || totalOpen;

  // R$/hora
  const withHours = done.filter(c => c.estimatedHours > 0);
  const avgHourlyRate = withHours.length ? Math.round(withHours.reduce((s, c) => s + c.value / c.estimatedHours, 0) / withHours.length) : 0;

  // Ticket
  const ticketMedio = doneCount ? Math.round(totalReceived / doneCount) : 0;
  const sortedValues = done.map(c => c.value).sort((a, b) => a - b);
  const ticketMediano = sortedValues.length ? sortedValues[Math.floor(sortedValues.length / 2)] : 0;

  // Atraso
  const todayStr = dateKey(today);
  const emAtraso = openC.filter(c => {
    if (!c.paymentDate) return false;
    const pp = Number.isFinite(c.paymentPercent) ? c.paymentPercent : 0;
    return c.paymentDate < todayStr && pp < 100;
  });
  const valorAtraso = emAtraso.reduce((s, c) => s + c.value, 0);

  const paidOnTime = done.filter(c => {
    if (!c.dueDate || !c.paidAt) return false;
    return c.paidAt <= new Date(c.dueDate + 'T23:59:59');
  });
  const pctPagoNoPrazo = doneCount ? paidOnTime.length / doneCount : 0;

  // Bars by brand
  const brandMap = {};
  campaigns.forEach(c => {
    const brand = c.brand || 'Sem marca';
    if (!brandMap[brand]) brandMap[brand] = 0;
    brandMap[brand] += c.value;
  });
  const brandBars = Object.entries(brandMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value, format: 'currency' }));

  // Timeline
  const days = buildDateRange(curStart, rangeDays);
  const dKeys = days.map(d => dateKey(d));
  const dLabels = days.map(d => fmtDateBR(d));
  const receivByDay = {};
  done.forEach(c => {
    const d = c.paidAt || c.updatedAt;
    if (!d || !inWindow(d, curStart, curEnd)) return;
    const k = dateKey(toDayStart(d));
    receivByDay[k] = (receivByDay[k] || 0) + c.value;
  });
  const receivSeries = dKeys.map(k => receivByDay[k] || 0);

  // Rankings
  const rankByValue = [...done].sort((a, b) => b.value - a.value).slice(0, 5).map(c => ({ name: getCampaignName(c), value: formatCurrency(c.value) }));
  const rankByHourly = [...withHours].sort((a, b) => (b.value/b.estimatedHours) - (a.value/a.estimatedHours)).slice(0, 5).map(c => ({ name: getCampaignName(c), value: formatCurrency(Math.round(c.value / c.estimatedHours)) + '/h' }));

  // Pay time by brand
  const brandPayTime = {};
  done.forEach(c => {
    const brand = c.brand || 'Sem marca';
    const d = daysBetweenD(c.createdAt, c.paidAt || c.updatedAt);
    if (!brandPayTime[brand]) brandPayTime[brand] = [];
    brandPayTime[brand].push(d);
  });
  const brandPayAvg = Object.entries(brandPayTime).map(([label, arr]) => ({
    label, value: Math.round(arr.reduce((s, v) => s + v, 0) / arr.length)
  })).sort((a, b) => a.value - b.value);

  /* COMMERCIAL */
  const brands = Array.isArray(state.brands) ? state.brands : [];
  const totalContacts = brands.length;
  const closedInPeriod = campaigns.filter(c => {
    const d = c.createdAt;
    return d && inWindow(d, curStart, curEnd);
  });
  const closingRate = totalContacts > 0 ? doneCount / totalContacts : 0;

  const brandCount = {};
  campaigns.forEach(c => {
    const brand = c.brand || 'Sem marca';
    brandCount[brand] = (brandCount[brand] || 0) + 1;
  });
  const recurrentBrands = Object.entries(brandCount).filter(([, v]) => v >= 2).map(([k]) => k);
  const conversionRate = totalContacts > 0 ? total / totalContacts : 0;

  /* OPERATIONAL */
  const atrasadas = openC.filter(c => c.dueDate && c.dueDate < todayStr);
  const emRisco = openC.filter(c => {
    if (!c.dueDate) return false;
    const diff = Math.ceil((new Date(c.dueDate) - now) / 86400000);
    return diff >= 0 && diff <= 3;
  });

  const productionTime = done.map(c => {
    const d = daysBetweenD(c.createdAt, c.updatedAt);
    return Number.isFinite(d) ? d : null;
  }).filter(d => d !== null);
  const avgProdTime = productionTime.length ? Math.round(productionTime.reduce((s, v) => s + v, 0) / productionTime.length) : 0;

  const payTime = done.map(c => {
    const d = daysBetweenD(c.createdAt, c.paidAt || c.updatedAt);
    return Number.isFinite(d) ? d : null;
  }).filter(d => d !== null);
  const avgPayTime = payTime.length ? Math.round(payTime.reduce((s, v) => s + v, 0) / payTime.length) : 0;

  const stale = openC.filter(c => getDaysStalled(c, now) >= (state.settings?.alertStaleDays || 5));

  return {
    rangeDays, total, doneCount,
    financial: { totalReceived, totalOpen, receitaPrevista, avgHourlyRate, ticketMedio, ticketMediano, valorAtraso, pctPagoNoPrazo, brandBars, receivSeries, receivLabels: dLabels, rankByValue, rankByHourly, brandPayAvg },
    commercial: { totalContacts, closingRate, closedCount: closedInPeriod.length, recurrentBrands, conversionRate },
    operational: { atrasadas: atrasadas.length, emRisco: emRisco.length, avgProdTime, avgPayTime, stale: stale.length, atrasadasList: atrasadas.map(getCampaignName), emRiscoList: emRisco.map(getCampaignName) }
  };
};

/* ── Render Performance ── */

const renderPerformance = () => {
  const container = document.querySelector('[data-perf-content]');
  const rangeBar = document.querySelector('[data-perf-range]');
  if (!container) return;

  const tab = state.ui.performanceTab || 'financial';
  const perf = computePerformance();

  // Sync tabs
  document.querySelectorAll('.perf-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.perfTab === tab);
  });

  // Range bar
  if (rangeBar && tab !== 'badges') {
    rangeBar.innerHTML = PERF_RANGE_OPTIONS.map(d => {
      const active = d === perf.rangeDays;
      return `<button class="perf-range-btn ${active ? 'is-active' : ''}" data-action="perf-range" data-range-days="${d}" type="button">${d}d</button>`;
    }).join('');
    rangeBar.style.display = '';
  } else if (rangeBar) {
    rangeBar.style.display = 'none';
  }

  if (tab === 'financial') {
    const f = perf.financial;
    container.innerHTML = `
      <div class="perf-cards-grid">
        <div class="card perf-card">
          <div class="perf-card-icon">${iconSvg('cash')}</div>
          <div class="perf-card-label">Receita total</div>
          <div class="perf-card-value">${formatCurrency(f.totalReceived)}</div>
          <div class="muted">${perf.doneCount} campanha(s) paga(s)</div>
        </div>
        <div class="card perf-card">
          <div class="perf-card-icon">${iconSvg('trend')}</div>
          <div class="perf-card-label">Receita prevista</div>
          <div class="perf-card-value">${formatCurrency(f.receitaPrevista)}</div>
          <div class="muted">Pr\u00f3ximo per\u00edodo</div>
        </div>
        <div class="card perf-card">
          <div class="perf-card-icon">${iconSvg('time')}</div>
          <div class="perf-card-label">R$/hora m\u00e9dio</div>
          <div class="perf-card-value">${f.avgHourlyRate ? formatCurrency(f.avgHourlyRate) + '/h' : '\u2014'}</div>
          <div class="muted">Campanhas com horas registradas</div>
        </div>
        <div class="card perf-card">
          <div class="perf-card-icon">${iconSvg('ticket')}</div>
          <div class="perf-card-label">Ticket m\u00e9dio</div>
          <div class="perf-card-value">${formatCurrency(f.ticketMedio)}</div>
          <div class="muted">Mediano: ${formatCurrency(f.ticketMediano)}</div>
        </div>
        <div class="card perf-card">
          <div class="perf-card-icon">${iconSvg('bars')}</div>
          <div class="perf-card-label">R$ em atraso</div>
          <div class="perf-card-value ${f.valorAtraso > 0 ? 'perf-value--red' : ''}">${formatCurrency(f.valorAtraso)}</div>
          <div class="muted">Pagamentos pendentes</div>
        </div>
        <div class="card perf-card">
          <div class="perf-card-icon">${iconSvg('radar')}</div>
          <div class="perf-card-label">Pagos no prazo</div>
          <div class="perf-card-value">${formatPercent(f.pctPagoNoPrazo)}</div>
          <div class="muted">Das campanhas conclu\u00eddas</div>
        </div>
      </div>

      <div class="perf-section">
        <h3>Receita por marca</h3>
        ${f.brandBars.length ? renderBarChartHtml(f.brandBars) : '<div class="perf-empty">Sem dados de marcas.</div>'}
      </div>

      <div class="perf-section">
        <h3>Linha do tempo de recebimentos</h3>
        ${renderLineChartSvg(f.receivSeries, f.receivLabels, '')}
      </div>

      <div class="perf-section perf-section--split">
        <div>
          <h4>Ranking por valor</h4>
          ${f.rankByValue.length ? `<ol class="perf-ranking">${f.rankByValue.map(r => `<li><span>${escapeHtml(r.name)}</span><strong>${r.value}</strong></li>`).join('')}</ol>` : '<div class="perf-empty">Sem dados.</div>'}
        </div>
        <div>
          <h4>Ranking por R$/hora</h4>
          ${f.rankByHourly.length ? `<ol class="perf-ranking">${f.rankByHourly.map(r => `<li><span>${escapeHtml(r.name)}</span><strong>${r.value}</strong></li>`).join('')}</ol>` : '<div class="perf-empty">Registre horas nas campanhas.</div>'}
        </div>
      </div>

      <div class="perf-section">
        <h4>Tempo m\u00e9dio de pagamento por marca</h4>
        ${f.brandPayAvg.length ? renderBarChartHtml(f.brandPayAvg.map(b => ({ label: b.label, value: b.value }))) : '<div class="perf-empty">Sem dados.</div>'}
      </div>
    `;
  } else if (tab === 'commercial') {
    const c = perf.commercial;
    container.innerHTML = `
      <div class="perf-cards-grid">
        <div class="card perf-card">
          <div class="perf-card-icon">${iconSvg('send')}</div>
          <div class="perf-card-label">Total de contatos</div>
          <div class="perf-card-value">${c.totalContacts}</div>
        </div>
        <div class="card perf-card">
          <div class="perf-card-icon">${iconSvg('bars')}</div>
          <div class="perf-card-label">Taxa de fechamento</div>
          <div class="perf-card-value">${formatPercent(c.closingRate)}</div>
        </div>
        <div class="card perf-card">
          <div class="perf-card-icon">${iconSvg('radar')}</div>
          <div class="perf-card-label">Fechadas no per\u00edodo</div>
          <div class="perf-card-value">${c.closedCount}</div>
        </div>
        <div class="card perf-card">
          <div class="perf-card-icon">${iconSvg('chat')}</div>
          <div class="perf-card-label">Marcas recorrentes</div>
          <div class="perf-card-value">${c.recurrentBrands.length}</div>
          <div class="muted">${c.recurrentBrands.slice(0, 3).join(', ') || 'Nenhuma ainda'}</div>
        </div>
      </div>

      <div class="perf-section">
        <div class="card perf-insight-card">
          <h4>\ud83d\udca1 Insights comerciais</h4>
          <ul class="perf-insights-list">
            ${c.totalContacts === 0 ? '<li class="muted">Registre marcas para ver insights.</li>' : ''}
            ${c.closingRate >= 0.3 ? '<li class="perf-insight--good">Sua taxa de fechamento est\u00e1 acima de 30% \u2014 excelente!</li>' : ''}
            ${c.closingRate > 0 && c.closingRate < 0.15 ? '<li class="perf-insight--warn">Taxa de fechamento abaixo de 15%. Revise sua abordagem.</li>' : ''}
            ${c.recurrentBrands.length >= 3 ? '<li class="perf-insight--good">Voc\u00ea tem ' + c.recurrentBrands.length + ' marcas recorrentes \u2014 base s\u00f3lida!</li>' : ''}
            ${c.recurrentBrands.length === 0 && c.totalContacts > 5 ? '<li class="perf-insight--warn">Nenhuma marca recorrente. Tente reativar contatos antigos.</li>' : ''}
          </ul>
        </div>
      </div>
    `;
  } else if (tab === 'operational') {
    const o = perf.operational;
    container.innerHTML = `
      <div class="perf-cards-grid">
        <div class="card perf-card">
          <div class="perf-card-icon">${iconSvg('time')}</div>
          <div class="perf-card-label">Atrasadas</div>
          <div class="perf-card-value ${o.atrasadas > 0 ? 'perf-value--red' : 'perf-value--green'}">${o.atrasadas}</div>
          <div class="muted">${o.atrasadasList.slice(0,2).join(', ') || 'Nenhuma'}</div>
        </div>
        <div class="card perf-card">
          <div class="perf-card-icon">${iconSvg('radar')}</div>
          <div class="perf-card-label">Em risco (3 dias)</div>
          <div class="perf-card-value ${o.emRisco > 0 ? 'perf-value--warn' : ''}">${o.emRisco}</div>
          <div class="muted">${o.emRiscoList.slice(0,2).join(', ') || 'Nenhuma'}</div>
        </div>
        <div class="card perf-card">
          <div class="perf-card-icon">${iconSvg('trend')}</div>
          <div class="perf-card-label">Tempo m\u00e9dio de produ\u00e7\u00e3o</div>
          <div class="perf-card-value">${o.avgProdTime} dias</div>
        </div>
        <div class="card perf-card">
          <div class="perf-card-icon">${iconSvg('cash')}</div>
          <div class="perf-card-label">Tempo at\u00e9 pagamento</div>
          <div class="perf-card-value">${o.avgPayTime} dias</div>
        </div>
        <div class="card perf-card">
          <div class="perf-card-icon">${iconSvg('bars')}</div>
          <div class="perf-card-label">Pipeline parado</div>
          <div class="perf-card-value ${o.stale > 0 ? 'perf-value--warn' : 'perf-value--green'}">${o.stale}</div>
          <div class="muted">Sem atualiza\u00e7\u00e3o por ${state.settings?.alertStaleDays || 5}+ dias</div>
        </div>
      </div>
    `;
  } else if (tab === 'badges') {
    const badges = badgeCatalog.map(b => {
      const result = b.check(state);
      return { ...b, ...result };
    });

    const categories = [
      { key: 'financial', label: '\ud83d\udcb0 Financeiro', items: badges.filter(b => b.category === 'financial') },
      { key: 'commercial', label: '\ud83d\udcc8 Comercial', items: badges.filter(b => b.category === 'commercial') },
      { key: 'operational', label: '\ud83e\udde0 Operacional', items: badges.filter(b => b.category === 'operational') }
    ];

    const totalBadges = badges.length;
    const doneBadges = badges.filter(b => b.done).length;
    const pctBadges = totalBadges ? Math.round((doneBadges / totalBadges) * 100) : 0;

    container.innerHTML = `
      <div class="card" style="margin-bottom:18px">
        <h3>Progresso de badges</h3>
        <div class="muted" style="margin-bottom:8px">${doneBadges} de ${totalBadges} conquistadas (${pctBadges}%)</div>
        <div class="progress-track"><div class="progress-fill" style="width:${pctBadges}%"></div></div>
      </div>

      ${categories.map(cat => `
        <div class="perf-badge-section">
          <h3>${cat.label}</h3>
          <div class="perf-badge-grid">
            ${cat.items.map(b => `
              <div class="card perf-badge ${b.done ? 'perf-badge--done' : ''}">
                <div class="perf-badge-header">
                  <div class="perf-badge-icon">${iconSvg(b.icon)}</div>
                  <div>
                    <div class="perf-badge-title">${b.title}</div>
                    <div class="muted">${b.desc}</div>
                  </div>
                  <span class="chip">${b.done ? 'Conquistada' : `+${b.xp} XP`}</span>
                </div>
                <div class="perf-badge-progress">
                  <div class="progress-track"><div class="progress-fill ${b.done ? '' : 'progress-fill--accent'}" style="width:${b.target ? Math.min(100, Math.round((b.current / b.target) * 100)) : 0}%"></div></div>
                  <div class="perf-badge-meta">
                    <span>${b.done ? 'Completo' : `${b.current} / ${b.target}`}</span>
                    ${b.insight ? `<span class="muted">${b.insight}</span>` : ''}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    `;
  }
};

const renderSettings = () => {
  /* toggles originais */
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
  renderDashboardFinancials();
  renderCampaigns();
  renderBrands();
  renderFinancePage();
  renderMetricsPage();
  renderSettings();
  setScriptOutput('');
};

export { renderAll, renderScriptHistory };

// VERSAO_ATUALIZADA_070226_2350
