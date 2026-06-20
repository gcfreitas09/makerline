<?php
require_once __DIR__ . '/users_store.php';
require_once __DIR__ . '/supabase_client.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

function admin_partner_commissions_respond($status, $data = [])
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function admin_partner_commissions_safe_email($value)
{
    return trim(strtolower((string)$value));
}

function admin_partner_commissions_allowed_emails()
{
    return [
        'fgui3662@gmail.com',
        'lorenzo.ritter13@gmail.com'
    ];
}

function admin_partner_commissions_table($config, $key, $fallback)
{
    $value = is_array($config) ? trim((string)($config[$key] ?? '')) : '';
    return $value !== '' ? $value : $fallback;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    admin_partner_commissions_respond(405, ['error' => 'Metodo nao permitido']);
}

if (users_store_backend() === 'error') {
    admin_partner_commissions_respond(500, ['error' => users_store_last_error() ?: 'Banco configurado, mas nao esta pronto ainda.']);
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    admin_partner_commissions_respond(400, ['error' => 'JSON invalido']);
}

$token = trim((string)($body['token'] ?? ''));
if (strlen($token) < 10) {
    admin_partner_commissions_respond(401, ['error' => 'Sessao invalida. Faz login de novo.']);
}

$user = users_store_find_by_session_token_hash(hash('sha256', $token));
if (!$user) {
    admin_partner_commissions_respond(401, ['error' => 'Sessao invalida. Faz login de novo.']);
}

$expires = (int)($user['sessionTokenExpires'] ?? 0);
if ($expires && $expires < time()) {
    admin_partner_commissions_respond(401, ['error' => 'Sessao expirada. Faz login de novo.']);
}

$email = admin_partner_commissions_safe_email($user['email'] ?? '');
if ($email === '' || !in_array($email, admin_partner_commissions_allowed_emails(), true)) {
    admin_partner_commissions_respond(403, ['error' => 'Sem permissao para ver isso.']);
}

$config = supabase_config();
if (!$config || empty($config['enabled'])) {
    admin_partner_commissions_respond(500, ['error' => 'Supabase nao esta configurado neste ambiente.']);
}

$summaryTable = admin_partner_commissions_table($config, 'table_partner_commissions_monthly_view', 'partner_commissions_monthly');
$commissionsTable = admin_partner_commissions_table($config, 'table_partner_commissions', 'partner_commissions');

$summaryRes = supabase_client_request(
    'GET',
    $summaryTable,
    ['select' => '*', 'order' => 'payout_month.desc,partner_name.asc', 'limit' => 12],
    null
);

if (empty($summaryRes['ok'])) {
    $status = (int)($summaryRes['status'] ?? 500);
    $error = (string)($summaryRes['error'] ?? '');
    if ($status === 404) {
        admin_partner_commissions_respond(500, ['error' => 'A estrutura de parceiros ainda nao foi criada no Supabase. Rode o SQL de comissoes primeiro.']);
    }
    admin_partner_commissions_respond(500, ['error' => $error !== '' ? $error : 'Nao consegui carregar o resumo de comissoes.']);
}

$recentRes = supabase_client_request(
    'GET',
    $commissionsTable,
    [
        'select' => 'id,paid_at,partner_name,partner_code,referral_code,user_email,plan_code,billing_interval,amount_paid_cents,commission_amount_cents,payout_status,currency',
        'order' => 'paid_at.desc',
        'limit' => 20
    ],
    null
);

if (empty($recentRes['ok'])) {
    $status = (int)($recentRes['status'] ?? 500);
    $error = (string)($recentRes['error'] ?? '');
    if ($status === 404) {
        admin_partner_commissions_respond(500, ['error' => 'A tabela partner_commissions ainda nao existe no Supabase.']);
    }
    admin_partner_commissions_respond(500, ['error' => $error !== '' ? $error : 'Nao consegui carregar os lancamentos de comissao.']);
}

$summaryRows = is_array($summaryRes['data']) ? $summaryRes['data'] : [];
$recentRows = is_array($recentRes['data']) ? $recentRes['data'] : [];

$totals = [
    'grossAmountCents' => 0,
    'commissionAmountCents' => 0,
    'payingClients' => 0,
    'paidInvoices' => 0
];

foreach ($summaryRows as $row) {
    $totals['grossAmountCents'] += (int)($row['gross_amount_cents'] ?? 0);
    $totals['commissionAmountCents'] += (int)($row['commission_amount_cents'] ?? 0);
    $totals['payingClients'] += (int)($row['paying_clients'] ?? 0);
    $totals['paidInvoices'] += (int)($row['paid_invoices'] ?? 0);
}

admin_partner_commissions_respond(200, [
    'ok' => true,
    'summary' => $summaryRows,
    'recent' => $recentRows,
    'totals' => $totals
]);
