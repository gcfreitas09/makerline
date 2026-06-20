const COMMISSIONS_CACHE_KEY = 'ugcQuestAdminPartnerCommissionsCacheV1';
const COMMISSIONS_CACHE_TTL_MS = 5 * 60 * 1000;
const COMMISSIONS_ALLOWED_EMAILS = new Set(['fgui3662@gmail.com', 'lorenzo.ritter13@gmail.com']);

let commissionsRequest = null;
let commissionsLoaded = false;

const formatMoney = (cents, currency = 'BRL') =>
  (Number(cents || 0) / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: String(currency || 'BRL').toUpperCase()
  });

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const getSessionEmail = () => {
  try {
    return (sessionStorage.getItem('ugcQuestUserEmail') || '').trim().toLowerCase();
  } catch (error) {
    return '';
  }
};

const getSessionUserId = () => {
  try {
    return sessionStorage.getItem('ugcQuestUserId') || '';
  } catch (error) {
    return '';
  }
};

const getSessionToken = () => {
  try {
    return sessionStorage.getItem('ugcQuestToken') || '';
  } catch (error) {
    return '';
  }
};

const isAllowed = () => {
  const email = getSessionEmail();
  return Boolean(email && COMMISSIONS_ALLOWED_EMAILS.has(email));
};

const getEls = () => ({
  card: document.querySelector('[data-admin-commissions-card]'),
  status: document.querySelector('[data-admin-commissions-status]'),
  summary: document.querySelector('[data-admin-commissions-summary]'),
  recent: document.querySelector('[data-admin-commissions-recent]')
});

const setStatus = (text) => {
  const { status } = getEls();
  if (status) status.textContent = text || '';
};

const readCache = () => {
  try {
    const raw = sessionStorage.getItem(COMMISSIONS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (String(parsed.viewerId || '') !== String(getSessionUserId() || '')) return null;
    if ((Number(parsed.ts) || 0) <= 0 || Date.now() - Number(parsed.ts) > COMMISSIONS_CACHE_TTL_MS) return null;
    return parsed.payload || null;
  } catch (error) {
    return null;
  }
};

const writeCache = (payload) => {
  try {
    sessionStorage.setItem(
      COMMISSIONS_CACHE_KEY,
      JSON.stringify({
        ts: Date.now(),
        viewerId: getSessionUserId(),
        payload
      })
    );
  } catch (error) {}
};

const renderSummary = (payload) => {
  const { summary, recent } = getEls();
  if (!summary || !recent) return;

  const totals = payload && typeof payload === 'object' ? payload.totals || {} : {};
  const summaryRows = Array.isArray(payload?.summary) ? payload.summary : [];
  const recentRows = Array.isArray(payload?.recent) ? payload.recent : [];

  summary.innerHTML = `
    <div class="admin-commissions-kpis">
      <div class="admin-commissions-kpi">
        <span>Receita rastreada</span>
        <strong>${formatMoney(totals.grossAmountCents || 0)}</strong>
      </div>
      <div class="admin-commissions-kpi">
        <span>Comissão total</span>
        <strong>${formatMoney(totals.commissionAmountCents || 0)}</strong>
      </div>
      <div class="admin-commissions-kpi">
        <span>Clientes pagantes</span>
        <strong>${Number(totals.payingClients || 0)}</strong>
      </div>
      <div class="admin-commissions-kpi">
        <span>Faturas pagas</span>
        <strong>${Number(totals.paidInvoices || 0)}</strong>
      </div>
    </div>
    <div class="admin-commissions-table-wrap">
      <table class="admin-commissions-table">
        <thead>
          <tr>
            <th>Mês</th>
            <th>Parceiro</th>
            <th>Clientes</th>
            <th>Faturas</th>
            <th>Receita</th>
            <th>Comissão</th>
          </tr>
        </thead>
        <tbody>
          ${
            summaryRows.length
              ? summaryRows
                  .map(
                    (row) => `
            <tr>
              <td>${escapeHtml(String(row.payout_month || '—'))}</td>
              <td>${escapeHtml(String(row.partner_name || row.partner_code || '—'))}</td>
              <td>${Number(row.paying_clients || 0)}</td>
              <td>${Number(row.paid_invoices || 0)}</td>
              <td>${formatMoney(row.gross_amount_cents || 0)}</td>
              <td>${formatMoney(row.commission_amount_cents || 0)}</td>
            </tr>`
                  )
                  .join('')
              : '<tr><td colspan="6">Nenhuma comissão registrada ainda.</td></tr>'
          }
        </tbody>
      </table>
    </div>
  `;

  recent.innerHTML = `
    <div class="admin-commissions-table-wrap">
      <table class="admin-commissions-table">
        <thead>
          <tr>
            <th>Pago em</th>
            <th>Parceiro</th>
            <th>Cliente</th>
            <th>Plano</th>
            <th>Valor</th>
            <th>Comissão</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${
            recentRows.length
              ? recentRows
                  .map(
                    (row) => `
            <tr>
              <td>${escapeHtml(String(row.paid_at || '—').slice(0, 10))}</td>
              <td>${escapeHtml(String(row.partner_name || row.partner_code || '—'))}</td>
              <td>${escapeHtml(String(row.user_email || '—'))}</td>
              <td>${escapeHtml(String(row.plan_code || row.billing_interval || '—'))}</td>
              <td>${formatMoney(row.amount_paid_cents || 0, row.currency || 'BRL')}</td>
              <td>${formatMoney(row.commission_amount_cents || 0, row.currency || 'BRL')}</td>
              <td>${escapeHtml(String(row.payout_status || 'pending'))}</td>
            </tr>`
                  )
                  .join('')
              : '<tr><td colspan="7">Nenhum lançamento recente.</td></tr>'
          }
        </tbody>
      </table>
    </div>
  `;
};

const initAdminPartnerCommissions = () => {
  const { card } = getEls();
  if (!card) return;

  if (!isAllowed()) {
    card.style.display = 'none';
    return;
  }

  card.style.display = 'block';
  const cached = readCache();
  if (cached) {
    renderSummary(cached);
    setStatus('Resumo carregado do cache desta sessão.');
  } else {
    setStatus('Carregando comissões dos parceiros...');
  }

  if (window.location.protocol === 'file:') return;
  if (commissionsLoaded || commissionsRequest) return;

  const token = getSessionToken();
  if (!token) return;

  commissionsRequest = fetch('api/admin_partner_commissions.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  })
    .then((res) =>
      res
        .json()
        .catch(() => null)
        .then((data) => ({ res, data }))
    )
    .then(({ res, data }) => {
      if (!res.ok || !data || data.ok !== true) {
        const message = data && data.error ? String(data.error) : 'Não consegui carregar as comissões agora.';
        setStatus(message);
        return;
      }
      commissionsLoaded = true;
      writeCache(data);
      renderSummary(data);
      setStatus('Resumo mensal e lançamentos recentes sincronizados.');
    })
    .catch(() => {
      setStatus('Não consegui carregar as comissões agora.');
    })
    .finally(() => {
      commissionsRequest = null;
    });
};

export { initAdminPartnerCommissions };
