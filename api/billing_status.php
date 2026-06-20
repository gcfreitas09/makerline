<?php
// api/billing_status.php
require_once __DIR__ . '/billing_common.php';

billing_require_post();
$body = billing_read_json_body();
$user = billing_authenticate_user_from_token($body['token'] ?? '');

if (billing_is_stripe_enabled()) {
    $client = stripe_client();
    if ($client instanceof \Stripe\StripeClient) {
        $checkoutSessionId = trim((string)($body['checkoutSessionId'] ?? ''));
        if ($checkoutSessionId !== '') {
            $user = billing_sync_user_from_checkout_session($user, $client, $checkoutSessionId);
        }
        $user = billing_sync_user_from_stripe($user, $client);
    }
}

$billing = billing_snapshot_from_user($user, billing_is_stripe_enabled());
billing_respond(200, ['ok' => true, 'billing' => $billing]);
