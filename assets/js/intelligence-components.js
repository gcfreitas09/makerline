import { formatDate, formatDuration, formatShortDate, safeNumber } from './intelligence-utils.js';

const iconMap = {
  back: '<path d="M15 18l-6-6 6-6"/><path d="M9 12h10"/>',
  import: '<path d="M12 3v12"/><path d="M8 11l4 4 4-4"/><path d="M4 21h16"/>',
  export: '<path d="M12 21V9"/><path d="M8 13l4-4 4 4"/><path d="M4 3h16"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  activity: '<path d="M22 12h-4l-3 9-5-18-3 9H2"/>',
  inactive: '<path d="M6 3v12"/><path d="M18 9a6 6 0 1 1-6-6"/>',
  spark: '<path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2Z"/>',
  campaigns: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h6M7 16h8"/>',
  summary: '<path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h8M8 17h5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/>',
  timeline: '<path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="9"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  contact: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  key: '<circle cx="7.5" cy="14.5" r="3.5"/><path d="M10 12l9-9"/><path d="M15 4l3 3"/><path d="M13 6l3 3"/>',
  delete: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
  empty: '<path d="M4 7h16v10H4z"/><path d="M8 11h8"/><path d="M8 15h5"/>',
  alert: '<path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/>',
};

const toneClass = (tone) => ({
  success: 'is-success',
  warning: 'is-warning',
  danger: 'is-danger',
  muted: 'is-muted',
  accent: 'is-accent',
}[tone] || 'is-default');

const renderIcon = (name) => `
  <span class="ml-icon" aria-hidden="true">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      ${iconMap[name] || iconMap.spark}
    </svg>
  </span>
`;

const button = ({ label, icon, action, kind = 'ghost', danger = false }) => `
  <button class="ml-btn ml-btn--${kind}${danger ? ' ml-btn--danger' : ''}" type="button" data-action="${action}">
    ${renderIcon(icon)}
    <span>${label}</span>
  </button>
`;

const renderDateCell = (value) => {
  if (!value || value === 'Sem dado') return '<span class="ml-date-cell ml-date-cell--empty">Sem dado</span>';
  const [datePart, timePart] = String(value).split(' • ');
  return `
    <span class="ml-date-cell">
      <strong>${datePart || 'Sem dado'}</strong>
      ${timePart ? `<small>${timePart}</small>` : ''}
    </span>
  `;
};

const DashboardHeader = () => `
  <header class="ml-header">
    <div class="ml-header__brand">
      <div class="ml-logo-shell">
        <img src="assets/img/logo.png" alt="Makerline" class="ml-logo" />
      </div>
      <div>
        <p class="ml-eyebrow">Makerline</p>
        <h1>Makerline Intelligence</h1>
        <p class="ml-subtitle">Central de retenção, onboarding e engajamento</p>
      </div>
    </div>
    <div class="ml-header__actions">
      ${button({ label: 'Voltar para o app', icon: 'back', action: 'back' })}
      ${button({ label: 'Importar usuários', icon: 'import', action: 'migrate-users' })}
      ${button({ label: 'Importar progresso', icon: 'import', action: 'migrate-states' })}
      ${button({ label: 'Exportar dados', icon: 'export', action: 'export' })}
      ${button({ label: 'Sair', icon: 'logout', action: 'logout', kind: 'ghost', danger: true })}
    </div>
  </header>
`;

const MetricCard = ({ icon, label, value, tone }) => `
  <article class="ml-metric-card ${toneClass(tone)}">
    <div class="ml-metric-card__head">
      ${renderIcon(icon)}
      <span>${label}</span>
    </div>
    <strong>${value}</strong>
  </article>
`;

