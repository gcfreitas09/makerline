const getFromStorage = (key) => {
  try {
    return sessionStorage.getItem(key) || '';
  } catch (error) {
    return '';
  }
};

const getFromLocal = (key) => {
  try {
    return localStorage.getItem(key) || '';
  } catch (error) {
    return '';
  }
};

const setInStorage = (key, value) => {
  try {
    sessionStorage.setItem(key, value);
  } catch (error) {}
};

const setInLocal = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (error) {}
};

const removeFromStorage = (key) => {
  try {
    sessionStorage.removeItem(key);
  } catch (error) {}
};

const removeFromLocal = (key) => {
  try {
    localStorage.removeItem(key);
  } catch (error) {}
};

const TRACKER_AUTH_SESSION_KEY = 'makerlineLandingInsightsAuth';
const TRACKER_AUTH_LOCAL_KEY = 'makerlineLandingInsightsAuthPersistent';
const TAB_OPTIONS = [
  { id: 'overview', label: 'Visao geral' },
  { id: 'funnel', label: 'Funil' },
  { id: 'sections', label: 'Secoes' },
  { id: 'cta-form', label: 'CTAs e formulario' },
  { id: 'acquisition', label: 'Aquisicao' },
  { id: 'signups', label: 'Pre-cadastros' },
  { id: 'partners', label: 'Parceiros' },
  { id: 'commissions', label: 'Comissoes' },
  { id: 'updates', label: 'Atualizacoes' },
  { id: 'events', label: 'Eventos tecnicos' },
];

const STANDALONE_TABS = ['commissions', 'updates'];

// Abas escondidas do menu por pedido do time -- o codigo e os dados de cada uma
// continuam intactos (renderCurrentTab ainda sabe renderiza-las), so o botao some.
const VISIBLE_TAB_IDS = ['overview', 'acquisition', 'partners'];
const PERIOD_OPTIONS = [
  { id: 'today', label: 'Hoje' },
  { id: '7d', label: '7 dias' },
  { id: '14d', label: '14 dias' },
  { id: '30d', label: '30 dias' },
  { id: 'all', label: 'Todo historico' },
  { id: 'custom', label: 'Personalizado' },
];

const state = {
  loading: false,
  error: '',
  data: null,
  auth: null,
  authSubmitting: false,
  authError: '',
  authInfo: '',
  activeTab: 'overview',
  period: '30d',
  dateFrom: '',
  dateTo: '',
  cleanupLoading: false,
  leadStatusLoading: '',
  deletingLeadId: '',
  signupFilters: {
    query: '',
    status: '',
    origin: '',
    partner: '',
    utmSource: '',
    utmCampaign: '',
    device: '',
    instagramPresence: '',
  },
  technicalFilters: {
    event: '',
    section: '',
    cta: '',
    device: '',
    channel: '',
    onlyLeads: false,
    onlyErrors: false,
  },
  commissions: {
    loaded: false,
    loading: false,
    error: '',
    data: null,
  },
  updates: {
    loaded: false,
    loading: false,
    error: '',
    items: [],
    draft: '',
    submitting: false,
    editingId: '',
    editDraft: '',
  },
};

const getEls = () => ({
  app: document.getElementById('landing-insights-app'),
  message: document.getElementById('landing-insights-message'),
});

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const formatNumber = (value) => Number(value || 0).toLocaleString('pt-BR');

const formatPercent = (value, digits = 1) =>
  `${Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;

const formatDelta = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'Sem base anterior';
  const safe = Number(value);
  const prefix = safe > 0 ? '+' : '';
  return `${prefix}${formatPercent(safe, 1)}`;
};

const formatDuration = (seconds) => {
  const safe = Math.max(0, Math.round(Number(seconds || 0)));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
};

const formatDateTime = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Sem dado';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDate = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const formatMoneyCents = (cents) =>
  (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatMonthLabel = (isoDate) => {
  const safe = String(isoDate || '').slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(safe)) return safe || 'Sem mes';
  const [year, month] = safe.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

const formatTrialDays = (value) => {
  const days = Number(value || 0);
  return days > 0 ? `${formatNumber(days)} dias` : 'Sem trial';
};

const formatLeadCaptureLabel = (lead) => {
  if (lead?.is_partial) return 'Historico importado do tracker antigo';
  if (lead?.data_source === 'landing_antiga') return 'Landing antiga';
  return 'Novo tracker';
};

const readApiResponse = async (response) => {
  const text = await response.text();
  if (!text.trim()) return { data: null, text: '' };
  try {
    return { data: JSON.parse(text), text };
  } catch (error) {
    return { data: null, text };
  }
};

const showMessage = (text, kind = '') => {
  const { message } = getEls();
  if (!message) return;
  message.textContent = text || '';
  message.className = `li-inline-message${kind ? ` ${kind}` : ''}`;
};

const parseSavedAuth = (raw) => {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const token = String(parsed.token || '').trim();
    const email = String(parsed.email || '').trim().toLowerCase();
    const expiresAt = String(parsed.expiresAt || '').trim();
    const name = String(parsed.name || '').trim();
    const remember = Boolean(parsed.remember);
    const expiresTs = expiresAt ? new Date(expiresAt).getTime() : 0;

    if (!token || !email || !expiresAt || !Number.isFinite(expiresTs) || expiresTs <= Date.now()) {
      return null;
    }

    return { token, email, expiresAt, name, remember };
  } catch (error) {
    return null;
  }
};

const clearAuth = () => {
  removeFromStorage(TRACKER_AUTH_SESSION_KEY);
  removeFromLocal(TRACKER_AUTH_LOCAL_KEY);
};

const readSavedAuth = () => {
  const sessionAuth = parseSavedAuth(getFromStorage(TRACKER_AUTH_SESSION_KEY));
  if (sessionAuth) return sessionAuth;
  removeFromLocal(TRACKER_AUTH_LOCAL_KEY);
  clearAuth();
  return null;
};

const saveAuth = (payload) => {
  const safePayload = {
    token: String(payload?.token || '').trim(),
    email: String(payload?.user?.email || '').trim().toLowerCase(),
    name: String(payload?.user?.name || '').trim(),
    expiresAt: String(payload?.expiresAt || '').trim(),
    remember: false,
  };

  if (!safePayload.token || !safePayload.email || !safePayload.expiresAt) {
    return false;
  }

  clearAuth();
  const raw = JSON.stringify(safePayload);
  setInStorage(TRACKER_AUTH_SESSION_KEY, raw);
  return true;
};

state.auth = readSavedAuth();

const statusClass = (value) => {
  const safe = String(value || '').toLowerCase();
  if (safe.includes('bom') || safe.includes('success')) return 'is-good';
  if (safe.includes('coletando')) return 'is-warning';
  if (safe.includes('atenc')) return 'is-warning';
  return 'is-danger';
};

const isPercentMetric = (id) => ['visitor_to_lead', 'click_to_lead'].includes(String(id || ''));

const normalizeWhatsappDigits = (value) => String(value || '').replace(/\D/g, '');

const whatsappUrl = (value) => {
  const digits = normalizeWhatsappDigits(value);
  if (digits.length < 10) return '';
  const local = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${local}`;
};

const copyText = async (value) => {
  if (!value) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch (error) {
    return false;
  }
};

const renderLogin = () => `
  <section class="li-auth-shell">
    <article class="li-auth-card">
      <div class="li-auth-brand">
        <div class="li-brand__logo">
          <img src="assets/img/logo.png" alt="Makerline" />
        </div>
        <div>
          <p class="li-kicker">Tracker privado</p>
          <h1>Landing Insights</h1>
          <p class="li-subtitle">Entre com sua conta autorizada para abrir o tracker privado da landing do Makerline.</p>
        </div>
      </div>

      <div class="li-auth-strap">Acesso restrito aos socios autorizados.</div>

      <form class="li-auth-form" id="landing-insights-login-form">
        <label class="li-auth-field">
          <span>E-mail</span>
          <input type="email" name="email" autocomplete="username" placeholder="voce@email.com" required />
        </label>

        <label class="li-auth-field">
          <span>Senha</span>
          <input type="password" name="password" autocomplete="current-password" placeholder="Sua senha" required />
        </label>

        <div class="li-auth-actions">
          <button class="li-btn li-btn--ghost" type="button" data-action="back">Voltar para o app</button>
          <button class="li-btn li-btn--primary" type="submit" ${state.authSubmitting ? 'disabled' : ''}>
            ${state.authSubmitting ? 'Entrando...' : 'Entrar no tracker'}
          </button>
        </div>

        ${state.authError ? `<div class="li-auth-feedback is-error">${escapeHtml(state.authError)}</div>` : ''}
        ${state.authInfo ? `<div class="li-auth-feedback is-info">${escapeHtml(state.authInfo)}</div>` : ''}
      </form>
    </article>
  </section>
`;

