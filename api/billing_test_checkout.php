<?php
// api/billing_test_checkout.php
require_once __DIR__ . '/billing_common.php';

function billing_test_read_body()
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

function billing_test_wants_redirect($body)
{
    return billing_to_bool($body['redirect'] ?? false);
}

function billing_test_fail($status, $message, $wantsRedirect = false)
{
    if ($wantsRedirect) {
        http_response_code($status);
        header('Content-Type: text/html; charset=UTF-8');
        echo '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Erro no teste Stripe</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#07111f;color:#f8fafc;font:16px/1.5 Arial,sans-serif}.box{max-width:440px;padding:28px;text-align:center}.box p{color:#a8b5c7}</style></head><body><div class="box"><h1>Não foi possível abrir o teste.</h1><p>' . htmlspecialchars((string)$message, ENT_QUOTES, 'UTF-8') . '</p></div></body></html>';
        exit;
    }

    billing_respond($status, ['error' => $message]);
}

function billing_test_success($url, $wantsRedirect = false)
{
    $safeUrl = trim((string)$url);
    if ($safeUrl === '') {
        billing_test_fail(500, 'Checkout criado sem URL.', $wantsRedirect);
    }

    if ($wantsRedirect) {
        header('Location: ' . $safeUrl, true, 303);
        exit;
    }

    billing_respond(200, ['ok' => true, 'url' => $safeUrl]);
}

billing_require_post();
$body = billing_test_read_body();
$wantsRedirect = billing_test_wants_redirect($body);
$user = billing_authenticate_user_from_token($body['token'] ?? '');

if (!access_user_has_internal_access($user)) {
    billing_test_fail(403, 'Teste de cobrança disponível apenas para contas internas.', $wantsRedirect);
}

$config = billing_require_operational_config();
$client = billing_require_stripe_client();
$amount = stripe_normalize_test_amount_cents($config['test_payment_amount_cents'] ?? 50);
$email = trim((string)($user['email'] ?? ''));

try {
    $sessionPayload = [
        'mode' => 'payment',
        'payment_method_types' => ['card'],
        'client_reference_id' => (string)($user['id'] ?? ''),
        'line_items' => [[
            'price_data' => [
                'currency' => 'brl',
                'unit_amount' => $amount,
                'product_data' => [
                    'name' => 'Teste Stripe Makerline',
                    'description' => 'Cobrança real de validação técnica do checkout.'
                ]
            ],
            'quantity' => 1
        ]],
        'success_url' => stripe_path_to_url('/app.html?section=settings&billing=test_success&session_id={CHECKOUT_SESSION_ID}'),
        'cancel_url' => stripe_path_to_url('/app.html?section=settings&billing=test_cancel'),
        'metadata' => [
            'ugc_user_id' => (string)($user['id'] ?? ''),
            'ugc_payment_purpose' => 'live_stripe_test',
            'ugc_test_amount_cents' => (string)$amount
        ],
        'payment_intent_data' => [
            'metadata' => [
                'ugc_user_id' => (string)($user['id'] ?? ''),
                'ugc_payment_purpose' => 'live_stripe_test',
                'ugc_test_amount_cents' => (string)$amount
            ]
        ]
    ];
    if ($email !== '') {
        $sessionPayload['customer_email'] = $email;
    }

    $session = $client->checkout->sessions->create($sessionPayload);

    billing_test_success((string)($session->url ?? ''), $wantsRedirect);
} catch (Throwable $e) {
    error_log('[billing_test_checkout] ' . get_class($e) . ': ' . $e->getMessage());
    billing_test_fail(500, 'Não consegui abrir o checkout de teste agora. Em BRL, a Stripe exige pelo menos R$ 0,50 por cobrança com cartão.', $wantsRedirect);
}
