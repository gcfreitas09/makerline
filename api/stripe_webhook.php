<?php
// api/stripe_webhook.php
require_once __DIR__ . '/billing_common.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    billing_respond(405, ['error' => 'Método não permitido']);
}

$config = stripe_config();
if (!$config || empty($config['enabled'])) {
    billing_respond(500, ['error' => 'Stripe não configurado.']);
}

$webhookSecret = trim((string)($config['webhook_secret'] ?? ''));
if ($webhookSecret === '') {
    billing_respond(500, ['error' => 'Falta webhook_secret em storage/stripe.json.']);
}

$client = billing_require_stripe_client();
if (!stripe_sdk_is_available()) {
    billing_respond(500, ['error' => 'SDK do Stripe não encontrado.']);
}

$payload = file_get_contents('php://input');
$signature = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';
if ($signature === '') {
    billing_respond(400, ['error' => 'Assinatura do webhook ausente.']);
}

try {
    $event = \Stripe\Webhook::constructEvent($payload, $signature, $webhookSecret);
} catch (\UnexpectedValueException $e) {
    billing_respond(400, ['error' => 'Payload inválido.']);
} catch (\Stripe\Exception\SignatureVerificationException $e) {
    billing_respond(400, ['error' => 'Assinatura inválida.']);
}

$type = trim((string)($event->type ?? ''));
$object = $event->data->object ?? null;
$user = billing_find_user_for_event_object($object);

if (!$user && in_array($type, ['invoice.payment_succeeded', 'invoice.payment_failed'], true) && $object) {
    $objectArray = method_exists($object, 'toArray') ? $object->toArray() : (array)$object;
    $customerId = (string)($objectArray['customer'] ?? '');
    $subscriptionId = (string)($objectArray['subscription'] ?? '');
    $user = billing_find_user_by_subscription_or_customer($subscriptionId, $customerId);
}

if (!$user || empty($user['id'])) {
    billing_respond(200, ['ok' => true, 'ignored' => true]);
}

try {
    switch ($type) {
        case 'checkout.session.completed':
            $session = $object;
            $sessionArray = method_exists($session, 'toArray') ? $session->toArray() : (array)$session;
            $customerId = (string)($sessionArray['customer'] ?? '');
            if ($customerId !== '') {
                billing_mark_customer_on_user((string)$user['id'], $customerId, (string)$event->id);
            }

            $subscriptionId = (string)($sessionArray['subscription'] ?? '');
            if ($subscriptionId !== '') {
                $subscription = $client->subscriptions->retrieve($subscriptionId, []);
                billing_apply_subscription_to_user((string)$user['id'], $subscription, (string)$event->id, $customerId);
            }
            break;

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
            billing_apply_subscription_to_user((string)$user['id'], $object, (string)$event->id, null);
            break;

        case 'invoice.payment_succeeded':
        case 'invoice.payment_failed':
            $invoiceArray = method_exists($object, 'toArray') ? $object->toArray() : (array)$object;
            $customerId = (string)($invoiceArray['customer'] ?? '');
            $subscriptionId = (string)($invoiceArray['subscription'] ?? '');

            if ($customerId !== '') {
                billing_mark_customer_on_user((string)$user['id'], $customerId, (string)$event->id);
            }

            if ($subscriptionId !== '') {
                $subscription = $client->subscriptions->retrieve($subscriptionId, []);
                billing_apply_subscription_to_user((string)$user['id'], $subscription, (string)$event->id, $customerId);
                if ($type === 'invoice.payment_succeeded') {
                    referrals_record_commission_from_invoice($user, $object, (string)$event->id, $subscription);
                }
            }
            break;
    }
} catch (Throwable $e) {
    billing_respond(500, ['error' => 'Falha ao processar webhook.']);
}

billing_respond(200, ['ok' => true]);