const renderMetricCard = (card) => `
  <article class="li-metric-card">
    <div class="li-card-top">
      <span class="li-metric-label">${escapeHtml(card.label)}</span>
      <span class="li-badge ${statusClass(card.status)}">${escapeHtml(card.status)}</span>
    </div>
    <strong class="li-metric-value">${isPercentMetric(card.id) ? formatPercent(card.value, 1) : formatNumber(card.value)}</strong>
    <small>${escapeHtml(card.description)}</small>
    <div class="li-card-delta ${
      String(card.status || '').toLowerCase().includes('coletando')
        ? 'is-neutral'
        : card.delta !== null && card.delta < 0
          ? 'is-negative'
          : 'is-positive'
    }">${
      String(card.status || '').toLowerCase().includes('coletando')
        ? 'Amostra em formacao'
        : escapeHtml(formatDelta(card.delta))
    }</div>
  </article>
`;

const renderOverview = () => {
  const overview = state.data?.overview || {};
  const leads = Array.isArray(state.data?.leads) ? state.data.leads.slice(0, 8) : [];

  return `
    <section class="li-section-stack">
      <section class="li-card-grid">
        ${(overview.cards || []).map(renderMetricCard).join('')}
      </section>

      <section class="li-panel">
        <div class="li-panel__head">
          <div>
            <p class="li-kicker">Diagnostico automatico</p>
            <h2>O que esta travando ou ajudando a conversao</h2>
          </div>
        </div>
        <div class="li-diagnostics-grid">
          ${(overview.diagnostics || [])
            .map(
              (item) => `
              <article class="li-diagnostic-card">
                <span class="li-badge ${statusClass(item.status)}">${escapeHtml(item.status)}</span>
                <h3>${escapeHtml(item.problem || '')}</h3>
                <p><strong>Causa provavel:</strong> ${escapeHtml(item.cause || '')}</p>
                <p><strong>Acao recomendada:</strong> ${escapeHtml(item.action || '')}</p>
                <p><strong>Confianca:</strong> ${escapeHtml(item.confidence || 'Media')}</p>
              </article>
            `
            )
            .join('')}
        </div>
      </section>

      <section class="li-panel">
        <div class="li-panel__head">
          <div>
            <p class="li-kicker">Proximas acoes</p>
            <h2>Prioridades para a landing</h2>
          </div>
        </div>
        <div class="li-actions-list">
          ${(overview.nextActions || [])
            .map(
              (item) => `
                <article class="li-action-item">
                  <strong>${escapeHtml(item.priority || 'Prioridade')}</strong>
                  <div>${escapeHtml(item.title || '')}</div>
                  <small>${escapeHtml(item.description || '')}</small>
                </article>
              `
            )
            .join('')}
        </div>
        ${
          (overview.highlights || []).length
            ? `
              <div class="li-alert-list">
                ${(overview.highlights || []).map((item) => `<div class="li-alert-item">${escapeHtml(item)}</div>`).join('')}
              </div>
            `
            : ''
        }
      </section>

      <section class="li-panel">
        <div class="li-panel__head">
          <div>
            <p class="li-kicker">Leads recentes</p>
            <h2>Leads com contexto de origem</h2>
          </div>
        </div>
        ${renderLeadsTable(leads)}
      </section>
    </section>
  `;
};

const renderFunnel = () => {
  const funnel = state.data?.funnel || {};
  const steps = Array.isArray(funnel.steps) ? funnel.steps : [];
  const biggestDrop = funnel.biggest_drop || {};

  return `
    <section class="li-section-stack">
      <section class="li-panel">
        <div class="li-panel__head">
          <div>
            <p class="li-kicker">Funil da landing</p>
            <h2>Da visita ao lead</h2>
          </div>
          ${
            biggestDrop?.label
              ? `<div class="li-panel-note">Maior abandono: ${escapeHtml(biggestDrop.label)} (${formatNumber(biggestDrop.drop_count)} / ${formatPercent(
                  biggestDrop.drop_percent,
                  1
                )})</div>`
              : ''
          }
        </div>
        <div class="li-funnel-list">
          ${steps
            .map(
              (step) => `
                <article class="li-funnel-row ${biggestDrop.id === step.id ? 'is-highlight' : ''}">
                  <div class="li-funnel-row__main">
                    <strong>${escapeHtml(step.label)}</strong>
                    <span>${formatNumber(step.count)}</span>
                  </div>
                  <div class="li-progress"><div class="li-progress__bar" style="width:${Math.max(0, Math.min(100, Number(step.percent_total || 0)))}%"></div></div>
                  <div class="li-funnel-row__meta">
                    <small>${formatPercent(step.percent_previous, 1)} da etapa anterior</small>
                    <small>${formatPercent(step.percent_total, 1)} do total</small>
                    <small>Queda: ${formatNumber(step.drop_count)} (${formatPercent(step.drop_percent, 1)})</small>
                  </div>
                </article>
              `
            )
            .join('')}
        </div>
      </section>

      <section class="li-card-grid li-card-grid--mini">
        ${(funnel.mini_cards || [])
          .map(
            (item) => `
              <article class="li-mini-card">
                <span>${escapeHtml(item.label)}</span>
                <strong>${formatPercent(item.value, 1)}</strong>
              </article>
            `
          )
          .join('')}
      </section>
    </section>
  `;
};

const renderSections = () => {
  const rows = Array.isArray(state.data?.sections) ? state.data.sections : [];
  const maxVisitors = Math.max(...rows.map((row) => Number(row.visitors || 0)), 1);

  return `
    <section class="li-section-stack">
      <section class="li-panel">
        <div class="li-panel__head">
          <div>
            <p class="li-kicker">Secoes</p>
            <h2>Queda e influencia por bloco da landing</h2>
          </div>
        </div>
        <div class="li-section-chart">
          ${rows
            .map(
              (row) => `
                <article class="li-section-chart__row">
                  <div class="li-section-chart__label">
                    <strong>${escapeHtml(row.label)}</strong>
                    <small>${formatNumber(row.visitors)} visitantes</small>
                  </div>
                  <div class="li-progress li-progress--tall">
                    <div class="li-progress__bar" style="width:${Math.max(0, Math.min(100, (Number(row.visitors || 0) / maxVisitors) * 100))}%"></div>
                  </div>
                  <div class="li-section-chart__value">${formatPercent(row.visitors_percent, 1)}</div>
                </article>
              `
            )
            .join('')}
        </div>
      </section>

      <section class="li-panel">
        <div class="li-panel__head">
          <div>
            <p class="li-kicker">Tabela de secoes</p>
            <h2>Onde a landing segura ou perde atencao</h2>
          </div>
        </div>
        ${renderDataTable(
          [
            { key: 'label', label: 'Secao' },
            { key: 'visitors', label: 'Visitantes', render: (row) => formatNumber(row.visitors) },
            { key: 'visitors_percent', label: '% visitantes', render: (row) => formatPercent(row.visitors_percent, 1) },
            { key: 'avg_time_seconds', label: 'Tempo medio', render: (row) => formatDuration(row.avg_time_seconds) },
            { key: 'avg_scroll_percent', label: 'Scroll medio', render: (row) => formatPercent(row.avg_scroll_percent, 1) },
            { key: 'clicks_after', label: 'Cliques depois', render: (row) => formatNumber(row.clicks_after) },
            { key: 'leads_influenced', label: 'Leads influenciados', render: (row) => formatNumber(row.leads_influenced) },
            { key: 'advance_rate', label: 'Taxa de avanco', render: (row) => (row.advance_rate === null ? '-' : formatPercent(row.advance_rate, 1)) },
          ],
          rows
        )}
      </section>
    </section>
  `;
};