const MetricsGrid = (stats) => {
  const rate7 = stats.total ? Math.round((stats.active7d / stats.total) * 100) : 0;
  const rate30 = stats.total ? Math.round((stats.active30d / stats.total) * 100) : 0;
  const inactiveRate = stats.total ? Math.round((stats.inactive / stats.total) * 100) : 0;

  const cards = [
    { icon: 'users', label: 'Total de usuários', value: stats.total, description: 'Base total monitorada', trend: 'flat', comparison: `${stats.newUsersWeek} novos na semana`, tone: 'accent' },
    { icon: 'spark', label: 'Novos usuários', value: stats.newUsersWeek, description: 'Cadastros recentes', trend: stats.newUsersWeek > 0 ? 'up' : 'flat', comparison: 'Últimos 7 dias', tone: 'accent' },
    { icon: 'activity', label: 'Ativos 7d', value: stats.active7d, description: `${rate7}% da base`, trend: rate7 >= 40 ? 'up' : 'flat', comparison: 'Recência operacional', tone: 'success' },
    { icon: 'activity', label: 'Ativos 30d', value: stats.active30d, description: `${rate30}% da base`, trend: rate30 >= 60 ? 'up' : 'flat', comparison: 'Retenção recente', tone: 'success' },
    { icon: 'inactive', label: 'Usuários inativos', value: stats.inactive, description: `${inactiveRate}% da base`, trend: stats.inactive > 0 ? 'down' : 'flat', comparison: 'Sem tração recente', tone: 'muted' },
    { icon: 'activity', label: 'Taxa de ativação', value: `${stats.activationRate}%`, description: 'Criaram pelo menos 1 campanha', trend: stats.activationRate >= 50 ? 'up' : 'flat', comparison: 'Base ativada', tone: 'success' },
    { icon: 'timeline', label: 'Tempo médio no app', value: formatDuration(stats.averageTime), description: 'Média por usuário', trend: stats.averageTime > 180 ? 'up' : 'flat', comparison: `${formatDuration(stats.averageTime * stats.total)} total`, tone: 'accent' },
    { icon: 'campaigns', label: 'Campanhas criadas', value: stats.campaignsCreated, description: 'Volume criado no produto', trend: stats.campaignsCreated > 0 ? 'up' : 'flat', comparison: 'Criação total', tone: 'accent' },
    { icon: 'campaigns', label: 'Campanhas ativas', value: stats.campaignsActive, description: 'Em execução agora', trend: stats.campaignsActive > 0 ? 'up' : 'flat', comparison: `${stats.campaignsCreated ? Math.round((stats.campaignsActive / stats.campaignsCreated) * 100) : 0}% das criadas`, tone: 'success' },
  ];

  return `
    <section class="ml-metrics-grid">
      ${cards.map(MetricCard).join('')}
    </section>
  `;
};

const ProgressBar = ({ score }) => `
  <div class="ml-healthbar" aria-label="Progresso ${score}">
    <div class="ml-healthbar__fill" style="width:${score}%"></div>
  </div>
`;

const UserFilters = (filters) => `
  <section class="ml-filter-bar">
    <label class="ml-field ml-field--search">
      <span>${renderIcon('search')}</span>
      <input type="search" placeholder="Buscar por nome ou e-mail" value="${filters.query || ''}" data-filter="query" />
    </label>
    <label class="ml-field">
      <span>Onboarding</span>
      <select data-filter="onboarding">
        <option value="all"${filters.onboarding === 'all' ? ' selected' : ''}>Todos</option>
        <option value="complete"${filters.onboarding === 'complete' ? ' selected' : ''}>Completo</option>
        <option value="incomplete"${filters.onboarding === 'incomplete' ? ' selected' : ''}>Incompleto</option>
      </select>
    </label>
    <label class="ml-field">
      <span>Ordenar por</span>
      <select data-filter="sort">
        <option value="last_activity"${filters.sort === 'last_activity' ? ' selected' : ''}>Última atividade</option>
        <option value="last_login"${filters.sort === 'last_login' ? ' selected' : ''}>Último login</option>
        <option value="accesses"${filters.sort === 'accesses' ? ' selected' : ''}>Acessos</option>
        <option value="time_total"${filters.sort === 'time_total' ? ' selected' : ''}>Tempo total</option>
        <option value="campaigns"${filters.sort === 'campaigns' ? ' selected' : ''}>Campanhas criadas</option>
        <option value="created_at"${filters.sort === 'created_at' ? ' selected' : ''}>Data de cadastro</option>
        <option value="onboarding"${filters.sort === 'onboarding' ? ' selected' : ''}>Onboarding</option>
      </select>
    </label>
  </section>
`;

