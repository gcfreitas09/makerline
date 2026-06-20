<?php
// api/billing_diagnostics.php
require_once __DIR__ . '/billing_common.php';

billing_require_post();
$body = billing_read_json_body();
$user = billing_authenticate_user_from_token($body['token'] ?? '');

if (!access_user_has_internal_access($user)) {
    billing_respond(403, ['error' => 'Diagnóstico disponível apenas para contas internas.']);
}

$config = stripe_config();
$secret = trim((string)($config['secret_key'] ?? ''));
$mode = stripe_secret_key_mode($secret);

billing_respond(200, [
    'ok' => true,
    'stripe' => [
        'enabled' => (bool)($config['enabled'] ?? false),
        'mode' => $mode,
        'isLive' => strpos($mode, 'live') === 0,
        'secretKeyPresent' => $secret !== '',
        'publishableKeyPresent' => trim((string)($config['publishable_key'] ?? '')) !== '',
        'webhookSecretPresent' => trim((string)($config['webhook_secret'] ?? '')) !== '',
        'monthlyPriceConfigured' => trim((string)($config['price_monthly'] ?? '')) !== '',
        'annualPriceConfigured' => trim((string)($config['price_annual'] ?? '')) !== '',
        'testPaymentAmountCents' => stripe_normalize_test_amount_cents($config['test_payment_amount_cents'] ?? 50),
        'webhookUrl' => stripe_path_to_url('/api/stripe_webhook.php')
    ]
]);