const renderCtaForm = () => {
  const ctas = Array.isArray(state.data?.ctas) ? state.data.ctas : [];
  const form = state.data?.form || {};

  const ctaAlerts = [];
  const secondary = ctas.find((row) => row.id === 'hero_secondary_features');
  const hero = ctas.find((row) => row.id === 'hero_primary_cta');
  const header = ctas.find((row) => row.id === 'header_cta');
  const final = ctas.find((row) => row.id === 'final_form_submit');
  const finalSection = (state.data?.sections || []).find((row) => row.id === 'final-form');

  if (secondary && secondary.clicks > 0 && secondary.leads_after_click === 0) {
    ctaAlerts.push('O CTA secundario pode estar roubando atencao do CTA principal.');
  }
  if (hero && header && hero.post_click_conversion > header.post_click_conversion) {
    ctaAlerts.push('O CTA principal da hero converte melhor que o CTA do menu. Reduza distrações acima da dobra.');
  }
  if (final && final.post_click_conversion >= 40 && finalSection && Number(finalSection.visitors_percent || 0) < 15) {
    ctaAlerts.push('Mais pessoas precisam chegar ao formulario final. A pagina pode estar longa ou perdendo forca antes do fim.');
  }

  return `
    <section class="li-section-stack">
      <section class="li-panel">
        <div class="li-panel__head">
          <div>
            <p class="li-kicker">CTAs</p>
            <h2>Qual CTA gera clique e qual gera lead</h2>
          </div>
        </div>
        ${renderDataTable(
          [
            { key: 'label', label: 'CTA' },
            { key: 'location', label: 'Local' },
            { key: 'clicks', label: 'Cliques', render: (row) => formatNumber(row.clicks) },
            { key: 'visitors_percent', label: '% visitantes', render: (row) => formatPercent(row.visitors_percent, 1) },
            { key: 'forms_started_after_click', label: 'Forms apos clique', render: (row) => formatNumber(row.forms_started_after_click) },
            { key: 'leads_after_click', label: 'Leads apos clique', render: (row) => formatNumber(row.leads_after_click) },
            { key: 'post_click_conversion', label: 'Conv. pos-clique', render: (row) => formatPercent(row.post_click_conversion, 1) },
            { key: 'status', label: 'Status' },
          ],
          ctas
        )}
        ${
          ctaAlerts.length
            ? `<div class="li-alert-list">${ctaAlerts.map((item) => `<div class="li-alert-item">${escapeHtml(item)}</div>`).join('')}</div>`
            : ''
        }
      </section>

      <section class="li-split-grid">
        <article class="li-panel">
          <div class="li-panel__head">
            <div>
              <p class="li-kicker">Formulario</p>
              <h2>Performance do formulario</h2>
            </div>
          </div>
          <div class="li-card-grid li-card-grid--mini">
            ${[
              ['Viram o formulario', formatNumber(form.viewers || 0)],
              ['Iniciaram', formatNumber(form.started || 0)],
              ['Tentaram enviar', formatNumber(form.submit_attempts || 0)],
              ['Leads criados', formatNumber(form.leads || 0)],
              ['Taxa de inicio', formatPercent(form.start_rate || 0, 1)],
              ['Taxa de conclusao', formatPercent(form.completion_rate || 0, 1)],
              ['Erros de envio', formatNumber(form.errors || 0)],
            ]
              .map(
                ([label, value]) => `
                <article class="li-mini-card">
                  <span>${escapeHtml(label)}</span>
                  <strong>${escapeHtml(value)}</strong>
                </article>
              `
              )
              .join('')}
          </div>
        </article>

        <article class="li-panel">
          <div class="li-panel__head">
            <div>
              <p class="li-kicker">Abandono por campo</p>
              <h2>Onde o formulario perde conversao</h2>
            </div>
          </div>
          ${renderDataTable(
            [
              { key: 'label', label: 'Campo' },
              { key: 'reached', label: 'Chegaram aqui', render: (row) => formatNumber(row.reached) },
              { key: 'abandoned', label: 'Abandonaram aqui', render: (row) => formatNumber(row.abandoned) },
              { key: 'abandon_rate', label: 'Taxa de abandono', render: (row) => formatPercent(row.abandon_rate, 1) },
            ],
            form.fields || []
          )}
        </article>
      </section>
    </section>
  `;
};

const filterSignups = (leads) => {
  const filters = state.signupFilters;
  const query = String(filters.query || '').trim().toLowerCase();
  return leads.filter((lead) => {
    const instagramPresent = Boolean(lead.instagram_username || lead.instagram);
    const haystack = [
      lead.name,
      lead.phone,
      lead.instagram,
      lead.instagram_username,
      lead.partner_name,
      lead.status_label,
      lead.campaign,
      lead.utm_source,
      lead.utm_campaign,
    ]
      .join(' ')
      .toLowerCase();

    if (query && !haystack.includes(query)) return false;
    if (filters.status && lead.status !== filters.status) return false;
    if (filters.origin && (lead.source_label || '') !== filters.origin) return false;
    if (filters.partner && (lead.partner_name || '') !== filters.partner) return false;
    if (filters.utmSource && (lead.utm_source || '') !== filters.utmSource) return false;
    if (filters.utmCampaign && (lead.campaign || '') !== filters.utmCampaign) return false;
    if (filters.device && (lead.device_label || '') !== filters.device) return false;
    if (filters.instagramPresence === 'with' && !instagramPresent) return false;
    if (filters.instagramPresence === 'without' && instagramPresent) return false;
    return true;
  });
};

const buildSignupOptions = (leads) => {
  const unique = (values) => [...new Set(values.filter(Boolean))].sort();
  return {
    status: unique(leads.map((lead) => lead.status)),
    origin: unique(leads.map((lead) => lead.source_label)),
    partner: unique(leads.map((lead) => lead.partner_name)),
    utmSource: unique(leads.map((lead) => lead.utm_source)),
    utmCampaign: unique(leads.map((lead) => lead.campaign)),
    device: unique(leads.map((lead) => lead.device_label)),
  };
};