const UserRow = (user) => `
  <tr data-user-id="${user.id}">
    <td>
      <button class="ml-user-cell" type="button" data-action="open-user" data-user-id="${user.id}">
        <span class="ml-avatar">${user.initials}</span>
        <span>
          <strong>${user.name || 'Usuário sem nome'}</strong>
          <small>${user.email}</small>
        </span>
      </button>
    </td>
    <td><span class="ml-badge ${user.referredBy ? 'is-accent' : 'is-muted'}">${user.referralOrigin || 'Direto / orgânico'}</span></td>
    <td>${renderDateCell(formatDate(user.createdAt))}</td>
    <td>${renderDateCell(formatDate(user.lastLoginAt))}</td>
    <td>${renderDateCell(formatDate(user.lastSeenAt))}</td>
    <td>${safeNumber(user.accesses7d)}</td>
    <td>${safeNumber(user.accesses30d)}</td>
    <td>${formatDuration(user.timeSpentSeconds)}</td>
    <td>
      <div class="ml-two-metrics">
        <span>Criadas <strong>${safeNumber(user.campaignCount)}</strong></span>
        <span>Ativas <strong>${safeNumber(user.activeCampaignCount)}</strong></span>
      </div>
    </td>
    <td>
      <div class="ml-score-cell">
        <strong>${user.onboardingProgress.percentage}%</strong>
        ${ProgressBar({ score: user.onboardingProgress.percentage })}
      </div>
    </td>
    <td><span class="ml-badge ${user.onboarding?.tutorialCompleted ? 'is-success' : 'is-muted'}">${user.onboarding?.tutorialCompleted ? 'Concluído' : 'Pendente'}</span></td>
    <td class="ml-col-actions">
      <div class="ml-row-actions">
        <button class="ml-icon-btn" type="button" data-action="open-user" data-user-id="${user.id}" title="Ver detalhes">${renderIcon('search')}</button>
        <button class="ml-icon-btn" type="button" data-action="copy-email" data-user-id="${user.id}" title="Copiar e-mail">${renderIcon('copy')}</button>
        <button class="ml-icon-btn ${user.markedForContact ? 'is-active' : ''}" type="button" data-action="mark-contact" data-user-id="${user.id}" title="Marcar para contato">${renderIcon('contact')}</button>
        <button class="ml-icon-btn" type="button" data-action="reset-password" data-user-id="${user.id}" title="Redefinir senha">${renderIcon('key')}</button>
        <button class="ml-icon-btn is-danger" type="button" data-action="delete-user" data-user-id="${user.id}" title="Excluir usuário">${renderIcon('delete')}</button>
      </div>
    </td>
  </tr>
`;

