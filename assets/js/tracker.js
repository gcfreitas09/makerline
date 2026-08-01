(() => {
  const AUTH_SESSION_KEY = 'makerlineLandingInsightsAuth';
  const AUTH_LOCAL_KEY = 'makerlineLandingInsightsAuthPersistent';

  const VIEWS = {
    application: {
      label: 'Aplicativo',
      subtitle: 'Usuários, ativação e engajamento no produto.',
      src: 'intelligence.html?embed=1',
      icon:
        '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></svg>',
    },
    landing: {
      label: 'Landing Page',
      subtitle: 'Views, conversão para o app e origem de quem chega até a lançamento.',
      native: true,
      icon:
        '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l18-7-7 18-3-8-8-3z"/></svg>',
    },
    commissions: {
      label: 'Comissões',
      subtitle: 'Quem entrou pelo link de parceiro, o plano assinado e a comissão gerada.',
      native: true,
      icon:
        '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5c0-1.4 1.2-2.5 2.7-2.5s2.7.9 2.7 2.1c0 2.6-5.4 1.6-5.4 4.3 0 1.3 1.2 2.1 2.7 2.1s2.7-1.1 2.7-2.5"/></svg>',
    },
  };

  const PERIODS = [
    { id: 'today', label: 'Hoje' },
    { id: '7d', label: '7 dias' },
    { id: '14d', label: '14 dias' },
    { id: '30d', label: '30 dias' },
    { id: 'all', label: 'Tudo' },
  ];

  const root = document.getElementById('tracker-root');

  const state = {
    auth: null,
    view: 'application',
    submitting: false,
    error: '',
    frameLoading: true,
    lancamento: {
      loading: false,
      error: '',
      period: '30d',
      data: null,
      requestId: 0,
    },
    commissions: {
      loading: false,
      error: '',
      partnerFilter: 'all',
      data: null,
    },
  };

  const getFromStorage = (key) => {
    try {
      return sessionStorage.getItem(key) || '';
    } catch (error) {
      return '';
    }
  };

  const setInStorage = (key, value) => {
    try {
      sessionStorage.setItem(key, value);
    } catch (error) {}
  };

  const removeFromStorage = (key) => {
    try {
      sessionStorage.removeItem(key);
    } catch (error) {}
  };

  const getFromLocal = (key) => {
    try {
      return localStorage.getItem(key) || '';
    } catch (error) {
      return '';
    }
  };

  const setInLocal = (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (error) {}
  };

  const removeFromLocal = (key) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {}
  };

  const parseSavedAuth = (raw) => {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      const expiresAt = parsed?.expiresAt ? new Date(parsed.expiresAt).getTime() : 0;
      if (!parsed?.token || !parsed?.email || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
      return parsed;
    } catch (error) {
      return null;
    }
  };

  const clearAuth = () => {
    removeFromStorage(AUTH_SESSION_KEY);
    removeFromLocal(AUTH_LOCAL_KEY);
  };

  const readSavedAuth = () => {
    const sessionAuth = parseSavedAuth(getFromStorage(AUTH_SESSION_KEY));
    if (sessionAuth) return sessionAuth;

    const localAuth = parseSavedAuth(getFromLocal(AUTH_LOCAL_KEY));
    if (localAuth) {
      // Espelha na sessionStorage pra manter o resto do app (que só olha a sessionStorage) funcionando.
      setInStorage(AUTH_SESSION_KEY, JSON.stringify(localAuth));
      return localAuth;
    }

    clearAuth();
    return null;
  };

  const saveAuth = (payload, remember = false) => {
    const safePayload = {
      token: String(payload?.token || '').trim(),
      email: String(payload?.user?.email || '').trim().toLowerCase(),
      name: String(payload?.user?.name || '').trim(),
      expiresAt: String(payload?.expiresAt || '').trim(),
      remember: Boolean(remember),
    };

    if (!safePayload.token || !safePayload.email || !safePayload.expiresAt) return false;

    clearAuth();
    const raw = JSON.stringify(safePayload);
    setInStorage(AUTH_SESSION_KEY, raw);
    if (remember) {
      setInLocal(AUTH_LOCAL_KEY, raw);
    }
    return true;
  };

  const getRequestedView = () => {
    const params = new URLSearchParams(window.location.search);
    const view = String(params.get('view') || '').toLowerCase();
    return Object.prototype.hasOwnProperty.call(VIEWS, view) ? view : 'application';
  };

  const updateUrlView = (view) => {
    const url = new URL(window.location.href);
    url.searchParams.set('view', view);
    window.history.replaceState({ trackerView: view }, '', url);
  };

  const escapeHtml = (value) =>
    String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));

  const formatNumber = (value) => {
    const safe = Number.isFinite(value) ? value : 0;
    return safe.toLocaleString('pt-BR');
  };

  const formatPercent = (value) => {
    const safe = Number.isFinite(value) ? value : 0;
    return `${safe.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  };

  const formatCurrencyCents = (cents) => {
    const safe = Number.isFinite(cents) ? cents / 100 : 0;
    return safe.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('pt-BR');
  };

  const BILLING_STATUS_LABELS = {
    free: 'Sem plano / teste',
    trialing: 'Em teste',
    active: 'Ativo',
    past_due: 'Pagamento atrasado',
    canceled: 'Cancelado',
    unpaid: 'Sem pagamento',
  };

  const renderLogin = () => {
    root.innerHTML = `
      <div class="tracker-login-screen">
        <form class="tracker-login-card" id="tracker-login-form">
          <div class="tracker-login-brand">
            <img src="assets/img/logo.png" alt="" />
            <span>
              <strong>Tracker Makerline</strong>
              <small>Dados do produto e da conversão em um só lugar</small>
            </span>
          </div>
          <p class="tracker-kicker">Tracker privado</p>
          <h1>Entrar</h1>
          <p class="tracker-login-copy">Acesso restrito aos sócios autorizados. Uma única conta libera os dados do aplicativo e da landing page.</p>
          <label class="tracker-field">
            <span>E-mail</span>
            <input type="email" id="tracker-login-email" autocomplete="username" placeholder="voce@email.com" required />
          </label>
          <label class="tracker-field">
            <span>Senha</span>
            <input type="password" id="tracker-login-password" autocomplete="current-password" placeholder="Sua senha" required />
          </label>
          <label class="tracker-remember">
            <input type="checkbox" id="tracker-login-remember" />
            <span>Manter sessão mais tempo neste dispositivo</span>
          </label>
          <button type="submit" class="tracker-btn" id="tracker-login-submit" ${state.submitting ? 'disabled' : ''}>
            ${state.submitting ? 'Entrando...' : 'Entrar no tracker'}
          </button>
          <div class="tracker-message is-error ${state.error ? '' : 'is-hidden'}">${escapeHtml(state.error)}</div>
        </form>
      </div>
    `;

    const form = document.getElementById('tracker-login-form');
    form?.addEventListener('submit', handleLoginSubmit);
  };

  const renderLancamentoStage = () => {
    const { loading, error, period, data } = state.lancamento;

    const periodPills = PERIODS.map(
      (option) => `
        <button type="button" class="tracker-pill ${option.id === period ? 'is-active' : ''}" data-tracker-period="${option.id}">
          ${escapeHtml(option.label)}
        </button>
      `
    ).join('');

    if (loading && !data) {
      return `
        <div class="tracker-lp">
          <div class="tracker-pills">${periodPills}</div>
          <div class="tracker-lp-loading">
            <div class="tracker-spinner"></div>
            <span>Carregando dados da lançamento...</span>
          </div>
        </div>
      `;
    }

    if (error && !data) {
      return `
        <div class="tracker-lp">
          <div class="tracker-pills">${periodPills}</div>
          <div class="tracker-message is-error">${escapeHtml(error)}</div>
        </div>
      `;
    }

    if (!data) return `<div class="tracker-lp"><div class="tracker-pills">${periodPills}</div></div>`;

    const views = data.views || {};
    const conversion = data.conversion || {};
    const origins = Array.isArray(data.origins) ? data.origins : [];
    const byCta = Array.isArray(conversion.byCta) ? conversion.byCta : [];

    const viewsDelta = views.previousTotal > 0
      ? Math.round(((views.total - views.previousTotal) / views.previousTotal) * 1000) / 10
      : null;

    const originRows = origins.length
      ? origins
          .map(
            (origin) => `
              <tr>
                <td>${escapeHtml(origin.label)}</td>
                <td>${formatNumber(origin.views)}</td>
                <td>${formatNumber(origin.conversions)}</td>
                <td>${formatPercent(origin.conversionRate)}</td>
              </tr>
            `
          )
          .join('')
      : `<tr><td colspan="4" class="tracker-lp-empty">Sem visitas registradas nesse período.</td></tr>`;

    const ctaRows = byCta.length
      ? byCta
          .map(
            (cta) => `
              <li>
                <span>${escapeHtml(cta.label || cta.ctaId)}</span>
                <strong>${formatNumber(cta.clicks)}</strong>
              </li>
            `
          )
          .join('')
      : `<li class="tracker-lp-empty">Nenhum clique para o app registrado ainda.</li>`;

    const lastUpdatedLabel = data.meta?.generatedAt
      ? new Date(data.meta.generatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : '';

    return `
      <div class="tracker-lp">
        <div class="tracker-lp-toolbar">
          <div class="tracker-pills">${periodPills}</div>
          <div class="tracker-lp-refresh">
            ${lastUpdatedLabel ? `<span>Atualizado às ${lastUpdatedLabel}</span>` : ''}
            <button type="button" class="tracker-btn-refresh" id="tracker-lp-refresh" ${loading ? 'disabled' : ''} title="Atualizar agora">
              <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${loading ? 'is-spinning' : ''}"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/></svg>
              Atualizar
            </button>
          </div>
        </div>

        <div class="tracker-lp-cards">
          <div class="tracker-lp-card">
            <span>Views</span>
            <strong>${formatNumber(views.total)}</strong>
            <small>${formatNumber(views.uniqueVisitors)} visitantes únicos${viewsDelta !== null ? ` · ${viewsDelta >= 0 ? '+' : ''}${viewsDelta}% vs. período anterior` : ''}</small>
          </div>
          <div class="tracker-lp-card">
            <span>Conversão para o app</span>
            <strong>${formatPercent(conversion.rate)}</strong>
            <small>${formatNumber(conversion.convertedSessions)} sessões clicaram para entrar no app</small>
          </div>
          <div class="tracker-lp-card">
            <span>Origens identificadas</span>
            <strong>${formatNumber(origins.length)}</strong>
            <small>Canais, parceiros e UTMs distintos nesse período</small>
          </div>
        </div>

        <div class="tracker-lp-grid">
          <div class="tracker-lp-panel">
            <h2>Origem de quem visita</h2>
            <div class="tracker-lp-table-wrap">
              <table class="tracker-lp-table">
                <thead>
                  <tr>
                    <th>Origem</th>
                    <th>Views</th>
                    <th>Conversões</th>
                    <th>Taxa</th>
                  </tr>
                </thead>
                <tbody>${originRows}</tbody>
              </table>
            </div>
          </div>
          <div class="tracker-lp-panel">
            <h2>Cliques para o app por botão</h2>
            <ul class="tracker-lp-cta-list">${ctaRows}</ul>
          </div>
        </div>
      </div>
    `;
  };

  const renderCommissionsStage = () => {
    const { loading, error, data, partnerFilter } = state.commissions;

    if (loading && !data) {
      return `
        <div class="tracker-lp">
          <div class="tracker-lp-loading">
            <div class="tracker-spinner"></div>
            <span>Carregando comissões...</span>
          </div>
        </div>
      `;
    }

    if (error && !data) {
      return `<div class="tracker-lp"><div class="tracker-message is-error">${escapeHtml(error)}</div></div>`;
    }

    if (!data) return `<div class="tracker-lp"></div>`;

    const partners = Array.isArray(data.partners) ? data.partners : [];
    const allRows = Array.isArray(data.rows) ? data.rows : [];
    const totals = data.totals || {};

    const rows = partnerFilter === 'all' ? allRows : allRows.filter((row) => row.partnerCode === partnerFilter);

    const filteredTotalCents = rows.reduce((sum, row) => sum + (Number(row.commissionTotalCents) || 0), 0);
    const filteredPayingCount = rows.filter((row) => row.hasPaid).length;

    const partnerOptions = [`<option value="all" ${partnerFilter === 'all' ? 'selected' : ''}>Todos os parceiros</option>`]
      .concat(
        partners.map(
          (partner) =>
            `<option value="${escapeHtml(partner.code)}" ${partnerFilter === partner.code ? 'selected' : ''}>${escapeHtml(partner.name)} (${partner.commissionPercent}%)</option>`
        )
      )
      .join('');

    const tableRows = rows.length
      ? rows
          .map(
            (row) => `
              <tr>
                <td>
                  <strong>${escapeHtml(row.name)}</strong>
                  <small>${escapeHtml(row.email)}</small>
                </td>
                <td>
                  ${escapeHtml(row.partnerName)}
                  ${row.linkVariant ? `<small>Link de ${escapeHtml(row.linkVariant)}</small>` : ''}
                </td>
                <td>${formatDate(row.createdAt)}</td>
                <td>
                  <span class="tracker-badge ${row.hasPaid ? 'is-good' : 'is-muted'}">
                    ${escapeHtml(row.planLabel || BILLING_STATUS_LABELS[row.billingStatus] || row.billingStatus || 'Sem plano')}
                  </span>
                </td>
                <td class="tracker-lp-table-num">${row.hasPaid ? formatCurrencyCents(row.commissionTotalCents) : '—'}</td>
              </tr>
            `
          )
          .join('')
      : `<tr><td colspan="5" class="tracker-lp-empty">Nenhum usuário encontrado pra esse filtro.</td></tr>`;

    return `
      <div class="tracker-lp">
        <div class="tracker-lp-cards">
          <div class="tracker-lp-card">
            <span>Cadastros por parceiro</span>
            <strong>${formatNumber(rows.length)}</strong>
            <small>${formatNumber(totals.referredUsersCount || 0)} no total, todos os parceiros</small>
          </div>
          <div class="tracker-lp-card">
            <span>Assinantes pagantes</span>
            <strong>${formatNumber(filteredPayingCount)}</strong>
            <small>Cadastros que já geraram comissão</small>
          </div>
          <div class="tracker-lp-card">
            <span>Total em comissões</span>
            <strong>${formatCurrencyCents(filteredTotalCents)}</strong>
            <small>Somando todas as faturas pagas já registradas</small>
          </div>
        </div>

        <div class="tracker-lp-panel">
          <div class="tracker-lp-panel-head">
            <h2>Usuários vindos de parceiros</h2>
            <select class="tracker-select" id="tracker-commissions-partner-filter">${partnerOptions}</select>
          </div>
          <div class="tracker-lp-table-wrap">
            <table class="tracker-lp-table">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Parceiro</th>
                  <th>Cadastro</th>
                  <th>Plano</th>
                  <th class="tracker-lp-table-num">Comissão</th>
                </tr>
              </thead>
              <tbody>${tableRows}</tbody>
              <tfoot>
                <tr>
                  <td colspan="4">Total (${partnerFilter === 'all' ? 'todos os parceiros' : escapeHtml(rows[0]?.partnerName || '')})</td>
                  <td class="tracker-lp-table-num"><strong>${formatCurrencyCents(filteredTotalCents)}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    `;
  };

  const renderShell = () => {
    const railButtons = Object.entries(VIEWS)
      .map(
        ([id, config]) => `
          <button type="button" class="tracker-rail-btn ${state.view === id ? 'is-active' : ''}" data-tracker-view="${id}" aria-pressed="${state.view === id ? 'true' : 'false'}">
            ${config.icon}
            <span>${escapeHtml(config.label)}</span>
          </button>
        `
      )
      .join('');

    const activeConfig = VIEWS[state.view];
    const isNative = Boolean(activeConfig.native);

    root.innerHTML = `
      <div class="tracker-shell">
        <aside class="tracker-rail">
          <div class="tracker-rail-logo"><img src="assets/img/logo.png" alt="" /></div>
          <nav class="tracker-rail-nav" aria-label="Escolher origem dos dados">
            ${railButtons}
          </nav>
          <div class="tracker-rail-spacer"></div>
          <button type="button" class="tracker-rail-logout" id="tracker-logout-btn" title="Sair" aria-label="Sair">
            <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </aside>

        <div class="tracker-main">
          <header class="tracker-topbar">
            <div class="tracker-topbar-title">
              <strong>${escapeHtml(activeConfig.label)}</strong>
              <small>${escapeHtml(activeConfig.subtitle)}</small>
            </div>
            <div class="tracker-topbar-user">${escapeHtml(state.auth?.name || state.auth?.email || '')}</div>
          </header>
          <div class="tracker-stage ${isNative ? 'tracker-stage--native' : ''}">
            ${
              isNative
                ? state.view === 'commissions'
                  ? renderCommissionsStage()
                  : renderLancamentoStage()
                : `
                  <div class="tracker-frame-status ${state.frameLoading ? '' : 'is-hidden'}" id="tracker-frame-status" role="status">
                    <div class="tracker-spinner"></div>
                    <span>Carregando ${activeConfig.label.toLowerCase()}...</span>
                  </div>
                  <iframe
                    id="tracker-frame"
                    class="tracker-frame"
                    title="Painel do tracker Makerline — ${escapeHtml(activeConfig.label)}"
                    src="${activeConfig.src}"
                  ></iframe>
                `
            }
          </div>
        </div>
      </div>
    `;

    document.querySelectorAll('[data-tracker-view]').forEach((button) => {
      button.addEventListener('click', () => selectView(button.dataset.trackerView));
    });

    document.getElementById('tracker-logout-btn')?.addEventListener('click', handleLogout);

    if (isNative && state.view === 'commissions') {
      document.getElementById('tracker-commissions-partner-filter')?.addEventListener('change', (event) => {
        state.commissions.partnerFilter = event.target.value;
        render();
      });
      if (!state.commissions.data && !state.commissions.loading) {
        loadCommissionsData();
      }
      return;
    }

    if (isNative) {
      document.querySelectorAll('[data-tracker-period]').forEach((button) => {
        button.addEventListener('click', () => selectPeriod(button.dataset.trackerPeriod));
      });
      document.getElementById('tracker-lp-refresh')?.addEventListener('click', () => {
        if (!state.lancamento.loading) loadLancamentoData();
      });
      if (!state.lancamento.data && !state.lancamento.loading) {
        loadLancamentoData();
      }
      return;
    }

    const frame = document.getElementById('tracker-frame');
    frame?.addEventListener('load', () => {
      state.frameLoading = false;
      document.getElementById('tracker-frame-status')?.classList.add('is-hidden');
    });
  };

  const render = () => {
    if (!state.auth) {
      renderLogin();
      return;
    }
    renderShell();
  };

  const selectView = (view) => {
    const safeView = Object.prototype.hasOwnProperty.call(VIEWS, view) ? view : 'application';
    if (safeView === state.view) return;
    state.view = safeView;
    state.frameLoading = true;
    updateUrlView(safeView);
    render();
  };

  const selectPeriod = (period) => {
    const safePeriod = PERIODS.some((option) => option.id === period) ? period : '30d';
    if (safePeriod === state.lancamento.period) return;
    state.lancamento.period = safePeriod;
    loadLancamentoData();
  };

  const readApiResponse = async (response) => {
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (error) {
      data = null;
    }
    return { data, text };
  };

  const loadLancamentoData = async () => {
    if (!state.auth?.token) return;

    // Cada chamada ganha um id proprio. Se o usuario trocar de filtro antes da resposta
    // chegar, uma nova chamada sobe o id, e a resposta antiga (por mais que chegue depois)
    // e ignorada -- evita que uma resposta lenta de um filtro velho sobrescreva o novo.
    const requestId = ++state.lancamento.requestId;
    const requestedPeriod = state.lancamento.period;

    state.lancamento.loading = true;
    state.lancamento.error = '';
    render();

    try {
      const response = await fetch('api/tracker_lancamento.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: state.auth.token, period: requestedPeriod }),
      });

      const { data, text } = await readApiResponse(response);
      if (requestId !== state.lancamento.requestId) return;

      if (response.status === 401 || response.status === 403) {
        clearAuth();
        state.auth = null;
        state.lancamento.loading = false;
        state.lancamento.data = null;
        render();
        return;
      }

      if (!response.ok || !data || data.ok !== true) {
        state.lancamento.loading = false;
        state.lancamento.error =
          (data && data.error) ||
          (text ? `Erro ao carregar dados: ${text}` : `Erro ao carregar dados (HTTP ${response.status || 0}).`);
        render();
        return;
      }

      state.lancamento.loading = false;
      state.lancamento.error = '';
      state.lancamento.data = data;
      render();
    } catch (error) {
      if (requestId !== state.lancamento.requestId) return;
      state.lancamento.loading = false;
      state.lancamento.error = 'Não consegui carregar os dados da lançamento agora.';
      render();
    }
  };

  const loadCommissionsData = async () => {
    if (!state.auth?.token) return;

    state.commissions.loading = true;
    state.commissions.error = '';
    render();

    try {
      const response = await fetch('api/tracker_commissions.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: state.auth.token }),
      });

      const { data, text } = await readApiResponse(response);

      if (response.status === 401 || response.status === 403) {
        clearAuth();
        state.auth = null;
        state.commissions.loading = false;
        state.commissions.data = null;
        render();
        return;
      }

      if (!response.ok || !data || data.ok !== true) {
        state.commissions.loading = false;
        state.commissions.error =
          (data && data.error) ||
          (text ? `Erro ao carregar comissões: ${text}` : `Erro ao carregar comissões (HTTP ${response.status || 0}).`);
        render();
        return;
      }

      state.commissions.loading = false;
      state.commissions.error = '';
      state.commissions.data = data;
      render();
    } catch (error) {
      state.commissions.loading = false;
      state.commissions.error = 'Não consegui carregar as comissões agora.';
      render();
    }
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    if (state.submitting) return;

    const email = document.getElementById('tracker-login-email')?.value.trim() || '';
    const password = document.getElementById('tracker-login-password')?.value || '';
    const remember = Boolean(document.getElementById('tracker-login-remember')?.checked);

    state.submitting = true;
    state.error = '';
    render();

    try {
      const response = await fetch('api/landing_insights_auth.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email, password, remember }),
      });

      const { data, text } = await readApiResponse(response);
      if (!response.ok || !data || data.ok !== true || !saveAuth(data, remember)) {
        state.submitting = false;
        state.error =
          (data && data.error) ||
          (text ? `Erro ao autenticar: ${text}` : `Erro ao autenticar (HTTP ${response.status || 0}).`);
        render();
        return;
      }

      state.submitting = false;
      state.error = '';
      state.auth = readSavedAuth();
      state.view = getRequestedView();
      state.frameLoading = true;
      render();
    } catch (error) {
      state.submitting = false;
      state.error = 'Não consegui autenticar agora. Tente de novo.';
      render();
    }
  };

  const handleLogout = async () => {
    const token = state.auth?.token || '';

    if (token) {
      try {
        await fetch('api/landing_insights_auth.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'logout', token }),
        });
      } catch (error) {}
    }

    clearAuth();
    state.auth = null;
    state.error = '';
    state.lancamento.data = null;
    state.commissions.data = null;
    render();
  };

  state.auth = readSavedAuth();
  state.view = getRequestedView();

  window.addEventListener('popstate', () => {
    state.view = getRequestedView();
    if (state.auth) {
      state.frameLoading = true;
      render();
    }
  });

  render();
})();
