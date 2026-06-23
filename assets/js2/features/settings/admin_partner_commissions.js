const COMMISSIONS_CACHE_KEY = 'ugcQuestAdminPartnerCommissionsCacheV3';
const COMMISSIONS_CACHE_TTL_MS = 5 * 60 * 1000;
const COMMISSIONS_ALLOWED_EMAILS = new Set(['fgui3662@gmail.com', 'lorenzo.ritter27@gmail.com']);

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

const removePrivateCard = (card) => {
  try {
    sessionStorage.removeItem(COMMISSIONS_CACHE_KEY);
  } catch (error) {}
  if (card) card.remove();
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

const buildPartnerBalancesFallback = (summaryRows) =>
  Object.values(
    summaryRows.reduce((acc, row) => {
      const code = String(row.partner_code || row.referral_code || row.partner_name || 'sem-parceiro');
      if (!acc[code]) {
        acc[code] = {
          partnerCode: code,
          partnerName: row.partner_name || row.partner_code || 'Sem parceiro',
          commissionAmountCents: 0,
          payingClients: 0,
          paidInvoices: 0,
          latestPayoutMonth: row.payout_month || ''
        };
      }
      acc[code].commissionAmountCents += Number(row.commission_amount_cents || 0);
      acc[code].payingClients += Number(row.paying_clients || 0);
      acc[code].paidInvoices += Number(row.paid_invoices || 0);
      if (String(row.payout_month || '') > String(acc[code].latestPayoutMonth || '')) {
        acc[code].latestPayoutMonth = row.payout_month || '';
      }
      return acc;
    }, {})
  );

const getPlatformNetFromMonthlyRow = (row) =>
  row.platform_net_amount_cents ?? Math.max(0, Number(row.gross_amount_cents || 0) - Number(row.commission_amount_cents || 0));

const getPlatformNetFromRecentRow = (row) =>
  row.platform_amount_cents ?? Math.max(0, Number(row.amount_paid_cents || 0) - Number(row.commission_amount_cents || 0));

const renderSummary = (payload) => {
  const { summary, recent } = getEls();
  if (!summary || !recent) return;

  const totals = payload && typeof payload === 'object' ? payload.totals || {} : {};
  const summaryRows = Array.isArray(payload?.summary) ? payload.summary : [];
  const recentRows = Array.isArray(payload?.recent) ? payload.recent : [];
  const balances = payload && typeof payload === 'object' && payload.balances && typeof payload.balances === 'object' ? payload.balances : {};
  const platformBalance = balances.platform && typeof balances.platform === 'object' ? balances.platform : {};
  const partnerBalances = Array.isArray(balances.partners) ? balances.partners : buildPartnerBalancesFallback(summaryRows);

  const grossAmount = Number(platformBalance.grossAmountCents ?? totals.grossAmountCents ?? 0);
  const partnerReserve = Number(platformBalance.partnerCommissionReserveCents ?? totals.commissionAmountCents ?? 0);
  const platformNet = Number(platformBalance.netPlatformAmountCents ?? totals.platformAmountCents ?? Math.max(0, grossAmount - partnerReserve));

  summary.innerHTML = `
    <div class="admin-ledger-grid">
      <section class="admin-ledger-panel">
        <div class="admin-ledger-head">
          <span>Saldo dos parceiros</span>
          <strong>${formatMoney(partnerReserve)}</strong>
          <p>Reserva exclusiva para comissões. Não entra no saldo a dividir entre os sócios.</p>
        </div>
        <div class="admin-commissions-table-wrap">
          <table class="admin-commissions-table admin-commissions-table--compact">
            <thead>
              <tr>
                <th>Parceiro</th>
                <th>Último mês</th>
                <th>Clientes</th>
                <th>Comissão a pagar</th>
              </tr>
            </thead>
            <tbody>
              ${
                partnerBalances.length
                  ? partnerBalances
                      .map(
                        (row) => `
              <tr>
                <td>${escapeHtml(String(row.partnerName || row.partner_name || row.partnerCode || row.partner_code || '-'))}</td>
                <td>${escapeHtml(String(row.latestPayoutMonth || row.payout_month || '-'))}</td>
                <td>${Number(row.payingClients || row.paying_clients || 0)}</td>
                <td>${formatMoney(row.commissionAmountCents ?? row.commission_amount_cents ?? 0)}</td>
              </tr>`
                      )
                      .join('')
                  : '<tr><td colspan="4">Nenhuma comissão de parceiro registrada ainda.</td></tr>'
              }
            </tbody>
          </table>
        </div>
      </section>

      <section class="admin-ledger-panel admin-ledger-panel--platform">
        <div class="admin-ledger-head">
          <span>Saldo da plataforma</span>
          <strong>${formatMoney(platformNet)}</strong>
          <p>Valor líquido depois de separar as comissões. Use este saldo para a divisão entre você e seu sócio.</p>
        </div>
        <div class="admin-commissions-kpis">
          <div class="admin-commissions-kpi">
            <span>Entrada Stripe</span>
            <strong>${formatMoney(grossAmount)}</strong>
          </div>
          <div class="admin-commissions-kpi">
            <span>Reserva parceiros</span>
            <strong>${formatMoney(partnerReserve)}</strong>
          </div>
          <div class="admin-commissions-kpi">
            <span>Saldo sócios</span>
            <strong>${formatMoney(platformNet)}</strong>
          </div>
          <div class="admin-commissions-kpi">
            <span>Faturas pagas</span>
            <strong>${Number(totals.paidInvoices || 0)}</strong>
          </div>
        </div>
      </section>
    </div>

    <h4 class="admin-commissions-section-title">Auditoria mensal</h4>
    <div class="admin-commissions-table-wrap">
      <table class="admin-commissions-table">
        <thead>
          <tr>
            <th>Mês</th>
            <th>Parceiro</th>
            <th>Clientes</th>
            <th>Faturas</th>
            <th>Entrada Stripe</th>
            <th>Comissão parceiro</th>
            <th>Saldo plataforma</th>
          </tr>
        </thead>
        <tbody>
          ${
            summaryRows.length
              ? summaryRows
                  .map(
                    (row) => `
            <tr>
              <td>${escapeHtml(String(row.payout_month || '-'))}</td>
              <td>${escapeHtml(String(row.partner_name || row.partner_code || '-'))}</td>
              <td>${Number(row.paying_clients || 0)}</td>
              <td>${Number(row.paid_invoices || 0)}</td>
              <td>${formatMoney(row.gross_amount_cents || 0)}</td>
              <td>${formatMoney(row.commission_amount_cents || 0)}</td>
              <td>${formatMoney(getPlatformNetFromMonthlyRow(row))}</td>
            </tr>`
                  )
                  .join('')
              : '<tr><td colspan="7">Nenhuma comissão registrada ainda.</td></tr>'
          }
        </tbody>
      </table>
    </div>
  `;

  recent.innerHTML = `
    <h4 class="admin-commissions-section-title">Últimos pagamentos separados</h4>
    <div class="admin-commissions-table-wrap">
      <table class="admin-commissions-table">
        <thead>
          <tr>
            <th>Pago em</th>
            <th>Parceiro</th>
            <th>Cliente</th>
            <th>Plano</th>
            <th>Entrada Stripe</th>
            <th>Comissão parceiro</th>
            <th>Saldo plataforma</th>
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
              <td>${escapeHtml(String(row.paid_at || '-').slice(0, 10))}</td>
              <td>${escapeHtml(String(row.partner_name || row.partner_code || '-'))}</td>
              <td>${escapeHtml(String(row.user_email || '-'))}</td>
              <td>${escapeHtml(String(row.plan_code || row.billing_interval || '-'))}</td>
              <td>${formatMoney(row.amount_paid_cents || 0, row.currency || 'BRL')}</td>
              <td>${formatMoney(row.commission_amount_cents || 0, row.currency || 'BRL')}</td>
              <td>${formatMoney(getPlatformNetFromRecentRow(row), row.currency || 'BRL')}</td>
              <td>${escapeHtml(String(row.payout_status || 'pending'))}</td>
            </tr>`
                  )
                  .join('')
              : '<tr><td colspan="8">Nenhum lançamento recente.</td></tr>'
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
    removePrivateCard(card);
    return;
  }

  card.style.display = 'grid';
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
      setStatus('Comissões e saldo da plataforma sincronizados separadamente.');
    })
    .catch(() => {
      setStatus('Não consegui carregar as comissões agora.');
    })
    .finally(() => {
      commissionsRequest = null;
    });
};

export { initAdminPartnerCommissions };
