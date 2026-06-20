<?php
// api/billing_portal.php
require_once __DIR__ . '/billing_common.php';

billing_require_post();
$body = billing_read_json_body();
$user = billing_authenticate_user_from_token($body['token'] ?? '');
$config = billing_require_operational_config();
$client = billing_require_stripe_client();

$customerId = trim((string)($user['stripeCustomerId'] ?? ''));
if ($customerId === '') {
    billing_respond(409, ['error' => 'Ainda não encontramos uma assinatura para gerenciar nesta conta.']);
}

try {
    $portal = $client->billingPortal->sessions->create([
        'customer' => $customerId,
        'return_url' => stripe_path_to_url((string)($config['portal_return_path'] ?? UGC_STRIPE_DEFAULT_PORTAL_RETURN_PATH))
    ]);

    $url = trim((string)($portal->url ?? ''));
    if ($url === '') {
        billing_respond(500, ['error' => 'Portal criado sem URL de redirecionamento.']);
    }

    billing_respond(200, ['ok' => true, 'url' => $url]);
} catch (Throwable $e) {
    billing_respond(500, ['error' => 'Não consegui abrir o portal agora.']);
}