const UserCard = (user) => `
  <article class="ml-user-card" data-user-id="${user.id}">
    <div class="ml-user-card__top">
      <button class="ml-user-cell" type="button" data-action="open-user" data-user-id="${user.id}">
        <span class="ml-avatar">${user.initials}</span>
        <span>
          <strong>${user.name || 'Usuário sem nome'}</strong>
          <small>${user.email}</small>
        </span>
      </button>
    </div>
    <div class="ml-user-card__metrics">
      <div><span>Cadastro</span><strong>${formatShortDate(user.createdAt)}</strong></div>
      <div><span>Origem</span><strong>${user.referralOrigin || 'Direto / orgânico'}</strong></div>
      <div><span>Último login</span><strong>${formatShortDate(user.lastLoginAt)}</strong></div>
      <div><span>Campanhas</span><strong>${user.campaignCount}/${user.activeCampaignCount}</strong></div>
      <div><span>Onboarding</span><strong>${user.onboardingProgress.percentage}%</strong></div>
      <div><span>Tutorial</span><strong>${user.onboarding?.tutorialCompleted ? 'Concluído' : 'Pendente'}</strong></div>
    </div>
    <div class="ml-user-card__actions">
      <button class="ml-btn ml-btn--primary" type="button" data-action="open-user" data-user-id="${user.id}">Ver detalhes</button>
      <button class="ml-btn ml-btn--ghost" type="button" data-action="copy-email" data-user-id="${user.id}">Copiar e-mail</button>
      <button class="ml-btn ml-btn--ghost" type="button" data-action="mark-contact" data-user-id="${user.id}">Marcar contato</button>
      <button class="ml-btn ml-btn--ghost" type="button" data-action="reset-password" data-user-id="${user.id}">Redefinir senha</button>
      <button class="ml-btn ml-btn--danger" type="button" data-action="delete-user" data-user-id="${user.id}">Excluir usuário</button>
    </div>
  </article>
`;

const EmptyState = ({ icon = 'empty', title, text, actionLabel = '', action = '' }) => `
  <div class="ml-empty-state">
    ${renderIcon(icon)}
    <h3>${title}</h3>
    <p>${text}</p>
    ${actionLabel && action ? `<button class="ml-btn ml-btn--ghost" type="button" data-action="${action}">${actionLabel}</button>` : ''}
  </div>
`;

const UsersTable = (users) => {
  if (!users.length) {
    return EmptyState({
      icon: 'search',
      title: 'Nenhum resultado com os filtros atuais',
      text: 'Ajuste os filtros ou limpe a busca para voltar a enxergar a base.',
      actionLabel: 'Limpar filtros',
      action: 'reset-filters',
    });
  }

  return `
    <div class="ml-table-desktop">
      <table class="ml-table">
        <thead>
          <tr>
            <th>Usuário</th>
            <th>Origem</th>
            <th>Cadastro</th>
            <th>Último login</th>
            <th>Última atividade</th>
            <th>Acessos 7d</th>
            <th>Acessos 30d</th>
            <th>Tempo total</th>
            <th>Campanhas</th>
            <th>Onboarding</th>
            <th>Tutorial</th>
            <th class="ml-col-actions">Ações</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(UserRow).join('')}
        </tbody>
      </table>
    </div>
    <div class="ml-table-mobile">
      ${users.map(UserCard).join('')}
    </div>
  `;
};

const UserMetricsCards = (user) => `
  <div class="ml-detail-metrics ml-detail-metrics--dense">
    ${[
      ['Data de cadastro', formatDate(user.createdAt)],
      ['Origem', user.referralOrigin || 'Direto / orgânico'],
      ['Último login', formatDate(user.lastLoginAt)],
      ['Última atividade', formatDate(user.lastSeenAt)],
      ['Acessos 7 dias', safeNumber(user.accesses7d)],
      ['Acessos 30 dias', safeNumber(user.accesses30d)],
      ['Tempo total', formatDuration(user.timeSpentSeconds)],
      ['Tempo médio por sessão', formatDuration(user.averageSessionSeconds)],
    ].map(([label, value]) => `
      <article class="ml-detail-metric-card">
        <span>${label}</span>
        <strong>${value}</strong>
      </article>
    `).join('')}
  </div>
`;

const DetailSection = ({ eyebrow = '', title, description = '', content, compact = false }) => `
  <section class="ml-detail-block${compact ? ' ml-detail-block--compact' : ''}">
    <div class="ml-detail-block__header">
      ${eyebrow ? `<p class="ml-detail-block__eyebrow">${eyebrow}</p>` : ''}
      <div class="ml-block-head">
        <div>
          <h3>${title}</h3>
          ${description ? `<p class="ml-detail-block__description">${description}</p>` : ''}
        </div>
      </div>
    </div>
    ${content}
  </section>
`;