const renderSignups = () => {
  const allLeads = Array.isArray(state.data?.leads) ? state.data.leads : [];
  const leads = filterSignups(allLeads);
  const options = buildSignupOptions(allLeads);
  const withInstagram = leads.filter((lead) => lead.instagram_username || lead.instagram).length;
  const summary = {
    total: leads.length,
    new: leads.filter((lead) => lead.status === 'new').length,
    contacted: leads.filter((lead) => lead.status === 'contacted').length,
    qualified: leads.filter((lead) => lead.status === 'qualified').length,
    withInstagram,
    withoutInstagram: Math.max(0, leads.length - withInstagram),
  };

  return `
    <section class="li-section-stack">
      <section class="li-card-grid li-card-grid--mini">
        ${[
          ['Total de pre-cadastros', formatNumber(summary.total)],
          ['Novos', formatNumber(summary.new)],
          ['Contatados', formatNumber(summary.contacted)],
          ['Qualificados', formatNumber(summary.qualified)],
          ['Com Instagram', formatNumber(summary.withInstagram)],
          ['Sem Instagram', formatNumber(summary.withoutInstagram)],
        ]
          .map(
            ([label, value]) => `
              <article class="li-mini-card">
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(value)}</strong>
              </article>
            `
          )
          .join('')}
      </section>

      <section class="li-panel">
        <div class="li-panel__head">
          <div>
            <p class="li-kicker">Pre-cadastros</p>
            <h2>Lista completa com contato, origem, parceiro e trial</h2>
          </div>
        </div>
        <div class="li-filter-panel">
          <div class="li-filter-panel__head">
            <strong>Filtros da lista</strong>
            <span>Separe busca, origem, parceiro e campanha em grupos mais claros.</span>
          </div>
          <div class="li-filter-grid li-filter-grid--signups">
            <label class="li-select-filter li-select-filter--wide">
              <span>Busca</span>
              <input type="search" data-signup-filter="query" value="${escapeHtml(state.signupFilters.query)}" placeholder="Nome, WhatsApp, Instagram, parceiro..." />
            </label>
            ${renderSelectFilter('status', 'Status', options.status, state.signupFilters.status, 'signup')}
            ${renderSelectFilter('origin', 'Origem', options.origin, state.signupFilters.origin, 'signup')}
            ${renderSelectFilter('partner', 'Parceiro', options.partner, state.signupFilters.partner, 'signup')}
            ${renderSelectFilter('utmSource', 'UTM Source', options.utmSource, state.signupFilters.utmSource, 'signup')}
            ${renderSelectFilter('utmCampaign', 'UTM Campaign', options.utmCampaign, state.signupFilters.utmCampaign, 'signup')}
            ${renderSelectFilter('device', 'Device', options.device, state.signupFilters.device, 'signup')}
            <label class="li-select-filter">
              <span>Instagram</span>
              <select data-signup-filter="instagramPresence">
                <option value="">Todos</option>
                <option value="with" ${state.signupFilters.instagramPresence === 'with' ? 'selected' : ''}>Com Instagram</option>
                <option value="without" ${state.signupFilters.instagramPresence === 'without' ? 'selected' : ''}>Sem Instagram</option>
              </select>
            </label>
          </div>
        </div>
        ${renderDataTable(
          [
            { key: 'created_at', label: 'Data', render: (row) => formatDateTime(row.created_at) },
            {
              key: 'name',
              label: 'Lead',
              renderHtml: (row) => `
                <div class="li-table-stack">
                  <strong>${escapeHtml(row.name || 'Sem nome')}</strong>
                  <small>${escapeHtml(formatLeadCaptureLabel(row))}</small>
                </div>
              `,
            },
            {
              key: 'contact',
              label: 'Contato',
              renderHtml: (row) => {
                const url = whatsappUrl(row.phone || '');
                const phoneLabel = row.phone
                  ? (url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.phone)}</a>` : escapeHtml(row.phone))
                  : (row.is_partial ? 'Nao preservado no tracker antigo' : 'Nao informado');
                const instagramLabel = row.instagram
                  ? (row.instagram_url
                      ? `<a href="${escapeHtml(row.instagram_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.instagram)}</a>`
                      : escapeHtml(row.instagram))
                  : (row.is_partial ? 'Nao preservado no tracker antigo' : 'Nao informado');
                return `
                  <div class="li-table-stack">
                    <strong>WhatsApp</strong>
                    <small>${phoneLabel}</small>
                    <strong>Instagram</strong>
                    <small>${instagramLabel}</small>
                  </div>
                `;
              },
            },
            {
              key: 'origin',
              label: 'Origem e campanha',
              renderHtml: (row) => `
                <div class="li-table-stack">
                  <strong>${escapeHtml(row.source_label || row.channel || '-')}</strong>
                  <small>Canal: ${escapeHtml(row.channel || '-')}</small>
                  <small>UTM: ${escapeHtml([row.utm_source, row.utm_medium].filter(Boolean).join(' / ') || '-')}</small>
                  <small>Campanha: ${escapeHtml(row.campaign || '-')}</small>
                </div>
              `,
            },
            {
              key: 'partner',
              label: 'Parceiro e trial',
              renderHtml: (row) => `
                <div class="li-table-stack">
                  <strong>${escapeHtml(row.partner_name || 'Sem parceiro')}</strong>
                  <small>Trial: ${escapeHtml(formatTrialDays(row.partner_trial_days))}</small>
                  <small>${escapeHtml(row.referral_code || '-')}</small>
                </div>
              `,
            },
            {
              key: 'context',
              label: 'Conversao',
              renderHtml: (row) => `
                <div class="li-table-stack">
                  <strong>${escapeHtml(row.cta_label || '-')}</strong>
                  <small>Secao: ${escapeHtml(row.section_label || '-')}</small>
                  <small>Device: ${escapeHtml(row.device_label || '-')}</small>
                </div>
              `,
            },
            {
              key: 'actions',
              label: 'Acoes',
              renderHtml: (row) => `
                <div class="li-row-actions">
                  <button class="li-btn li-btn--danger li-btn--small" type="button" data-lead-action="delete" data-lead-id="${escapeHtml(row.id)}" ${state.deletingLeadId === row.id ? 'disabled' : ''}>
                    ${state.deletingLeadId === row.id ? 'Excluindo...' : 'Excluir'}
                  </button>
                </div>
              `,
            },
          ],
          leads
        )}
      </section>
    </section>
  `;
};

const renderAcquisition = () => {
  const acquisition = state.data?.acquisition || {};
  const devices = Array.isArray(state.data?.devices) ? state.data.devices : [];
  return `
    <section class="li-section-stack">
      <section class="li-split-grid">
        <article class="li-panel">
          <div class="li-panel__head"><div><p class="li-kicker">Canais</p><h2>Origens da landing</h2></div></div>
          ${renderDataTable(
            [
              { key: 'channel', label: 'Canal' },
              { key: 'visitors', label: 'Visitantes', render: (row) => formatNumber(row.visitors) },
              { key: 'sessions', label: 'Sessoes', render: (row) => formatNumber(row.sessions) },
              { key: 'cta_clicks', label: 'Cliques CTA', render: (row) => formatNumber(row.cta_clicks) },
              { key: 'leads', label: 'Leads', render: (row) => formatNumber(row.leads) },
              { key: 'conversion', label: 'Conversao', render: (row) => formatPercent(row.conversion, 1) },
            ],
            acquisition.channels || []
          )}
        </article>
        <article class="li-panel">
          <div class="li-panel__head"><div><p class="li-kicker">Devices</p><h2>Conversao por dispositivo</h2></div></div>
          ${renderDataTable(
            [
              { key: 'device', label: 'Device' },
              { key: 'visitors', label: 'Visitantes', render: (row) => formatNumber(row.visitors) },
              { key: 'sessions', label: 'Sessoes', render: (row) => formatNumber(row.sessions) },
              { key: 'form_starts', label: 'Forms', render: (row) => formatNumber(row.form_starts) },
              { key: 'leads', label: 'Leads', render: (row) => formatNumber(row.leads) },
              { key: 'conversion', label: 'Conversao', render: (row) => formatPercent(row.conversion, 1) },
            ],
            devices
          )}
        </article>
      </section>
      <section class="li-split-grid">
        <article class="li-panel">
          <div class="li-panel__head"><div><p class="li-kicker">UTMs</p><h2>Campanhas rastreadas</h2></div></div>
          ${renderDataTable(
            [
              { key: 'utm_source', label: 'UTM Source' },
              { key: 'utm_medium', label: 'UTM Medium' },
              { key: 'utm_campaign', label: 'UTM Campaign' },
              { key: 'visitors', label: 'Visitantes', render: (row) => formatNumber(row.visitors) },
              { key: 'clicks', label: 'Cliques', render: (row) => formatNumber(row.clicks) },
              { key: 'leads', label: 'Leads', render: (row) => formatNumber(row.leads) },
              { key: 'conversion', label: 'Conversao', render: (row) => formatPercent(row.conversion, 1) },
            ],
            acquisition.utms || []
          )}
        </article>
        <article class="li-panel">
          <div class="li-panel__head"><div><p class="li-kicker">Referrers</p><h2>Origem percebida</h2></div></div>
          ${renderDataTable(
            [
              { key: 'origin', label: 'Origem' },
              { key: 'visitors', label: 'Visitantes', render: (row) => formatNumber(row.visitors) },
              { key: 'leads', label: 'Leads', render: (row) => formatNumber(row.leads) },
              { key: 'conversion', label: 'Conversao', render: (row) => formatPercent(row.conversion, 1) },
            ],
            acquisition.referrers || []
          )}
        </article>
      </section>
    </section>
  `;
};

const renderPartners = () => {
  const rows = Array.isArray(state.data?.partners) ? state.data.partners : [];

  return `
    <section class="li-section-stack">
      <section class="li-panel">
        <div class="li-panel__head">
          <div>
            <p class="li-kicker">Parceiros</p>
            <h2>Views, leads e links rastreaveis por parceiro</h2>
          </div>
        </div>
        ${renderDataTable(
          [
            { key: 'partner_name', label: 'Parceiro' },
            {
              key: 'partner_instagram',
              label: 'Instagram',
              renderHtml: (row) =>
                row.partner_instagram_url
                  ? `<a href="${escapeHtml(row.partner_instagram_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.partner_instagram || '-')}</a>`
                  : escapeHtml(row.partner_instagram || '-'),
            },
            {
              key: 'signup_url',
              label: 'Link do parceiro',
              renderHtml: (row) =>
                row.signup_url
                  ? `<a href="${escapeHtml(row.signup_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.referral_code || row.signup_url)}</a>`
                  : escapeHtml(row.referral_code || '-'),
            },
            { key: 'trial_days', label: 'Trial', render: (row) => (row.trial_days ? `${formatNumber(row.trial_days)} dias` : '-') },
            { key: 'views', label: 'Views originadas', render: (row) => formatNumber(row.views) },
            { key: 'sessions', label: 'Sessoes', render: (row) => formatNumber(row.sessions) },
            { key: 'unique_visitors', label: 'Visitantes', render: (row) => formatNumber(row.unique_visitors) },
            { key: 'leads', label: 'Leads gerados', render: (row) => formatNumber(row.leads) },
            { key: 'conversion', label: 'Conv. view -> lead', render: (row) => formatPercent(row.conversion, 1) },
            { key: 'last_lead_at', label: 'Ultimo lead', render: (row) => (row.last_lead_at ? formatDateTime(row.last_lead_at) : '-') },
          ],
          rows
        )}
      </section>
    </section>
  `;
};

const renderCommissions = () => {
  if (state.commissions.loading && !state.commissions.data) {
    return `<section class="li-panel"><div class="li-empty">Carregando comissoes...</div></section>`;
  }

  if (state.commissions.error) {
    return `
      <section class="li-panel li-panel--empty">
        <h2>Nao consegui carregar as comissoes</h2>
        <p>${escapeHtml(state.commissions.error)}</p>
        <button class="li-btn li-btn--primary" type="button" data-action="reload-commissions">Tentar de novo</button>
      </section>
    `;
  }

  const data = state.commissions.data;
  if (!data) {
    return `<section class="li-panel"><div class="li-empty">Ainda sem dados.</div></section>`;
  }

  const totals = data.totals || {};
  const balances = Array.isArray(data.balances) ? data.balances : [];
  const summary = Array.isArray(data.summary) ? data.summary : [];
  const recent = Array.isArray(data.recent) ? data.recent : [];

  return `
    <section class="li-section-stack">
      <section class="li-panel">
        <div class="li-panel__head">
          <div>
            <p class="li-kicker">Comissoes de parceiros</p>
            <h2>Quanto cada parceiro ja ganhou</h2>
          </div>
        </div>
        <div class="li-card-grid">
          <div class="li-metric-card">
            <span class="li-metric-label">Bruto recebido</span>
            <strong class="li-metric-value">${formatMoneyCents(totals.grossAmountCents)}</strong>
          </div>
          <div class="li-metric-card">
            <span class="li-metric-label">Comissao total</span>
            <strong class="li-metric-value">${formatMoneyCents(totals.commissionAmountCents)}</strong>
          </div>
          <div class="li-metric-card">
            <span class="li-metric-label">Liquido pra Makerline</span>
            <strong class="li-metric-value">${formatMoneyCents(totals.platformAmountCents)}</strong>
          </div>
          <div class="li-metric-card">
            <span class="li-metric-label">Clientes pagantes</span>
            <strong class="li-metric-value">${formatNumber(totals.payingClients)}</strong>
          </div>
        </div>
      </section>

      <section class="li-panel">
        <div class="li-panel__head">
          <div>
            <p class="li-kicker">Por parceiro</p>
            <h2>Saldo acumulado</h2>
          </div>
        </div>
        ${renderDataTable(
          [
            { key: 'partnerName', label: 'Parceiro' },
            { key: 'payingClients', label: 'Clientes', render: (row) => formatNumber(row.payingClients) },
            { key: 'paidInvoices', label: 'Cobrancas pagas', render: (row) => formatNumber(row.paidInvoices) },
            { key: 'grossAmountCents', label: 'Bruto', render: (row) => formatMoneyCents(row.grossAmountCents) },
            { key: 'commissionAmountCents', label: 'Comissao', render: (row) => formatMoneyCents(row.commissionAmountCents) },
            { key: 'latestPayoutMonth', label: 'Ultimo mes', render: (row) => formatMonthLabel(row.latestPayoutMonth) },
          ],
          balances
        )}
      </section>

      <section class="li-panel">
        <div class="li-panel__head">
          <div>
            <p class="li-kicker">Mes a mes</p>
            <h2>Fechamento mensal por parceiro</h2>
          </div>
        </div>
        ${renderDataTable(
          [
            { key: 'payout_month', label: 'Mes', render: (row) => formatMonthLabel(row.payout_month) },
            { key: 'partner_name', label: 'Parceiro' },
            { key: 'paying_clients', label: 'Clientes', render: (row) => formatNumber(row.paying_clients) },
            { key: 'gross_amount_cents', label: 'Bruto', render: (row) => formatMoneyCents(row.gross_amount_cents) },
            { key: 'commission_amount_cents', label: 'Comissao', render: (row) => formatMoneyCents(row.commission_amount_cents) },
            { key: 'platform_net_amount_cents', label: 'Liquido Makerline', render: (row) => formatMoneyCents(row.platform_net_amount_cents) },
          ],
          summary
        )}
      </section>

      <section class="li-panel">
        <div class="li-panel__head">
          <div>
            <p class="li-kicker">Lancamentos recentes</p>
            <h2>Ultimas cobrancas com comissao</h2>
          </div>
        </div>
        ${renderDataTable(
          [
            { key: 'paid_at', label: 'Data', render: (row) => formatDateTime(row.paid_at) },
            { key: 'partner_name', label: 'Parceiro' },
            { key: 'user_email', label: 'Cliente' },
            { key: 'plan_code', label: 'Plano', render: (row) => (row.plan_code === 'annual' ? 'Anual' : row.plan_code === 'monthly' ? 'Mensal' : row.plan_code || '-') },
            { key: 'amount_paid_cents', label: 'Valor pago', render: (row) => formatMoneyCents(row.amount_paid_cents) },
            { key: 'commission_amount_cents', label: 'Comissao', render: (row) => formatMoneyCents(row.commission_amount_cents) },
          ],
          recent
        )}
      </section>
    </section>
  `;
};

const renderUpdates = () => {
  const items = Array.isArray(state.updates.items) ? state.updates.items : [];

  return `
    <section class="li-section-stack">
      <section class="li-panel">
        <div class="li-panel__head">
          <div>
            <p class="li-kicker">Atualizacoes da equipe</p>
            <h2>O que aconteceu essa semana</h2>
          </div>
        </div>
        <div class="li-update-form">
          <textarea
            id="update-draft-input"
            class="li-update-textarea"
            rows="3"
            placeholder="Escreve aqui o que voce aprendeu, fez ou quer registrar essa semana..."
          >${escapeHtml(state.updates.draft)}</textarea>
          <button class="li-btn li-btn--primary" type="button" data-action="publish-update" ${state.updates.submitting ? 'disabled' : ''}>
            ${state.updates.submitting ? 'Publicando...' : 'Publicar'}
          </button>
        </div>
      </section>

      <section class="li-panel">
        <div class="li-panel__head">
          <div>
            <p class="li-kicker">Linha do tempo</p>
            <h2>${formatNumber(items.length)} atualizacao${items.length === 1 ? '' : 'es'}</h2>
          </div>
        </div>
        ${
          state.updates.loading && !items.length
            ? '<div class="li-empty">Carregando atualizacoes...</div>'
            : state.updates.error
            ? `<div class="li-empty">${escapeHtml(state.updates.error)}</div>`
            : !items.length
            ? '<div class="li-empty">Nenhuma atualizacao publicada ainda.</div>'
            : `
              <div class="li-timeline">
                ${items
                  .map((item) => {
                    const isEditing = state.updates.editingId === item.id;
                    return `
                      <article class="li-timeline-item">
                        <div class="li-timeline-item__head">
                          <strong>${escapeHtml(item.author_name || 'Equipe')}</strong>
                          <span>${formatDateTime(item.created_at)}</span>
                        </div>
                        ${
                          isEditing
                            ? `
                              <textarea class="li-update-textarea" rows="3" data-update-edit-input="${escapeHtml(item.id)}">${escapeHtml(state.updates.editDraft)}</textarea>
                              <div class="li-timeline-item__actions">
                                <button class="li-btn li-btn--primary" type="button" data-update-action="save" data-update-id="${escapeHtml(item.id)}">Salvar</button>
                                <button class="li-btn li-btn--ghost" type="button" data-update-action="cancel-edit" data-update-id="${escapeHtml(item.id)}">Cancelar</button>
                              </div>
                            `
                            : `
                              <p class="li-timeline-item__message">${escapeHtml(item.message).replaceAll('\n', '<br />')}</p>
                              <div class="li-timeline-item__actions">
                                <button class="li-btn li-btn--ghost" type="button" data-update-action="edit" data-update-id="${escapeHtml(item.id)}">Editar</button>
                                <button class="li-btn li-btn--danger" type="button" data-update-action="delete" data-update-id="${escapeHtml(item.id)}">Apagar</button>
                              </div>
                            `
                        }
                      </article>
                    `;
                  })
                  .join('')}
              </div>
            `
        }
      </section>
    </section>
  `;
};

const buildTechnicalFilterOptions = (events) => {
  const unique = (values) => [...new Set(values.filter(Boolean))].sort();
  return {
    event: unique(events.map((item) => item.event_name)),
    section: unique(events.map((item) => item.section_id)),
    cta: unique(events.map((item) => item.cta_id)),
    device: unique(events.map((item) => item.device)),
    channel: unique(events.map((item) => item.channel)),
  };
};

const filterTechnicalEvents = (events) => {
  const filters = state.technicalFilters;
  return events.filter((event) => {
    if (filters.event && event.event_name !== filters.event) return false;
    if (filters.section && event.section_id !== filters.section) return false;
    if (filters.cta && event.cta_id !== filters.cta) return false;
    if (filters.device && event.device !== filters.device) return false;
    if (filters.channel && event.channel !== filters.channel) return false;
    if (filters.onlyLeads && !event.lead_created) return false;
    if (filters.onlyErrors && !event.error) return false;
    return true;
  });
};

const renderEvents = () => {
  const events = Array.isArray(state.data?.technicalEvents) ? state.data.technicalEvents : [];
  const options = buildTechnicalFilterOptions(events);
  const filtered = filterTechnicalEvents(events);

  return `
    <section class="li-section-stack">
      <section class="li-panel">
        <div class="li-panel__head">
          <div>
            <p class="li-kicker">Eventos tecnicos</p>
            <h2>Debug separado da visao principal</h2>
          </div>
        </div>
        <div class="li-filter-panel">
          <div class="li-filter-panel__head">
            <strong>Filtros tecnicos</strong>
            <span>Organize o debug por evento, secao, CTA e excecoes sem virar uma faixa de botoes.</span>
          </div>
          <div class="li-filter-grid li-filter-grid--events">
            ${renderSelectFilter('event', 'Evento', options.event, state.technicalFilters.event)}
            ${renderSelectFilter('section', 'Secao', options.section, state.technicalFilters.section)}
            ${renderSelectFilter('cta', 'CTA', options.cta, state.technicalFilters.cta)}
            ${renderSelectFilter('device', 'Device', options.device, state.technicalFilters.device)}
            ${renderSelectFilter('channel', 'Canal', options.channel, state.technicalFilters.channel)}
            <label class="li-checkbox">
              <input type="checkbox" data-technical-toggle="onlyLeads" ${state.technicalFilters.onlyLeads ? 'checked' : ''} />
              <span>Apenas leads</span>
            </label>
            <label class="li-checkbox">
              <input type="checkbox" data-technical-toggle="onlyErrors" ${state.technicalFilters.onlyErrors ? 'checked' : ''} />
              <span>Apenas erros</span>
            </label>
          </div>
        </div>
        ${renderDataTable(
          [
            { key: 'date', label: 'Data', render: (row) => formatDateTime(row.date) },
            { key: 'visitor_id', label: 'Visitor ID' },
            { key: 'session_id', label: 'Session ID' },
            { key: 'page_instance_id', label: 'Page ID' },
            { key: 'event_name', label: 'Evento' },
            { key: 'section_label', label: 'Secao' },
            { key: 'cta_label', label: 'CTA' },
            { key: 'channel', label: 'Canal' },
            { key: 'device', label: 'Device' },
            { key: 'scroll_percent', label: 'Scroll', render: (row) => formatPercent(row.scroll_percent, 0) },
            { key: 'time_on_page', label: 'Tempo', render: (row) => formatDuration(row.time_on_page) },
            { key: 'lead_created', label: 'Lead', render: (row) => (row.lead_created ? 'Sim' : 'Nao') },
            { key: 'error', label: 'Erro', render: (row) => row.error || '-' },
          ],
          filtered
        )}
      </section>
    </section>
  `;
};

const renderDataTable = (columns, rows) => {
  if (!Array.isArray(rows) || !rows.length) {
    return '<div class="li-empty">Ainda sem dados suficientes neste recorte.</div>';
  }

  return `
    <div class="li-table-shell">
      <table class="li-table">
        <thead>
          <tr>
            ${columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  ${columns
                    .map((column) => {
                      if (typeof column.renderHtml === 'function') {
                        return `<td>${column.renderHtml(row) || '-'}</td>`;
                      }
                      const raw = typeof column.render === 'function' ? column.render(row) : row[column.key];
                      return `<td>${escapeHtml(raw ?? '-')}</td>`;
                    })
                    .join('')}
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
};

