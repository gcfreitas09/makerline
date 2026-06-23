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
    echo '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Erro no checkout</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f8fafc;color:#0f172a;font:16px/1.5 Arial,sans-serif}.box{max-width:420px;padding:32px 24px;text-align:center}.box strong{display:block;font-size:20px;margin-bottom:8px}.box p{margin:0 0 18px;color:#475569}.box button{border:0;border-radius:999px;padding:12px 18px;background:#0f172a;color:#fff;font:inherit;cursor:pointer}</style></head><body><div class="box"><strong>Nao foi possivel abrir o checkout.</strong><p>' . $safeMessage . '</p><button type="button" onclick="window.close()">Fechar</button></div></body></html>';
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
        billing_checkout_fail(500, users_store_last_error() ?: 'Banco configurado, mas nao esta pronto ainda.', $wantsRedirect);
    }

    $token = trim((string)$token);
    if (strlen($token) < 10) {
        billing_checkout_fail(401, 'Sessao invalida. Faz login de novo.', $wantsRedirect);
    }

    $tokenHash = hash('sha256', $token);
    $user = users_store_find_by_session_token_hash($tokenHash);
    if (!$user || empty($user['id'])) {
        billing_checkout_fail(401, 'Sessao invalida. Faz login de novo.', $wantsRedirect);
    }

    $expires = (int)($user['sessionTokenExpires'] ?? 0);
    if ($expires && $expires < time()) {
        billing_checkout_fail(401, 'Sessao expirada. Faz login de novo.', $wantsRedirect);
    }

    return $user;
}