const OnboardingChecklist = (user) => `
  ${DetailSection({
    eyebrow: 'Ativação',
    title: 'Onboarding',
    description: `Etapa atual: ${user.onboardingProgress.stalledAt}`,
    content: `
      <div class="ml-onboarding-hero">
        <div class="ml-onboarding-hero__value">
          <strong>${user.onboardingProgress.percentage}%</strong>
          <span>progresso concluído</span>
        </div>
        <div class="ml-onboarding-hero__bar">
          ${ProgressBar({ score: user.onboardingProgress.percentage })}
        </div>
      </div>
      <div class="ml-checklist">
        ${user.onboardingProgress.steps.map((step) => `
          <article class="ml-check-item ${step.completed ? 'is-complete' : ''}">
            <span class="ml-check-bullet"></span>
            <div>
              <strong>${step.label}</strong>
              <small>${step.completed ? (step.completedAt ? formatDate(step.completedAt) : 'Concluído') : 'Pendente'}</small>
            </div>
          </article>
        `).join('')}
      </div>
    `,
  })}
`;

const ActivityTimeline = (events) => {
  if (!events.length) {
    return EmptyState({
      icon: 'timeline',
      title: 'Nenhuma atividade registrada',
      text: 'Esse usuário ainda não gerou sinais suficientes para uma timeline útil.',
    });
  }

  return `
    ${DetailSection({
      eyebrow: 'Histórico',
      title: 'Timeline de atividades',
      description: 'Eventos que ajudam a entender o uso recente da conta.',
      content: `
        <div class="ml-timeline">
          ${events.map((event) => `
            <article class="ml-timeline-item ${toneClass(event.tone)}">
              <span class="ml-timeline-dot"></span>
              <div>
                <div class="ml-timeline-item__top">
                  <strong>${event.title}</strong>
                  <small>${formatDate(event.date)}</small>
                </div>
                <p>${event.description}</p>
              </div>
            </article>
          `).join('')}
        </div>
      `,
    })}
  `;
};

const UserDetailsPanel = (user) => {
  if (!user) {
    return `
      <div class="ml-detail-shell">
        ${EmptyState({
          icon: 'users',
          title: 'Selecione um usuário',
          text: 'Abra um usuário para ver dados de uso, onboarding e histórico recente.',
        })}
      </div>
    `;
  }

  return `
    <div class="ml-detail-shell">
      <header class="ml-detail-header">
        <div class="ml-detail-header__identity">
          <span class="ml-avatar ml-avatar--large">${user.initials}</span>
          <div class="ml-detail-header__identity-copy">
            <p class="ml-kicker">Usuário selecionado</p>
            <strong>${user.name || 'Usuário sem nome'}</strong>
            <small>${user.email}</small>
          </div>
        </div>
        <div class="ml-detail-header__meta">
          <div class="ml-detail-header__summary">
            <article>
              <span>Onboarding</span>
              <strong>${user.onboardingProgress.percentage}%</strong>
              <small>${user.onboardingProgress.stalledAt}</small>
            </article>
            <article>
              <span>Campanhas ativas</span>
              <strong>${user.activeCampaignCount}</strong>
              <small>${user.campaignCount} criada(s)</small>
            </article>
          </div>
        </div>
      </header>

      <div class="ml-detail-layout">
        ${DetailSection({
          eyebrow: 'Visão geral',
          title: 'Resumo rápido',
          description: 'Os sinais principais desse usuário em uma leitura só.',
          content: `
            <div class="ml-diagnostic-grid">
              <article><span>Cadastro</span><strong>${formatDate(user.createdAt)}</strong></article>
              <article><span>Origem</span><strong>${user.referralOrigin || 'Direto / orgânico'}</strong></article>
              <article><span>Último login</span><strong>${formatDate(user.lastLoginAt)}</strong></article>
              <article><span>Última atividade</span><strong>${formatDate(user.lastSeenAt)}</strong></article>
              <article><span>Etapa atual</span><strong>${user.onboardingProgress.stalledAt}</strong></article>
            </div>
          `,
        })}

        ${DetailSection({
          eyebrow: 'Uso e retenção',
          title: 'Métricas do usuário',
          description: 'Atividade, frequência e tempo acumulado no produto.',
          content: UserMetricsCards(user),
        })}
      </div>

      <div class="ml-detail-layout ml-detail-layout--split">
        ${DetailSection({
          eyebrow: 'Adoção do produto',
          title: 'Campanhas',
          description: 'Volume criado e execução atual.',
          compact: true,
          content: `
            <div class="ml-detail-metrics ml-detail-metrics--campaigns">
              <article class="ml-detail-metric-card"><span>Criadas</span><strong>${user.campaignCount}</strong></article>
              <article class="ml-detail-metric-card"><span>Ativas</span><strong>${user.activeCampaignCount}</strong></article>
              <article class="ml-detail-metric-card"><span>Taxa de ativação</span><strong>${user.campaignCount ? Math.round((user.activeCampaignCount / user.campaignCount) * 100) : 0}%</strong></article>
            </div>
          `,
        })}
        ${OnboardingChecklist(user)}
        ${ActivityTimeline(user.timeline)}
      </div>
    </div>
  `;
};