const renderLeadsTable = (leads) => {
  if (!Array.isArray(leads) || !leads.length) {
    return '<div class="li-empty">Nenhum lead capturado no periodo selecionado.</div>';
  }

  return `
    <div class="li-table-shell">
      <table class="li-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Lead</th>
            <th>Contato</th>
            <th>Origem</th>
            <th>Parceiro e trial</th>
            <th>Conversao</th>
            <th>Acoes</th>
          </tr>
        </thead>
        <tbody>
          ${leads
            .map(
              (lead) => `
                <tr>
                  <td>${escapeHtml(formatDateTime(lead.created_at))}</td>
                  <td>
                    <div class="li-table-stack">
                      <strong>${escapeHtml(lead.name || '-')}</strong>
                      <small>${escapeHtml(formatLeadCaptureLabel(lead))}</small>
                    </div>
                  </td>
                  <td>
                    <div class="li-table-stack">
                      <strong>WhatsApp</strong>
                      <small>${escapeHtml(lead.phone || (lead.is_partial ? 'Nao preservado no tracker antigo' : '-'))}</small>
                      <strong>Instagram</strong>
                      <small>${escapeHtml(lead.instagram || (lead.is_partial ? 'Nao preservado no tracker antigo' : '-'))}</small>
                    </div>
                  </td>
                  <td>
                    <div class="li-table-stack">
                      <strong>${escapeHtml(lead.source_label || '-')}</strong>
                      <small>Canal: ${escapeHtml(lead.channel || '-')}</small>
                      <small>Campanha: ${escapeHtml(lead.campaign || '-')}</small>
                    </div>
                  </td>
                  <td>
                    <div class="li-table-stack">
                      <strong>${escapeHtml(lead.partner_name || 'Sem parceiro')}</strong>
                      <small>Trial: ${escapeHtml(formatTrialDays(lead.partner_trial_days))}</small>
                      <small>${escapeHtml(lead.referral_code || '-')}</small>
                    </div>
                  </td>
                  <td>
                    <div class="li-table-stack">
                      <strong>${escapeHtml(lead.cta_label || '-')}</strong>
                      <small>Secao: ${escapeHtml(lead.section_label || '-')}</small>
                      <small>Device: ${escapeHtml(lead.device_label || '-')}</small>
                    </div>
                  </td>
                  <td>
                    <button class="li-btn li-btn--danger li-btn--small" type="button" data-lead-action="delete" data-lead-id="${escapeHtml(lead.id)}" ${state.deletingLeadId === lead.id ? 'disabled' : ''}>
                      ${state.deletingLeadId === lead.id ? 'Excluindo...' : 'Excluir'}
                    </button>
                  </td>
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
};