function billing_checkout_require_config($wantsRedirect = false)
{
    $config = stripe_config();
    if (!$config || empty($config['enabled'])) {
        billing_checkout_fail(500, 'Stripe ainda nao esta habilitado neste ambiente.', $wantsRedirect);
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
    $error = is_array($info) && !empty($info['error']) ? (string)$info['error'] : 'Stripe nao configurado.';
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

function billing_checkout_resolve_subscription_item_id($subscription)
{
    if ($subscription instanceof \Stripe\Subscription) {
        $data = $subscription->toArray();
    } elseif (is_object($subscription) && method_exists($subscription, 'toArray')) {
        $data = $subscription->toArray();
    } elseif (is_array($subscription)) {
        $data = $subscription;
    } else {
        $data = [];
    }

    $items = is_array($data['items']['data'] ?? null) ? $data['items']['data'] : [];
    $firstItem = is_array($items[0] ?? null) ? $items[0] : [];
    return trim((string)($firstItem['id'] ?? ''));
}

function billing_checkout_missing_stripe_object(Throwable $e)
{
    $message = strtolower($e->getMessage());
    return strpos($message, 'no such customer') !== false
        || strpos($message, 'no such subscription') !== false
        || strpos($message, 'no such price') !== false;
}

function billing_checkout_clear_stale_billing($userId)
{
    users_store_update_by_id((string)$userId, [
        'stripeCustomerId' => null,
        'stripeSubscriptionId' => null,
        'stripePriceId' => null,
        'stripeProductId' => null,
        'billingStatus' => 'free',
        'billingInterval' => null,
        'billingCurrentPeriodEnd' => null,
        'billingCancelAtPeriodEnd' => false,
        'billingLastSyncedAt' => date('c')
    ]);
}

function billing_checkout_ensure_valid_customer_for_user($user, $client)
{
    $existingCustomerId = trim((string)($user['stripeCustomerId'] ?? ''));
    if ($existingCustomerId !== '') {
        try {
            $customer = $client->customers->retrieve($existingCustomerId, []);
            if (empty($customer->deleted)) {
                return $existingCustomerId;
            }
        } catch (Throwable $e) {
            if (!billing_checkout_missing_stripe_object($e)) {
                throw $e;
            }
        }

        billing_checkout_clear_stale_billing((string)($user['id'] ?? ''));
        $user['stripeCustomerId'] = '';
        $user['stripeSubscriptionId'] = '';
    }

    return billing_ensure_customer_for_user($user, $client);
}

function billing_checkout_money_label($cents)
{
    return 'R$ ' . number_format(((int)$cents) / 100, 2, ',', '.');
}

function billing_checkout_annual_savings_message($client, $config)
{
    $monthlyPriceId = trim((string)($config['price_monthly'] ?? ''));
    $annualPriceId = trim((string)($config['price_annual'] ?? ''));
    if ($monthlyPriceId === '' || $annualPriceId === '') return '';

    try {
        $monthlyPrice = $client->prices->retrieve($monthlyPriceId, []);
        $annualPrice = $client->prices->retrieve($annualPriceId, []);
        $monthlyAmount = (int)($monthlyPrice->unit_amount ?? 0);
        $annualAmount = (int)($annualPrice->unit_amount ?? 0);
        $monthlyInterval = (string)($monthlyPrice->recurring->interval ?? '');
        $annualInterval = (string)($annualPrice->recurring->interval ?? '');
        if ($monthlyAmount <= 0 || $annualAmount <= 0 || $monthlyInterval !== 'month' || $annualInterval !== 'year') {
            return '';
        }

        $monthlyYearAmount = $monthlyAmount * 12;
        $savingsAmount = max(0, $monthlyYearAmount - $annualAmount);
        if ($savingsAmount <= 0) return '';

        $savingsPercent = (int)round(($savingsAmount / $monthlyYearAmount) * 100);
        return 'O plano anual custa ' . billing_checkout_money_label($annualAmount) . '/ano. Comparado ao mensal por 12 meses (' . billing_checkout_money_label($monthlyYearAmount) . '), voce economiza ' . billing_checkout_money_label($savingsAmount) . ' (' . $savingsPercent . '%). Para pegar o anual, volte e escolha Plano anual.';
    } catch (Throwable $e) {
        return '';
    }
}

function billing_checkout_partner_connect_account($config, $partner)
{
    if (!is_array($config) || !is_array($partner)) return '';

    $direct = trim((string)($partner['stripeAccountId'] ?? ($partner['stripe_account_id'] ?? '')));
    if ($direct !== '') return strpos($direct, 'acct_') === 0 ? $direct : '';

    $accounts = is_array($config['partner_connect_accounts'] ?? null) ? $config['partner_connect_accounts'] : [];
    if (!$accounts) return '';

    $identifiers = function_exists('referrals_partner_identifiers') ? referrals_partner_identifiers($partner) : [];
    $identifiers[] = referrals_normalize_code($partner['code'] ?? '');
    $identifiers[] = referrals_normalize_code($partner['partnerCode'] ?? '');
    $identifiers[] = trim(strtolower((string)($partner['email'] ?? '')));

    foreach (array_unique(array_filter($identifiers)) as $identifier) {
        if (!array_key_exists($identifier, $accounts)) continue;
        $value = $accounts[$identifier];
        $accountId = is_array($value)
            ? trim((string)($value['stripe_account_id'] ?? ($value['account_id'] ?? ($value['id'] ?? ''))))
            : trim((string)$value);
        if (strpos($accountId, 'acct_') === 0) return $accountId;
    }

    return '';
}

billing_require_post();
$body = billing_checkout_read_body();
$wantsRedirect = billing_checkout_wants_redirect($body);
$user = billing_checkout_authenticate_user($body['token'] ?? '', $wantsRedirect);
$config = billing_checkout_require_config($wantsRedirect);
$client = billing_checkout_require_client($wantsRedirect);

$plan = trim((string)($body['plan'] ?? ''));
if (!in_array($plan, ['monthly', 'annual'], true)) {
    billing_checkout_fail(400, 'Plano invalido.', $wantsRedirect);
}

$priceId = billing_get_price_id_for_plan($plan);
if ($priceId === '') {
    billing_checkout_fail(500, 'O price do plano ainda nao foi configurado.', $wantsRedirect);
}

if (billing_checkout_should_sync_user($user, 300)) {
    $user = billing_sync_user_from_stripe($user, $client);
}

$currentStatus = trim((string)($user['billingStatus'] ?? ''));
$customerId = trim((string)($user['stripeCustomerId'] ?? ''));
$subscriptionId = trim((string)($user['stripeSubscriptionId'] ?? ''));
$currentPlan = billing_plan_from_price_or_product((string)($user['stripePriceId'] ?? ''), (string)($user['stripeProductId'] ?? ''));
$referralCode = referrals_code_for_checkout($user, $body['referralCode'] ?? ($body['ref'] ?? ''));
if ($referralCode && empty($user['referredBy'])) {
    users_store_update_by_id((string)($user['id'] ?? ''), ['referredBy' => $referralCode]);
    $user['referredBy'] = $referralCode;
}
$referralPartner = $referralCode ? referrals_partner_by_code($referralCode) : null;
$referralMetadata = referrals_metadata_for_code($referralCode);
$partnerConnectAccountId = billing_checkout_partner_connect_account($config, $referralPartner);
$partnerCommissionPercent = $referralPartner ? max(0, min(100, (float)($referralPartner['commissionPercent'] ?? 0))) : 0;
if ($referralCode) {
    $referralMetadata['ugc_commission_mode'] = ($partnerConnectAccountId !== '' && $partnerCommissionPercent > 0)
        ? 'stripe_connect_transfer'
        : 'ledger_only';
    if ($partnerConnectAccountId !== '') {
        $referralMetadata['ugc_stripe_partner_account_id'] = $partnerConnectAccountId;
    }
}

if ($customerId !== '' && $subscriptionId !== '' && billing_is_manageable_status($currentStatus)) {
    if ($currentPlan === $plan) {
        try {
            $portal = $client->billingPortal->sessions->create([
                'customer' => $customerId,
                'return_url' => stripe_path_to_url((string)($config['portal_return_path'] ?? UGC_STRIPE_DEFAULT_PORTAL_RETURN_PATH))
            ]);

            billing_checkout_success((string)($portal->url ?? ''), $wantsRedirect);
        } catch (Throwable $e) {
            billing_checkout_fail(500, 'Nao consegui abrir o portal agora.', $wantsRedirect);
        }
    }

    try {
        $subscription = $client->subscriptions->retrieve($subscriptionId, []);
        $subscriptionItemId = billing_checkout_resolve_subscription_item_id($subscription);
        if ($subscriptionItemId === '') {
            billing_checkout_fail(500, 'Nao consegui localizar o item da assinatura para trocar o plano.', $wantsRedirect);
        }

        $updatePayload = [
            'items' => [[
                'id' => $subscriptionItemId,
                'price' => $priceId
            ]],
            'proration_behavior' => 'create_prorations',
            'metadata' => [
                'ugc_user_id' => (string)($user['id'] ?? ''),
                'ugc_plan' => $plan
            ] + $referralMetadata
        ];

        if ($partnerConnectAccountId !== '' && $partnerCommissionPercent > 0) {
            $updatePayload['transfer_data'] = [
                'destination' => $partnerConnectAccountId,
                'amount_percent' => $partnerCommissionPercent
            ];
        }

        $updatedSubscription = $client->subscriptions->update($subscriptionId, $updatePayload);
        billing_apply_subscription_to_user((string)($user['id'] ?? ''), $updatedSubscription, null, $customerId);

        $redirectUrl = stripe_path_to_url('/app.html?section=plans&billing=plan_updated&plan=' . rawurlencode($plan));
        billing_checkout_success($redirectUrl, $wantsRedirect);
    } catch (Throwable $e) {
        if (!billing_checkout_missing_stripe_object($e)) {
            billing_checkout_fail(500, 'Nao consegui trocar o plano agora.', $wantsRedirect);
        }

        billing_checkout_clear_stale_billing((string)($user['id'] ?? ''));
        $user = billing_refresh_user((string)($user['id'] ?? '')) ?: $user;
        $customerId = '';
        $subscriptionId = '';
    }
}

try {
    $customerId = billing_checkout_ensure_valid_customer_for_user($user, $client);

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
    if ($partnerConnectAccountId !== '' && $partnerCommissionPercent > 0) {
        $subscriptionData['transfer_data'] = [
            'destination' => $partnerConnectAccountId,
            'amount_percent' => $partnerCommissionPercent
        ];
    }

    $sessionPayload = [
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
    ];

    if ($plan === 'monthly') {
        $annualSavingsMessage = billing_checkout_annual_savings_message($client, $config);
        if ($annualSavingsMessage !== '') {
            $sessionPayload['custom_text'] = [
                'submit' => [
                    'message' => $annualSavingsMessage
                ]
            ];
        }
    }

    $session = $client->checkout->sessions->create($sessionPayload);

    billing_checkout_success((string)($session->url ?? ''), $wantsRedirect);
} catch (Throwable $e) {
    billing_checkout_fail(500, 'Nao consegui abrir o checkout agora.', $wantsRedirect);
}