const CriticalUsersSection = (users) => {
  if (!users.length) {
    return EmptyState({
      icon: 'alert',
      title: 'Nenhum usuário exigindo ação agora',
      text: 'A base está estável no momento. Use os filtros para investigar grupos específicos.',
    });
  }

  return `
    <section class="ml-critical-section" id="critical-users">
      <div class="ml-section-head">
        <div>
          <p class="ml-kicker">Usuários que precisam de ação</p>
          <h2>Fila operacional prioritária</h2>
        </div>
      </div>
      <div class="ml-critical-list">
        ${users.map((user) => `
          <article class="ml-critical-card">
            <div class="ml-critical-card__head">
              <div>
                <strong>${user.name || 'Usuário sem nome'}</strong>
                <small>${user.email}</small>
              </div>
              <span class="ml-badge ${user.markedForContact ? 'is-accent' : 'is-warning'}">${user.markedForContact ? 'Contato marcado' : 'Atenção'}</span>
            </div>
            <div class="ml-critical-card__body">
              <p>${user.churn.reasons[0] || user.onboardingProgress.stalledAt || 'Revisar atividade recente.'}</p>
              <div class="ml-critical-card__details">
                <span>Onboarding <strong>${user.onboardingProgress.percentage}%</strong></span>
                <span>Último login <strong>${formatShortDate(user.lastLoginAt)}</strong></span>
                <span>Campanhas <strong>${user.activeCampaignCount}/${user.campaignCount}</strong></span>
              </div>
            </div>
            <div class="ml-critical-card__actions">
              <button class="ml-btn ml-btn--primary" type="button" data-action="open-user" data-user-id="${user.id}">Ver detalhes</button>
            </div>
          </article>
        `).join('')}
      </div>
    </section>
  `;
};

const createLinePath = (series, width, height, padding) => {
  if (!series.length) return '';
  const values = series.map((item) => item.value);
  const max = Math.max(...values, 1);
  return series.map((item, index) => {
    const x = padding + (index / Math.max(series.length - 1, 1)) * (width - padding * 2);
    const y = height - padding - (item.value / max) * (height - padding * 2);
    return `${index === 0 ? 'M' : 'L'}${x} ${y}`;
  }).join(' ');
};