const renderSelectFilter = (id, label, options, current, scope = 'technical') => `
  <label class="li-select-filter">
    <span>${escapeHtml(label)}</span>
    <select ${scope === 'signup' ? `data-signup-filter="${escapeHtml(id)}"` : `data-technical-filter="${escapeHtml(id)}"`}>
      <option value="">Todos</option>
      ${options.map((option) => `<option value="${escapeHtml(option)}" ${option === current ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
    </select>
  </label>
`;

const renderHeader = () => {
  const meta = state.data?.meta || {};
  const filters = state.data?.filters || {};

  return `
    <header class="li-header">
      <div class="li-header-top">
        <div class="li-brand__logo">
          <img src="assets/img/logo.png" alt="Makerline" />
        </div>
        <div class="li-header-title">
          <p class="li-kicker">Analytics</p>
          <h1>Landing Insights</h1>
          <p class="li-subtitle">Performance da landing do Makerline</p>
        </div>
      </div>

      <div class="li-header-meta">
        <div class="li-meta"><span>URL da landing</span><strong>${escapeHtml(meta.landingUrl || 'landing.html')}</strong></div>
        <div class="li-meta"><span>Periodo</span><strong>${escapeHtml(filters.label || meta.selectedPeriod || '-')}</strong></div>
        <div class="li-meta"><span>Ultima atualizacao</span><strong>${escapeHtml(formatDateTime(meta.updatedAt || meta.generatedAt))}</strong></div>
        <div class="li-meta"><span>Fonte dos dados</span><strong>${escapeHtml(meta.dataSourceLabel || 'Novo tracker')}</strong></div>
      </div>

      <div class="li-toolbar-grid">
        <section class="li-toolbar-card">
          <div class="li-toolbar-card__head">
            <strong>Periodo</strong>
            <span>Escolha o recorte antes de comparar as metricas.</span>
          </div>
          <div class="li-periods">
            ${PERIOD_OPTIONS.map(
              (option) => `
                <button class="li-chip ${state.period === option.id ? 'is-active' : ''}" type="button" data-period="${escapeHtml(option.id)}">
                  ${escapeHtml(option.label)}
                </button>
              `
            ).join('')}
          </div>
          ${
            state.period === 'custom'
              ? `
                <div class="li-custom-range">
                  <label>
                    <span>De</span>
                    <input type="date" id="insights-date-from" value="${escapeHtml(state.dateFrom)}" />
                  </label>
                  <label>
                    <span>Ate</span>
                    <input type="date" id="insights-date-to" value="${escapeHtml(state.dateTo)}" />
                  </label>
                  <button class="li-btn li-btn--primary" type="button" data-action="apply-custom-range">Aplicar</button>
                </div>
              `
              : ''
          }
        </section>

        <section class="li-toolbar-card">
          <div class="li-toolbar-card__head">
            <strong>Acoes</strong>
            <span>Exportacao, limpeza e acesso rapido sem misturar com os filtros.</span>
          </div>
          <div class="li-toolbar-actions">
            <button class="li-btn li-btn--ghost" type="button" data-action="refresh">Atualizar</button>
            <button class="li-btn li-btn--ghost" type="button" data-action="export">Exportar CSV</button>
            <button class="li-btn li-btn--ghost" type="button" data-action="export-signups">Exportar pre-cadastros</button>
            <button class="li-btn li-btn--ghost" type="button" data-action="open-landing">Ver landing</button>
            <button class="li-btn li-btn--danger" type="button" data-action="cleanup-tests" ${state.cleanupLoading ? 'disabled' : ''}>
              ${state.cleanupLoading ? 'Limpando...' : 'Limpar dados de teste'}
            </button>
            <button class="li-btn li-btn--ghost" type="button" data-action="logout">Sair</button>
          </div>
        </section>
      </div>

      <section class="li-tab-panel">
        <div class="li-toolbar-card__head">
          <strong>Abas</strong>
          <span>Navegue entre visao geral, parceiros, comissoes e atualizacoes.</span>
        </div>
        <nav class="li-tabs" aria-label="Abas do tracker">
          ${TAB_OPTIONS.filter((tab) => VISIBLE_TAB_IDS.includes(tab.id)).map(
            (tab) => `
              <button class="li-tab ${state.activeTab === tab.id ? 'is-active' : ''}" type="button" data-tab="${escapeHtml(tab.id)}">
                ${escapeHtml(tab.label)}
              </button>
            `
          ).join('')}
        </nav>
      </section>
    </header>
  `;
};

const renderCurrentTab = () => {
  if (state.activeTab === 'funnel') return renderFunnel();
  if (state.activeTab === 'sections') return renderSections();
  if (state.activeTab === 'cta-form') return renderCtaForm();
  if (state.activeTab === 'acquisition') return renderAcquisition();
  if (state.activeTab === 'signups') return renderSignups();
  if (state.activeTab === 'partners') return renderPartners();
  if (state.activeTab === 'commissions') return renderCommissions();
  if (state.activeTab === 'updates') return renderUpdates();
  if (state.activeTab === 'events') return renderEvents();
  return renderOverview();
};

const renderEmpty = () => `
  <section class="li-panel li-panel--empty">
    <h2>Ainda nao ha dados suficientes</h2>
    <p>Abra a landing publica, gere algumas visitas reais e volte aqui. O painel passa a responder assim que os eventos entram no tracker.</p>
  </section>
`;

const render = () => {
  const { app } = getEls();
  if (!app) return;

  if (!state.auth) {
    app.innerHTML = renderLogin();
    return;
  }

  if (state.loading) {
    app.innerHTML = `
      <section class="li-loading">
        <div class="li-spinner"></div>
        <p>Carregando Landing Insights...</p>
      </section>
    `;
    return;
  }

  if (state.error) {
    app.innerHTML = `
      <section class="li-panel li-panel--empty">
        <h2>Nao consegui carregar o tracker</h2>
        <p>${escapeHtml(state.error)}</p>
      </section>
    `;
    return;
  }

  const hasData = Array.isArray(state.data?.overview?.cards) && state.data.overview.cards.length > 0;
  const showEmpty = !hasData && !STANDALONE_TABS.includes(state.activeTab);
  app.innerHTML = `
    ${renderHeader()}
    ${showEmpty ? renderEmpty() : renderCurrentTab()}
  `;
};

const buildRequestBody = () => ({
  token: state.auth?.token || '',
  period: state.period,
  dateFrom: state.dateFrom,
  dateTo: state.dateTo,
});

const loadData = async () => {
  if (!state.auth?.token) {
    state.loading = false;
    render();
    return;
  }

  state.loading = true;
  state.error = '';
  render();
  showMessage('');

  try {
    const response = await fetch('api/landing_insights.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildRequestBody()),
    });

    const { data, text } = await readApiResponse(response);
    if (!response.ok || !data || data.ok !== true) {
      if (response.status === 401 || response.status === 403) {
        clearAuth();
        state.auth = null;
        state.data = null;
        state.loading = false;
        state.error = '';
        state.authError = (data && data.error) || 'Sua sessao privada expirou. Entre novamente.';
        render();
        return;
      }

      state.error =
        (data && data.error) ||
        (text ? `Erro ao carregar insights: ${text}` : `Erro ao carregar insights (HTTP ${response.status || 0}).`);
      state.loading = false;
      render();
      return;
    }

    if (!state.dateFrom && data.filters?.dateFrom) state.dateFrom = data.filters.dateFrom;
    if (!state.dateTo && data.filters?.dateTo) state.dateTo = data.filters.dateTo;

    state.data = data;
    state.loading = false;
    render();
  } catch (error) {
    state.error = 'Nao consegui carregar os insights agora.';
    state.loading = false;
    render();
  }
};

const loginIntoTracker = async ({ email, password }) => {
  state.authSubmitting = true;
  state.authError = '';
  state.authInfo = '';
  render();

  try {
    const response = await fetch('api/landing_insights_auth.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'login',
        email,
        password,
        remember: false,
      }),
    });

    const { data, text } = await readApiResponse(response);
    if (!response.ok || !data || data.ok !== true || !saveAuth(data)) {
      state.authSubmitting = false;
      state.authError =
        (data && data.error) ||
        (text ? `Erro ao autenticar: ${text}` : `Erro ao autenticar no tracker (HTTP ${response.status || 0}).`);
      render();
      return;
    }

    state.authSubmitting = false;
    state.auth = readSavedAuth();
    state.data = null;
    state.error = '';
    state.authError = '';
    state.authInfo = 'Acesso privado liberado.';
    await loadData();
  } catch (error) {
    state.authSubmitting = false;
    state.authError = 'Nao consegui autenticar no tracker agora.';
    render();
  }
};

const logoutTracker = async () => {
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
  state.data = null;
  state.error = '';
  state.loading = false;
  state.authSubmitting = false;
  state.authError = '';
  state.authInfo = 'Sessao privada encerrada.';
  render();
};

const exportLeads = () => {
  const leads = Array.isArray(state.data?.leads) ? state.data.leads : [];
  if (!leads.length) {
    showMessage('Ainda nao ha leads para exportar.', 'is-warning');
    return;
  }

  const headers = ['data', 'nome', 'whatsapp', 'instagram', 'canal', 'origem', 'parceiro', 'trial_dias', 'campanha', 'cta', 'secao', 'status'];
  const rows = leads.map((lead) => [
    lead.created_at || '',
    lead.name || '',
    lead.phone || '',
    lead.instagram || '',
    lead.channel || '',
    lead.source_label || '',
    lead.partner_name || '',
    lead.partner_trial_days || '',
    lead.campaign || '',
    lead.cta_label || '',
    lead.section_label || '',
    lead.status_label || '',
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `makerline-landing-insights-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showMessage('CSV exportado com sucesso.', 'is-success');
};

