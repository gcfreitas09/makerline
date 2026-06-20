<?php
// api/billing_checkout.php
require_once __DIR__ . '/billing_common.php';

function billing_checkout_read_body()
{
    $contentType = strtolower((string)($_SERVER['CONTENT_TYPE'] ?? ''));
    if (strpos($contentType, 'application/json') !== false) {
        return billing_read_json_body();
    }

    if (!empty($_POST) && is_array($_POST)) {
        return $_POST;
    }

    return billing_read_json_body();
}

function billing_checkout_wants_redirect($body)
{
    return billing_to_bool($body['redirect'] ?? false);
}

function billing_checkout_render_error($status, $message)
{
    http_response_code($status);
    header('Content-Type: text/html; charset=UTF-8');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('Pragma: no-cache');
    header('Expires: 0');

    $safeMessage = htmlspecialchars((string)$message, ENT_QUOTES, 'UTF-8');
    echo '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Erro no checkout</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f8fafc;color:#0f172a;font:16px/1.5 Arial,sans-serif}.box{max-width:420px;padding:32px 24px;text-align:center}.box strong{display:block;font-size:20px;margin-bottom:8px}.box p{margin:0 0 18px;color:#475569}.box button{border:0;border-radius:999px;padding:12px 18px;background:#0f172a;color:#fff;font:inherit;cursor:pointer}</style></head><body><div class="box"><strong>Não foi possível abrir o checkout.</strong><p>' . $safeMessage . '</p><button type="button" onclick="window.close()">Fechar</button></div></body></html>';
    exit;
}

function billing_checkout_fail($status, $message, $wantsRedirect = false)
{
    if ($wantsRedirect) {
        billing_checkout_render_error($status, $message);
    }

    billing_respond($status, ['error' => $message]);
}

function billing_checkout_success($url, $wantsRedirect = false)
{
    $safeUrl = trim((string)$url);
    if ($safeUrl === '') {
        billing_checkout_fail(500, 'Checkout criado sem URL de redirecionamento.', $wantsRedirect);
    }

    if ($wantsRedirect) {
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');
        header('Location: ' . $safeUrl, true, 303);
        exit;
    }

    billing_respond(200, ['ok' => true, 'url' => $safeUrl]);
}

function billing_checkout_authenticate_user($token, $wantsRedirect = false)
{
    if (users_store_backend() === 'error') {
        billing_checkout_fail(500, users_store_last_error() ?: 'Banco configurado, mas não está pronto ainda.', $wantsRedirect);
    }

    $token = trim((string)$token);
    if (strlen($token) < 10) {
        billing_checkout_fail(401, 'Sessão inválida. Faz login de novo.', $wantsRedirect);
    }

    $tokenHash = hash('sha256', $token);
    $user = users_store_find_by_session_token_hash($tokenHash);
    if (!$user || empty($user['id'])) {
        billing_checkout_fail(401, 'Sessão inválida. Faz login de novo.', $wantsRedirect);
    }

    $expires = (int)($user['sessionTokenExpires'] ?? 0);
    if ($expires && $expires < time()) {
        billing_checkout_fail(401, 'Sessão expirada. Faz login de novo.', $wantsRedirect);
    }

    return $user;
}

function billing_checkout_require_config($wantsRedirect = false)
{
    $config = stripe_config();
    if (!$config || empty($config['enabled'])) {
        billing_checkout_fail(500, 'Stripe ainda não está habilitado neste ambiente.', $wantsRedirect);
    }

    if (trim((string)($config['secret_key'] ?? '')) === '') {
        billing_checkout_fail(500, 'Falta secret_key em storage/stripe.json.', $wantsRedirect);
    }

    return $config;
}

function billing_checkout_require_client($wantsRedirect = false)
{
    $client = stripe_client();
    if ($client instanceof \Stripe\StripeClient) {
        return $client;
    }

    $info = stripe_last_info();
    $error = is_array($info) && !empty($info['error']) ? (string)$info['error'] : 'Stripe não configurado.';
    billing_checkout_fail(500, $error, $wantsRedirect);
}