const renderLineChart = (series, label) => {
  if (!series.length || series.every((item) => item.value === 0)) {
    return EmptyState({
      icon: 'timeline',
      title: 'Nenhum dado suficiente',
      text: `Ainda não há sinais para ${label.toLowerCase()}.`,
    });
  }

  const width = 520;
  const height = 220;
  const padding = 22;
  const max = Math.max(...series.map((item) => item.value), 1);
  const path = createLinePath(series, width, height, padding);
  const tickIndexes = Array.from(new Set([
    0,
    Math.round((series.length - 1) * 0.25),
    Math.round((series.length - 1) * 0.5),
    Math.round((series.length - 1) * 0.75),
    series.length - 1,
  ])).filter((index) => index >= 0 && index < series.length);

  return `
    <svg viewBox="0 0 ${width} ${height}" class="ml-chart-svg" role="img" aria-label="${label}">
      ${[0, 1, 2, 3].map((step) => {
        const y = padding + ((height - padding * 2) / 3) * step;
        return `<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" class="ml-chart-grid-line"></line>`;
      }).join('')}
      <path d="${path}" class="ml-chart-line"></path>
      ${series.map((item, index) => {
        const x = padding + (index / Math.max(series.length - 1, 1)) * (width - padding * 2);
        const y = height - padding - (item.value / max) * (height - padding * 2);
        return `<circle cx="${x}" cy="${y}" r="3.5" class="ml-chart-point"><title>${item.label}: ${item.value}</title></circle>`;
      }).join('')}
      ${tickIndexes.map((index) => {
        const item = series[index];
        const x = padding + (index / Math.max(series.length - 1, 1)) * (width - padding * 2);
        return `<text x="${x}" y="${height - 6}" class="ml-chart-label">${item.label}</text>`;
      }).join('')}
    </svg>
  `;
};

const renderBars = (items) => {
  if (!items.length || items.every((item) => item.value === 0)) {
    return EmptyState({
      icon: 'activity',
      title: 'Nenhum dado suficiente',
      text: 'Esses indicadores ainda não têm volume suficiente para comparação visual.',
    });
  }

  const max = Math.max(...items.map((item) => item.value), 1);
  return `
    <div class="ml-bars">
      ${items.map((item) => `
        <article class="ml-bar-item">
          <div class="ml-bar-item__meta">
            <span>${item.label}</span>
            <strong>${item.value}</strong>
          </div>
          <div class="ml-bar-track">
            <div class="ml-bar-fill ml-bar-fill--${item.key || 'accent'}" style="width:${(item.value / max) * 100}%"></div>
          </div>
        </article>
      `).join('')}
    </div>
  `;
};

const DashboardCharts = (charts) => `
  <section class="ml-chart-grid">
    <article class="ml-chart-card">
      <div class="ml-block-head"><h3>Evolução de usuários ativos nos últimos 30 dias</h3></div>
      ${renderLineChart(charts.activeSeries, 'evolução de usuários ativos')}
    </article>
    <article class="ml-chart-card">
      <div class="ml-block-head"><h3>Funil de onboarding</h3></div>
      ${renderBars(charts.onboardingFunnel)}
    </article>
    <article class="ml-chart-card">
      <div class="ml-block-head"><h3>Campanhas criadas versus ativas</h3></div>
      ${renderBars(charts.campaignComparison)}
    </article>
  </section>
`;

const LoadingSkeleton = () => `
  <div class="ml-skeleton-shell">
    <div class="ml-skeleton-grid">
      ${Array.from({ length: 6 }).map(() => '<div class="ml-skeleton ml-skeleton--card"></div>').join('')}
    </div>
    <div class="ml-skeleton ml-skeleton--table"></div>
  </div>
`;

export {
  ActivityTimeline,
  CriticalUsersSection,
  DashboardCharts,
  DashboardHeader,
  EmptyState,
  LoadingSkeleton,
  MetricsGrid,
  UserDetailsPanel,
  UserFilters,
  UsersTable,
};