const exportSignups = () => {
  const leads = Array.isArray(state.data?.leads) ? state.data.leads : [];
  if (!leads.length) {
    showMessage('Ainda nao ha pre-cadastros para exportar.', 'is-warning');
    return;
  }

  const headers = [
    'id',
    'data',
    'nome',
    'whatsapp',
    'instagram',
    'instagram_username',
    'instagram_url',
    'parceiro',
    'origem',
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'cta_id',
    'section_id',
    'visitor_id',
    'session_id',
    'device',
    'status',
    'data_source',
  ];
  const rows = leads.map((lead) => [
    lead.id || '',
    lead.created_at || '',
    lead.name || '',
    lead.phone || '',
    lead.instagram || '',
    lead.instagram_username || '',
    lead.instagram_url || '',
    lead.partner_name || '',
    lead.source_label || '',
    lead.utm_source || '',
    lead.utm_medium || '',
    lead.campaign || '',
    lead.cta_id || '',
    lead.section_id || '',
    lead.visitor_id || '',
    lead.session_id || '',
    lead.device_label || '',
    lead.status_label || '',
    lead.data_source || '',
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `makerline-pre-cadastros-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showMessage('Pre-cadastros exportados com sucesso.', 'is-success');
};

const cleanupTestData = async () => {
  if (!state.auth?.token) return;

  state.cleanupLoading = true;
  render();
  showMessage('');

  try {
    const response = await fetch('api/landing_insights_cleanup.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: state.auth.token }),
    });

    const { data, text } = await readApiResponse(response);
    if (!response.ok || !data || data.ok !== true) {
      showMessage(
        (data && data.error) ||
          (text ? `Erro ao limpar dados de teste: ${text}` : `Erro HTTP ${response.status || 0}.`),
        'is-error'
      );
      state.cleanupLoading = false;
      render();
      return;
    }

    state.cleanupLoading = false;
    await loadData();
    showMessage(
      `Dados de teste removidos: ${formatNumber(data.deletedEvents || 0)} eventos e ${formatNumber(data.deletedLeads || 0)} leads.`,
      'is-success'
    );
  } catch (error) {
    state.cleanupLoading = false;
    showMessage('Nao consegui limpar os dados de teste agora.', 'is-error');
    render();
  }
};

const loadCommissions = async ({ force = false } = {}) => {
  if (!state.auth?.token) return;
  if (state.commissions.loaded && !force) return;

  state.commissions.loading = true;
  state.commissions.error = '';
  render();

  try {
    const response = await fetch('api/admin_tracker_commissions.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: state.auth.token }),
    });

    const { data, text } = await readApiResponse(response);
    if (!response.ok || !data || data.ok !== true) {
      state.commissions.loading = false;
      state.commissions.error =
        (data && data.error) || (text ? `Erro ao carregar comissoes: ${text}` : `Erro HTTP ${response.status || 0}.`);
      render();
      return;
    }

    state.commissions.data = data;
    state.commissions.loaded = true;
    state.commissions.loading = false;
    render();
  } catch (error) {
    state.commissions.loading = false;
    state.commissions.error = 'Nao consegui carregar as comissoes agora.';
    render();
  }
};

const loadUpdates = async ({ force = false } = {}) => {
  if (!state.auth?.token) return;
  if (state.updates.loaded && !force) return;

  state.updates.loading = true;
  state.updates.error = '';
  render();

  try {
    const response = await fetch('api/admin_tracker_updates.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: state.auth.token, action: 'list' }),
    });

    const { data, text } = await readApiResponse(response);
    if (!response.ok || !data || data.ok !== true) {
      state.updates.loading = false;
      state.updates.error =
        (data && data.error) || (text ? `Erro ao carregar atualizacoes: ${text}` : `Erro HTTP ${response.status || 0}.`);
      render();
      return;
    }

    state.updates.items = Array.isArray(data.updates) ? data.updates : [];
    state.updates.loaded = true;
    state.updates.loading = false;
    render();
  } catch (error) {
    state.updates.loading = false;
    state.updates.error = 'Nao consegui carregar as atualizacoes agora.';
    render();
  }
};

const submitNewUpdate = async () => {
  const message = state.updates.draft.trim();
  if (!state.auth?.token || !message || state.updates.submitting) return;

  state.updates.submitting = true;
  render();

  try {
    const response = await fetch('api/admin_tracker_updates.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: state.auth.token, action: 'create', message }),
    });

    const { data, text } = await readApiResponse(response);
    if (!response.ok || !data || data.ok !== true) {
      state.updates.submitting = false;
      showMessage(
        (data && data.error) || (text ? `Erro ao publicar: ${text}` : `Erro HTTP ${response.status || 0}.`),
        'is-error'
      );
      render();
      return;
    }

    state.updates.items = [data.update, ...state.updates.items];
    state.updates.draft = '';
    state.updates.submitting = false;
    render();
    showMessage('Atualizacao publicada.', 'is-success');
  } catch (error) {
    state.updates.submitting = false;
    showMessage('Nao consegui publicar a atualizacao agora.', 'is-error');
    render();
  }
};

const saveEditedUpdate = async (id) => {
  const message = state.updates.editDraft.trim();
  if (!state.auth?.token || !id || !message) return;

  try {
    const response = await fetch('api/admin_tracker_updates.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: state.auth.token, action: 'update', id, message }),
    });

    const { data, text } = await readApiResponse(response);
    if (!response.ok || !data || data.ok !== true) {
      showMessage(
        (data && data.error) || (text ? `Erro ao editar: ${text}` : `Erro HTTP ${response.status || 0}.`),
        'is-error'
      );
      return;
    }

    state.updates.items = state.updates.items.map((item) => (item.id === id ? data.update : item));
    state.updates.editingId = '';
    state.updates.editDraft = '';
    render();
    showMessage('Atualizacao editada.', 'is-success');
  } catch (error) {
    showMessage('Nao consegui editar a atualizacao agora.', 'is-error');
  }
};

const deleteUpdateEntry = async (id) => {
  if (!state.auth?.token || !id) return;
  const confirmed = window.confirm('Apagar essa atualizacao permanentemente?');
  if (!confirmed) return;

  try {
    const response = await fetch('api/admin_tracker_updates.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: state.auth.token, action: 'delete', id }),
    });

    const { data, text } = await readApiResponse(response);
    if (!response.ok || !data || data.ok !== true) {
      showMessage(
        (data && data.error) || (text ? `Erro ao apagar: ${text}` : `Erro HTTP ${response.status || 0}.`),
        'is-error'
      );
      return;
    }

    state.updates.items = state.updates.items.filter((item) => item.id !== id);
    render();
    showMessage('Atualizacao apagada.', 'is-success');
  } catch (error) {
    showMessage('Nao consegui apagar a atualizacao agora.', 'is-error');
  }
};

const updateLeadStatus = async (leadId, status) => {
  if (!state.auth?.token || !leadId || !status) return;

  state.leadStatusLoading = leadId;
  render();
  showMessage('');

  try {
    const response = await fetch('api/landing_waitlist_status.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: state.auth.token,
        leadId,
        status,
      }),
    });

    const { data, text } = await readApiResponse(response);
    if (!response.ok || !data || data.ok !== true) {
      state.leadStatusLoading = '';
      showMessage(
        (data && data.error) ||
          (text ? `Erro ao atualizar status: ${text}` : `Erro HTTP ${response.status || 0}.`),
        'is-error'
      );
      render();
      return;
    }

    const leads = Array.isArray(state.data?.leads) ? state.data.leads : [];
    const nextLeads = leads.map((lead) =>
      lead.id === leadId
        ? {
            ...lead,
            status,
            status_label: data.lead?.leadStatus
              ? {
                  new: 'Novo',
                  contacted: 'Contatado',
                  qualified: 'Qualificado',
                  discarded: 'Descartado',
                  client: 'Cliente',
                }[data.lead.leadStatus] || lead.status_label
              : lead.status_label,
          }
        : lead
    );

    state.data = { ...state.data, leads: nextLeads };
    state.leadStatusLoading = '';
    render();
    showMessage('Status do lead atualizado.', 'is-success');
  } catch (error) {
    state.leadStatusLoading = '';
    showMessage('Nao consegui atualizar o status do lead.', 'is-error');
    render();
  }
};

const deleteLead = async (leadId) => {
  if (!state.auth?.token || !leadId) return;
  state.deletingLeadId = leadId;
  render();
  showMessage('');

  try {
    const response = await fetch('api/landing_waitlist_delete.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: state.auth.token,
        leadId,
      }),
    });

    const { data, text } = await readApiResponse(response);
    if (!response.ok || !data || data.ok !== true) {
      state.deletingLeadId = '';
      showMessage((data && data.error) || (text ? `Erro ao excluir lead: ${text}` : 'Erro ao excluir lead.'), 'is-error');
      render();
      return;
    }

    state.deletingLeadId = '';
    await loadData();
    showMessage('Pre-cadastro excluido permanentemente.', 'is-success');
  } catch (error) {
    state.deletingLeadId = '';
    showMessage('Nao consegui excluir o pre-cadastro.', 'is-error');
    render();
  }
};

document.addEventListener('submit', (event) => {
  if (event.target?.id !== 'landing-insights-login-form') return;
  event.preventDefault();

  const formData = new FormData(event.target);
  loginIntoTracker({
    email: String(formData.get('email') || '').trim(),
    password: String(formData.get('password') || ''),
  });
});

document.addEventListener('click', (event) => {
  const action = event.target.closest('[data-action]')?.getAttribute('data-action') || '';
  if (action) {
    if (action === 'back') {
      window.location.href = 'app.html';
      return;
    }
    if (action === 'refresh') {
      loadData();
      return;
    }
    if (action === 'export') {
      exportLeads();
      return;
    }
    if (action === 'export-signups') {
      exportSignups();
      return;
    }
    if (action === 'open-landing') {
      window.open('landing.html', '_blank', 'noopener,noreferrer');
      return;
    }
    if (action === 'cleanup-tests') {
      const confirmed = window.confirm('Limpar eventos e leads marcados como teste?');
      if (!confirmed) return;
      cleanupTestData();
      return;
    }
    if (action === 'apply-custom-range') {
      const from = document.getElementById('insights-date-from')?.value || '';
      const to = document.getElementById('insights-date-to')?.value || '';
      state.dateFrom = from;
      state.dateTo = to;
      loadData();
      return;
    }
    if (action === 'logout') {
      logoutTracker();
      return;
    }
    if (action === 'reload-commissions') {
      loadCommissions({ force: true });
      return;
    }
    if (action === 'publish-update') {
      submitNewUpdate();
      return;
    }
  }

  const updateAction = event.target.closest('[data-update-action]')?.getAttribute('data-update-action') || '';
  const updateId = event.target.closest('[data-update-action]')?.getAttribute('data-update-id') || '';
  if (updateAction && updateId) {
    if (updateAction === 'edit') {
      const item = state.updates.items.find((entry) => entry.id === updateId);
      if (!item) return;
      state.updates.editingId = updateId;
      state.updates.editDraft = item.message;
      render();
      return;
    }
    if (updateAction === 'cancel-edit') {
      state.updates.editingId = '';
      state.updates.editDraft = '';
      render();
      return;
    }
    if (updateAction === 'save') {
      saveEditedUpdate(updateId);
      return;
    }
    if (updateAction === 'delete') {
      deleteUpdateEntry(updateId);
      return;
    }
  }

  const tabId = event.target.closest('[data-tab]')?.getAttribute('data-tab');
  if (tabId) {
    state.activeTab = tabId;
    render();
    if (tabId === 'commissions') loadCommissions();
    if (tabId === 'updates') loadUpdates();
    return;
  }

  const period = event.target.closest('[data-period]')?.getAttribute('data-period');
  if (period) {
    state.period = period;
    if (period !== 'custom') {
      state.dateFrom = '';
      state.dateTo = '';
      loadData();
    } else {
      const filters = state.data?.filters || {};
      state.dateFrom = filters.dateFrom || formatDate(new Date());
      state.dateTo = filters.dateTo || formatDate(new Date());
      render();
    }
  }

  const leadAction = event.target.closest('[data-lead-action]')?.getAttribute('data-lead-action') || '';
  const leadActionId = event.target.closest('[data-lead-action]')?.getAttribute('data-lead-id') || '';
  if (leadAction && leadActionId) {
    const lead = (state.data?.leads || []).find((item) => item.id === leadActionId);
    if (!lead) return;

    if (leadAction === 'copy') {
      copyText([lead.name, lead.phone, lead.instagram || ''].filter(Boolean).join(' | ')).then((ok) => {
        showMessage(ok ? 'Contato copiado.' : 'Nao consegui copiar o contato.', ok ? 'is-success' : 'is-error');
      });
      return;
    }

    if (leadAction === 'contacted') {
      updateLeadStatus(leadActionId, 'contacted');
      return;
    }

    if (leadAction === 'delete') {
      const suffix = lead.is_partial
        ? ' Este registro historico sera removido das contagens de leads, mas as views e sessoes serao mantidas.'
        : '';
      const confirmed = window.confirm(`Excluir permanentemente o pre-cadastro de ${lead.name || 'este lead'}?${suffix}`);
      if (!confirmed) return;
      deleteLead(leadActionId);
      return;
    }
  }
});

document.addEventListener('change', (event) => {
  const technicalFilter = event.target.getAttribute('data-technical-filter');
  if (technicalFilter) {
    state.technicalFilters[technicalFilter] = event.target.value;
    render();
    return;
  }

  const technicalToggle = event.target.getAttribute('data-technical-toggle');
  if (technicalToggle) {
    state.technicalFilters[technicalToggle] = Boolean(event.target.checked);
    render();
    return;
  }

  const signupFilter = event.target.getAttribute('data-signup-filter');
  if (signupFilter) {
    state.signupFilters[signupFilter] = event.target.value;
    render();
  }
});

document.addEventListener('input', (event) => {
  if (event.target.id === 'update-draft-input') {
    state.updates.draft = event.target.value;
    return;
  }

  const editId = event.target.getAttribute('data-update-edit-input');
  if (editId) {
    state.updates.editDraft = event.target.value;
    return;
  }

  const signupFilter = event.target.getAttribute('data-signup-filter');
  if (!signupFilter) return;
  state.signupFilters[signupFilter] = event.target.value;
  render();
});

if (state.auth?.token) {
  loadData();
} else {
  render();
}
