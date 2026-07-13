<?php
// api/admin_tracker_commissions.php
// Resumo de comissoes de parceiros pro painel do tracker (landing-insights.html).
// Usa a sessao privada do proprio tracker (nao a sessao do app principal).

ini_set('display_errors', '0');
error_reporting(0);

require_once __DIR__ . '/users_store.php';
require_once __DIR__ . '/landing_insights_access.php';
require_once __DIR__ . '/supabase_client.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

function admin_tracker_commissions_respond($status, $data = [])
{
    http_response_code((int)$status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function admin_tracker_commissions_table($config, $key, $fallback)
{
    $value = is_array($config) ? trim((string)($config[$key] ?? '')) : '';
    return $value !== '' ? $value : $fallback;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    admin_tracker_commissions_respond(405, ['error' => 'Metodo nao permitido']);
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    admin_tracker_commissions_respond(400, ['error' => 'JSON invalido']);
}

$token = trim((string)($body['token'] ?? ''));
if ($token === '') {
    admin_tracker_commissions_respond(401, ['error' => 'Sessao privada invalida. Faz login de novo.']);
}

$auth = landing_private_authenticate_token($token);
if (empty($auth['ok'])) {
    admin_tracker_commissions_respond((int)($auth['status'] ?? 401), ['error' => $auth['error'] ?? 'Sessao invalida.']);
}

$config = supabase_config();
if (!$config || empty($config['enabled'])) {
    admin_tracker_commissions_respond(500, ['error' => 'Supabase nao esta configurado neste ambiente.']);
}

$summaryTable = admin_tracker_commissions_table($config, 'table_partner_commissions_monthly_view', 'partner_commissions_monthly');
$commissionsTable = admin_tracker_commissions_table($config, 'table_partner_commissions', 'partner_commissions');

$summaryRes = supabase_client_request(
    'GET',
    $summaryTable,
    ['select' => '*', 'order' => 'payout_month.desc,partner_name.asc', 'limit' => 24],
    null
);

if (empty($summaryRes['ok'])) {
    $status = (int)($summaryRes['status'] ?? 500);
    $error = (string)($summaryRes['error'] ?? '');
    if ($status === 404) {
        admin_tracker_commissions_respond(500, ['error' => 'A estrutura de parceiros ainda nao foi criada no Supabase. Rode o SQL de comissoes primeiro.']);
    }
    admin_tracker_commissions_respond(500, ['error' => $error !== '' ? $error : 'Nao consegui carregar o resumo de comissoes.']);
}

$recentRes = supabase_client_request(
    'GET',
    $commissionsTable,
    [
        'select' => 'id,paid_at,partner_name,partner_code,referral_code,user_email,plan_code,billing_interval,amount_paid_cents,commission_amount_cents,payout_status,currency',
        'order' => 'paid_at.desc',
        'limit' => 30
    ],
    null
);

if (empty($recentRes['ok'])) {
    $status = (int)($recentRes['status'] ?? 500);
    $error = (string)($recentRes['error'] ?? '');
    if ($status === 404) {
        admin_tracker_commissions_respond(500, ['error' => 'A tabela partner_commissions ainda nao existe no Supabase.']);
    }
    admin_tracker_commissions_respond(500, ['error' => $error !== '' ? $error : 'Nao consegui carregar os lancamentos de comissao.']);
}

$summaryRows = is_array($summaryRes['data']) ? $summaryRes['data'] : [];
$recentRows = is_array($recentRes['data']) ? $recentRes['data'] : [];

$totals = [
    'grossAmountCents' => 0,
    'commissionAmountCents' => 0,
    'platformAmountCents' => 0,
    'payingClients' => 0,
    'paidInvoices' => 0
];

$partnerBalancesByKey = [];

foreach ($summaryRows as $index => $row) {
    $grossAmount = (int)($row['gross_amount_cents'] ?? 0);
    $commissionAmount = (int)($row['commission_amount_cents'] ?? 0);
    $platformAmount = max(0, $grossAmount - $commissionAmount);
    $summaryRows[$index]['platform_net_amount_cents'] = $platformAmount;

    $totals['grossAmountCents'] += $grossAmount;
    $totals['commissionAmountCents'] += $commissionAmount;
    $totals['payingClients'] += (int)($row['paying_clients'] ?? 0);
    $totals['paidInvoices'] += (int)($row['paid_invoices'] ?? 0);

    $partnerKey = trim((string)($row['partner_code'] ?? $row['referral_code'] ?? $row['partner_name'] ?? 'sem-parceiro')) ?: 'sem-parceiro';

    if (!isset($partnerBalancesByKey[$partnerKey])) {
        $partnerBalancesByKey[$partnerKey] = [
            'partnerCode' => (string)($row['partner_code'] ?? $partnerKey),
            'partnerName' => (string)($row['partner_name'] ?? $partnerKey),
            'grossAmountCents' => 0,
            'commissionAmountCents' => 0,
            'payingClients' => 0,
            'paidInvoices' => 0,
            'latestPayoutMonth' => (string)($row['payout_month'] ?? '')
        ];
    }

    $partnerBalancesByKey[$partnerKey]['grossAmountCents'] += $grossAmount;
    $partnerBalancesByKey[$partnerKey]['commissionAmountCents'] += $commissionAmount;
    $partnerBalancesByKey[$partnerKey]['payingClients'] += (int)($row['paying_clients'] ?? 0);
    $partnerBalancesByKey[$partnerKey]['paidInvoices'] += (int)($row['paid_invoices'] ?? 0);
    if ((string)($row['payout_month'] ?? '') > (string)($partnerBalancesByKey[$partnerKey]['latestPayoutMonth'] ?? '')) {
        $partnerBalancesByKey[$partnerKey]['latestPayoutMonth'] = (string)($row['payout_month'] ?? '');
    }
}

$totals['platformAmountCents'] = max(0, $totals['grossAmountCents'] - $totals['commissionAmountCents']);

admin_tracker_commissions_respond(200, [
    'ok' => true,
    'summary' => $summaryRows,
    'recent' => $recentRows,
    'totals' => $totals,
    'balances' => array_values($partnerBalancesByKey),
]);
