<?php
// api/tracker_commissions.php
// Lista usuarios que vieram de link de parceiro, o plano que assinaram e a comissao gerada.
// So leitura: cruza ugc_users (referredBy) com o ledger real de comissoes (partner_commissions),
// nao recalcula nem inventa valores.

ini_set('display_errors', '0');
error_reporting(0);

require_once __DIR__ . '/users_store.php';
require_once __DIR__ . '/landing_insights_access.php';
require_once __DIR__ . '/referrals.php';
require_once __DIR__ . '/billing_common.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

function tracker_commissions_respond($status, $data = [])
{
    http_response_code((int)$status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function tracker_commissions_str($value, $fallback = '')
{
    if (!is_scalar($value)) return $fallback;
    $safe = trim((string)$value);
    return $safe !== '' ? $safe : $fallback;
}

function tracker_commissions_plan_label($planCode, $billingInterval)
{
    $safePlan = strtolower(tracker_commissions_str($planCode, ''));
    if ($safePlan === 'annual' || $billingInterval === 'year') return 'Anual';
    if ($safePlan === 'monthly' || $billingInterval === 'month') return 'Mensal';
    return null;
}

function tracker_commissions_load_ledger_rows()
{
    $table = referrals_table_partner_commissions();
    if (!function_exists('supabase_client_request')) return [];

    $rows = [];
    $offset = 0;
    $pageSize = 500;

    while (true) {
        $response = supabase_client_request('GET', $table, [
            'select' => 'user_id,user_email,partner_code,referral_code,plan_code,billing_interval,commission_amount_cents,amount_paid_cents,payout_status,paid_at',
            'order' => 'paid_at.desc',
            'limit' => (string)$pageSize,
            'offset' => (string)$offset,
        ], null);

        if (($response['ok'] ?? false) !== true) break;
        $batch = is_array($response['data'] ?? null) ? $response['data'] : [];
        foreach ($batch as $row) {
            if (is_array($row)) $rows[] = $row;
        }
        if (count($batch) < $pageSize) break;
        $offset += $pageSize;
    }

    return $rows;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    tracker_commissions_respond(405, ['ok' => false, 'error' => 'Metodo nao permitido']);
}

if (users_store_backend() === 'error') {
    tracker_commissions_respond(500, ['ok' => false, 'error' => users_store_last_error() ?: 'Banco configurado, mas nao esta pronto ainda.']);
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) $body = [];

$token = trim((string)($body['token'] ?? ''));
$auth = landing_private_authenticate_token($token);
if (empty($auth['ok'])) {
    tracker_commissions_respond((int)($auth['status'] ?? 401), [
        'ok' => false,
        'error' => $auth['error'] ?? 'Sessao privada invalida.',
    ]);
}

$allUsers = users_store_load_all();
$allUsers = is_array($allUsers) ? $allUsers : [];

$ledgerRows = tracker_commissions_load_ledger_rows();

// Agrupa as comissoes ja registradas por usuario (um usuario pode ter varias, uma por fatura paga).
$commissionsByUser = [];
foreach ($ledgerRows as $row) {
    $userId = tracker_commissions_str($row['user_id'] ?? '', '');
    $userEmail = strtolower(tracker_commissions_str($row['user_email'] ?? '', ''));
    $key = $userId !== '' ? 'id:' . $userId : ($userEmail !== '' ? 'email:' . $userEmail : '');
    if ($key === '') continue;

    if (!isset($commissionsByUser[$key])) {
        $commissionsByUser[$key] = [
            'totalCents' => 0,
            'count' => 0,
            'lastPaidAt' => '',
            'lastPlanCode' => '',
            'lastBillingInterval' => '',
        ];
    }

    $commissionsByUser[$key]['totalCents'] += (int)($row['commission_amount_cents'] ?? 0);
    $commissionsByUser[$key]['count']++;
    $paidAt = tracker_commissions_str($row['paid_at'] ?? '', '');
    if ($paidAt !== '' && $paidAt > $commissionsByUser[$key]['lastPaidAt']) {
        $commissionsByUser[$key]['lastPaidAt'] = $paidAt;
        $commissionsByUser[$key]['lastPlanCode'] = tracker_commissions_str($row['plan_code'] ?? '', '');
        $commissionsByUser[$key]['lastBillingInterval'] = tracker_commissions_str($row['billing_interval'] ?? '', '');
    }
}

$partners = referrals_partners();
$partnerSummaries = [];
$codesPerPartner = [];
foreach ($partners as $partner) {
    // Uma mesma pessoa pode ter varios codigos de referral (ex.: Keila 30 dias e 15 dias) --
    // agrupa pelo partnerCode (a identidade real do parceiro) pra nao duplicar no filtro.
    $partnerCode = (string)($partner['partnerCode'] ?? $partner['code']);
    $codesPerPartner[$partnerCode] = ($codesPerPartner[$partnerCode] ?? 0) + 1;

    if (isset($partnerSummaries[$partnerCode])) continue;
    $partnerSummaries[$partnerCode] = [
        'code' => $partnerCode,
        'name' => (string)$partner['name'],
        'commissionPercent' => (int)$partner['commissionPercent'],
    ];
}

$rows = [];
$grandTotalCents = 0;
$payingUsersCount = 0;

foreach ($allUsers as $user) {
    if (!is_array($user)) continue;
    $referredBy = tracker_commissions_str($user['referredBy'] ?? '', '');
    if ($referredBy === '') continue;

    $partner = referrals_partner_by_code($referredBy);
    if (!$partner) continue;

    $userId = tracker_commissions_str($user['id'] ?? '', '');
    $userEmail = strtolower(tracker_commissions_str($user['email'] ?? '', ''));
    $key = $userId !== '' ? 'id:' . $userId : ($userEmail !== '' ? 'email:' . $userEmail : '');
    $commission = $commissionsByUser[$key] ?? null;

    $billingStatus = tracker_commissions_str($user['billingStatus'] ?? '', 'free');
    $planCode = $commission
        ? $commission['lastPlanCode']
        : billing_plan_from_price_or_product((string)($user['stripePriceId'] ?? ''), (string)($user['stripeProductId'] ?? ''));
    $billingInterval = $commission ? $commission['lastBillingInterval'] : tracker_commissions_str($user['billingInterval'] ?? '', '');
    $planLabel = tracker_commissions_plan_label($planCode, $billingInterval);

    $commissionTotalCents = $commission ? (int)$commission['totalCents'] : 0;
    if ($commissionTotalCents > 0) {
        $grandTotalCents += $commissionTotalCents;
        $payingUsersCount++;
    }

    $rowPartnerCode = (string)($partner['partnerCode'] ?? $partner['code']);
    // So mostra a variante do link (ex.: "15 dias" / "30 dias") quando o parceiro tem mais
    // de um codigo cadastrado -- pro Rick, que so tem um, isso fica vazio e o front nao mostra nada.
    $linkVariant = ($codesPerPartner[$rowPartnerCode] ?? 1) > 1
        ? (int)($partner['trialDays'] ?? 0) . ' dias'
        : '';

    $rows[] = [
        'userId' => $userId,
        'name' => tracker_commissions_str($user['name'] ?? '', 'Sem nome'),
        'email' => tracker_commissions_str($user['email'] ?? '', ''),
        'partnerCode' => $rowPartnerCode,
        'referralCode' => (string)$partner['code'],
        'partnerName' => (string)$partner['name'],
        'linkVariant' => $linkVariant,
        'createdAt' => tracker_commissions_str($user['createdAt'] ?? '', ''),
        'billingStatus' => $billingStatus,
        'planLabel' => $planLabel,
        'hasPaid' => $commissionTotalCents > 0,
        'commissionTotalCents' => $commissionTotalCents,
        'commissionCount' => $commission ? (int)$commission['count'] : 0,
        'lastPaidAt' => $commission ? $commission['lastPaidAt'] : '',
    ];
}

usort($rows, function ($a, $b) {
    if ($a['hasPaid'] !== $b['hasPaid']) return $b['hasPaid'] <=> $a['hasPaid'];
    return strcmp((string)$b['createdAt'], (string)$a['createdAt']);
});

tracker_commissions_respond(200, [
    'ok' => true,
    'meta' => [
        'generatedAt' => date('c'),
    ],
    'partners' => array_values($partnerSummaries),
    'rows' => $rows,
    'totals' => [
        'referredUsersCount' => count($rows),
        'payingUsersCount' => $payingUsersCount,
        'commissionTotalCents' => $grandTotalCents,
    ],
]);