function billing_checkout_should_sync_user($user, $maxAgeSeconds = 300)
{
    if (!$user || !is_array($user)) return false;

    $subscriptionId = trim((string)($user['stripeSubscriptionId'] ?? ''));
    $customerId = trim((string)($user['stripeCustomerId'] ?? ''));
    if ($subscriptionId === '' && $customerId === '') return false;

    $lastSyncedAt = trim((string)($user['billingLastSyncedAt'] ?? ''));
    if ($lastSyncedAt === '') return true;

    $lastSyncTimestamp = strtotime($lastSyncedAt);
    if (!$lastSyncTimestamp) return true;

    return (time() - $lastSyncTimestamp) >= max(0, (int)$maxAgeSeconds);
}

function billing_checkout_success_path_with_session($path)
{
    $safe = trim((string)$path);
    if ($safe === '') $safe = UGC_STRIPE_DEFAULT_SUCCESS_PATH;
    if (strpos($safe, '{CHECKOUT_SESSION_ID}') !== false) return $safe;

    $separator = strpos($safe, '?') === false ? '?' : '&';
    return $safe . $separator . 'session_id={CHECKOUT_SESSION_ID}';
}

billing_require_post();
$body = billing_checkout_read_body();
$wantsRedirect = billing_checkout_wants_redirect($body);
$user = billing_checkout_authenticate_user($body['token'] ?? '', $wantsRedirect);
$config = billing_checkout_require_config($wantsRedirect);
$client = billing_checkout_require_client($wantsRedirect);

$plan = trim((string)($body['plan'] ?? ''));
if (!in_array($plan, ['monthly', 'annual'], true)) {
    billing_checkout_fail(400, 'Plano inválido.', $wantsRedirect);
}

$priceId = billing_get_price_id_for_plan($plan);
if ($priceId === '') {
    billing_checkout_fail(500, 'O price do plano ainda não foi configurado.', $wantsRedirect);
}

if (billing_checkout_should_sync_user($user, 300)) {
    $user = billing_sync_user_from_stripe($user, $client);
}

$currentStatus = trim((string)($user['billingStatus'] ?? ''));
$customerId = trim((string)($user['stripeCustomerId'] ?? ''));
$subscriptionId = trim((string)($user['stripeSubscriptionId'] ?? ''));
$referralCode = referrals_code_for_checkout($user, $body['referralCode'] ?? ($body['ref'] ?? ''));
if ($referralCode && empty($user['referredBy'])) {
    users_store_update_by_id((string)($user['id'] ?? ''), ['referredBy' => $referralCode]);
    $user['referredBy'] = $referralCode;
}
$referralMetadata = referrals_metadata_for_code($referralCode);

if ($customerId !== '') {
    try {
        $portal = $client->billingPortal->sessions->create([
            'customer' => $customerId,
            'return_url' => stripe_path_to_url((string)($config['portal_return_path'] ?? UGC_STRIPE_DEFAULT_PORTAL_RETURN_PATH))
        ]);

        billing_checkout_success((string)($portal->url ?? ''), $wantsRedirect);
    } catch (Throwable $e) {
        billing_checkout_fail(500, 'Não consegui abrir o portal agora.', $wantsRedirect);
    }
}

try {
    $customerId = billing_ensure_customer_for_user($user, $client);

    $subscriptionData = [
        'metadata' => [
            'ugc_user_id' => (string)($user['id'] ?? ''),
            'ugc_plan' => $plan
        ] + $referralMetadata
    ];
    $referralTrialDays = referrals_trial_days_for_code($referralCode, 0);
    if ($referralTrialDays > 0) {
        $subscriptionData['trial_period_days'] = $referralTrialDays;
    }

    $session = $client->checkout->sessions->create([
        'mode' => 'subscription',
        'payment_method_types' => ['card'],
        'customer' => $customerId,
        'client_reference_id' => (string)($user['id'] ?? ''),
        'line_items' => [[
            'price' => $priceId,
            'quantity' => 1
        ]],
        'success_url' => stripe_path_to_url(billing_checkout_success_path_with_session($config['success_path'] ?? UGC_STRIPE_DEFAULT_SUCCESS_PATH)),
        'cancel_url' => stripe_path_to_url((string)($config['cancel_path'] ?? UGC_STRIPE_DEFAULT_CANCEL_PATH)),
        'metadata' => [
            'ugc_user_id' => (string)($user['id'] ?? ''),
            'ugc_plan' => $plan
        ] + $referralMetadata,
        'subscription_data' => $subscriptionData
    ]);

    billing_checkout_success((string)($session->url ?? ''), $wantsRedirect);
} catch (Throwable $e) {
    billing_checkout_fail(500, 'Não consegui abrir o checkout agora.', $wantsRedirect);
}
