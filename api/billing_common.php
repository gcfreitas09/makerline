<?php
// api/billing_common.php
require_once __DIR__ . '/users_store.php';
require_once __DIR__ . '/stripe.php';
require_once __DIR__ . '/referrals.php';

function billing_respond($status, $data = [])
{
    http_response_code($status);
    header('Content-Type: application/json; charset=UTF-8');
    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('Pragma: no-cache');
    header('Expires: 0');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function billing_require_post()
{
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method !== 'POST') {
        billing_respond(405, ['error' => 'Método não permitido']);
    }
}

function billing_read_json_body()
{
    return json_decode(file_get_contents('php://input'), true) ?? [];
}

function billing_authenticate_user_from_token($token)
{
    if (users_store_backend() === 'error') {
        billing_respond(500, ['error' => users_store_last_error() ?: 'Banco configurado, mas não está pronto ainda.']);
    }

    $token = trim((string)$token);
    if (strlen($token) < 10) {
        billing_respond(401, ['error' => 'Sessão inválida. Faz login de novo.']);
    }

    $tokenHash = hash('sha256', $token);
    $user = users_store_find_by_session_token_hash($tokenHash);
    if (!$user || empty($user['id'])) {
        billing_respond(401, ['error' => 'Sessão inválida. Faz login de novo.']);
    }

    $expires = (int)($user['sessionTokenExpires'] ?? 0);
    if ($expires && $expires < time()) {
        billing_respond(401, ['error' => 'Sessão expirada. Faz login de novo.']);
    }

    return $user;
}

function billing_is_stripe_enabled()
{
    $config = stripe_config();
    return is_array($config) && !empty($config['enabled']);
}

function billing_require_stripe_client()
{
    $client = stripe_client();
    if ($client instanceof \Stripe\StripeClient) {
        return $client;
    }

    $info = stripe_last_info();
    $error = is_array($info) && !empty($info['error']) ? (string)$info['error'] : 'Stripe não configurado.';
    billing_respond(500, ['error' => $error]);
}

function billing_require_operational_config()
{
    $config = stripe_config();
    if (!$config || empty($config['enabled'])) {
        billing_respond(500, ['error' => 'Stripe ainda não está habilitado neste ambiente.']);
    }

    if (trim((string)($config['secret_key'] ?? '')) === '') {
        billing_respond(500, ['error' => 'Falta secret_key em storage/stripe.json.']);
    }

    return $config;
}

function billing_get_price_id_for_plan($plan)
{
    $config = stripe_config();
    if (!$config) return '';

    $safePlan = trim((string)$plan);
    if ($safePlan === 'monthly') return trim((string)($config['price_monthly'] ?? ''));
    if ($safePlan === 'annual') return trim((string)($config['price_annual'] ?? ''));
    return '';
}

function billing_plan_from_price_id($priceId)
{
    $safe = trim((string)$priceId);
    if ($safe === '') return 'free';

    $config = stripe_config();
    if (!$config) return 'unknown';

    if ($safe === trim((string)($config['price_monthly'] ?? ''))) return 'monthly';
    if ($safe === trim((string)($config['price_annual'] ?? ''))) return 'annual';
    return 'unknown';
}

function billing_plan_from_price_or_product($priceId, $productId = '')
{
    $plan = billing_plan_from_price_id($priceId);
    if ($plan !== 'unknown' && $plan !== 'free') return $plan;

    $safeProduct = trim((string)$productId);
    if ($safeProduct === '') return $plan;

    $config = stripe_config();
    if (!$config) return $plan;

    if ($safeProduct === trim((string)($config['product_monthly'] ?? ''))) return 'monthly';
    if ($safeProduct === trim((string)($config['product_annual'] ?? ''))) return 'annual';
    return $plan;
}

function billing_interval_from_price_id($priceId, $fallback = '')
{
    $plan = billing_plan_from_price_id($priceId);
    if ($plan === 'monthly') return 'month';
    if ($plan === 'annual') return 'year';

    $safeFallback = trim((string)$fallback);
    return $safeFallback !== '' ? $safeFallback : null;
}

function billing_has_premium_access_for_status($status)
{
    $safe = trim((string)$status);
    return in_array($safe, ['active', 'trialing'], true);
}

function billing_timestamp_from_user_date($value)
{
    $safe = trim((string)($value ?? ''));
    if ($safe === '') return 0;
    $timestamp = strtotime($safe);
    return $timestamp ?: 0;
}

function billing_trial_ends_timestamp_for_user($user)
{
    $explicit = billing_timestamp_from_user_date($user['trialEndsAt'] ?? null);
    if ($explicit > 0) return $explicit;

    $created = billing_timestamp_from_user_date($user['createdAt'] ?? null);
    return $created > 0 ? $created + (15 * 24 * 60 * 60) : 0;
}

function billing_is_manageable_status($status)
{
    $safe = trim((string)$status);
    return in_array($safe, ['active', 'trialing', 'past_due', 'unpaid', 'incomplete'], true);
}

function billing_to_iso_datetime($value)
{
    if ($value === null || $value === '') return null;
    if (is_numeric($value)) {
        $timestamp = (int)$value;
        return $timestamp > 0 ? date('c', $timestamp) : null;
    }

    $safe = trim((string)$value);
    if ($safe === '') return null;
    $time = strtotime($safe);
    return $time ? date('c', $time) : null;
}

function billing_to_bool($value)
{
    if (is_bool($value)) return $value;
    if (is_numeric($value)) return ((int)$value) === 1;
    $safe = strtolower(trim((string)$value));
    return in_array($safe, ['1', 'true', 'yes', 'on'], true);
}

function billing_snapshot_from_user($user, $allowPortal = true)
{
    $internalAccess = access_user_has_internal_access($user);
    $priceId = trim((string)($user['stripePriceId'] ?? ''));
    $status = trim((string)($user['billingStatus'] ?? ''));
    if ($status === '') $status = 'free';

    $interval = billing_interval_from_price_id($priceId, (string)($user['billingInterval'] ?? ''));
    $plan = $status === 'free' ? 'free' : billing_plan_from_price_or_product($priceId, (string)($user['stripeProductId'] ?? ''));
    if ($plan === 'unknown' && !$priceId) $plan = 'free';
    $premiumAccess = billing_has_premium_access_for_status($status);
    $now = time();
    $trialEndsTs = billing_trial_ends_timestamp_for_user($user);
    $trialActive = !$premiumAccess && $trialEndsTs > $now;
    $trialExpired = !$premiumAccess && $trialEndsTs > 0 && $trialEndsTs <= $now;
    $trialDaysRemaining = $trialActive ? max(0, (int)ceil(($trialEndsTs - $now) / 86400)) : 0;

    if ($trialActive && $status === 'free') {
        $status = 'trialing';
        $premiumAccess = true;
    }

    if ($internalAccess && !$premiumAccess) {
        $plan = 'internal';
        $status = 'internal';
        $trialExpired = false;
        $trialActive = false;
        $trialDaysRemaining = 0;
    }

    $internalOnlyAccess = $internalAccess && !$premiumAccess;

    return [
        'plan' => $plan,
        'status' => $status,
        'interval' => $interval,
        'hasPremiumAccess' => $premiumAccess,
        'hasFullAccess' => $premiumAccess || $trialActive || $internalAccess,
        'isInternalAccess' => $internalAccess,
        'trialActive' => $trialActive,
        'trialExpired' => $trialExpired,
        'trialEndsAt' => $trialEndsTs > 0 ? date('c', $trialEndsTs) : null,
        'trialDaysRemaining' => $trialDaysRemaining,
        'currentPeriodEnd' => billing_to_iso_datetime($user['billingCurrentPeriodEnd'] ?? null),
        'cancelAtPeriodEnd' => billing_to_bool($user['billingCancelAtPeriodEnd'] ?? false),
        'portalAvailable' => !$internalOnlyAccess && $allowPortal && trim((string)($user['stripeCustomerId'] ?? '')) !== '',
        'isFreeTier' => $plan === 'free' && trim((string)($user['stripeSubscriptionId'] ?? '')) === '',
        'priceId' => $priceId !== '' ? $priceId : null,
        'customerId' => trim((string)($user['stripeCustomerId'] ?? '')) ?: null,
        'subscriptionId' => trim((string)($user['stripeSubscriptionId'] ?? '')) ?: null
    ];
}

function billing_sync_user_from_checkout_session($user, $client, $sessionId)
{
    $sessionId = trim((string)$sessionId);
    if (!$user || empty($user['id']) || $sessionId === '') return $user;
    if (strpos($sessionId, 'cs_') !== 0) return $user;

    try {
        $session = $client->checkout->sessions->retrieve($sessionId, []);
        $sessionArray = method_exists($session, 'toArray') ? $session->toArray() : (array)$session;

        $referenceId = trim((string)($sessionArray['client_reference_id'] ?? ''));
        if ($referenceId !== '' && $referenceId !== (string)($user['id'] ?? '')) {
            return $user;
        }

        $customerId = (string)($sessionArray['customer'] ?? '');
        if ($customerId !== '') {
            billing_mark_customer_on_user((string)$user['id'], $customerId);
        }

        $subscriptionId = (string)($sessionArray['subscription'] ?? '');
        if ($subscriptionId !== '') {
            $subscription = $client->subscriptions->retrieve($subscriptionId, []);
            billing_apply_subscription_to_user((string)$user['id'], $subscription, null, $customerId);
            $fresh = billing_refresh_user((string)$user['id']);
            return $fresh ?: $user;
        }
    } catch (Throwable $e) {
        return $user;
    }

    $fresh = billing_refresh_user((string)$user['id']);
    return $fresh ?: $user;
}

function billing_extract_subscription_payload($subscription, $eventId = null, $customerId = null)
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

    $customerValue = $data['customer'] ?? $customerId;
    if (is_array($customerValue)) {
        $customerValue = $customerValue['id'] ?? '';
    } elseif (is_object($customerValue)) {
        $customerValue = $customerValue->id ?? '';
    }

    $items = is_array($data['items']['data'] ?? null) ? $data['items']['data'] : [];
    $firstItem = is_array($items[0] ?? null) ? $items[0] : [];
    $price = is_array($firstItem['price'] ?? null) ? $firstItem['price'] : [];
    $priceId = trim((string)($price['id'] ?? ''));
    $productId = trim((string)($price['product'] ?? ''));
    $recurring = is_array($price['recurring'] ?? null) ? $price['recurring'] : [];
    $interval = trim((string)($recurring['interval'] ?? ''));
    $cancelAtPeriodEnd = !empty($data['cancel_at_period_end']);
    if (!$cancelAtPeriodEnd && !empty($data['cancel_at'])) {
        $cancelAtPeriodEnd = true;
    }

    return [
        'stripeCustomerId' => trim((string)$customerValue) ?: null,
        'stripeSubscriptionId' => trim((string)($data['id'] ?? '')) ?: null,
        'stripePriceId' => $priceId !== '' ? $priceId : null,
        'stripeProductId' => $productId !== '' ? $productId : null,
        'billingStatus' => trim((string)($data['status'] ?? '')) ?: 'free',
        'billingInterval' => billing_interval_from_price_id($priceId, $interval),
        'billingCurrentPeriodEnd' => billing_to_iso_datetime($data['current_period_end'] ?? ($firstItem['current_period_end'] ?? null)),
        'billingCancelAtPeriodEnd' => $cancelAtPeriodEnd,
        'billingLastEventId' => $eventId ? (string)$eventId : null,
        'billingLastSyncedAt' => date('c')
    ];
}

function billing_apply_subscription_to_user($userId, $subscription, $eventId = null, $customerId = null)
{
    $payload = billing_extract_subscription_payload($subscription, $eventId, $customerId);
    return users_store_update_by_id((string)$userId, $payload);
}

function billing_mark_customer_on_user($userId, $customerId, $eventId = null)
{
    $payload = [
        'stripeCustomerId' => trim((string)$customerId) ?: null,
        'billingLastEventId' => $eventId ? (string)$eventId : null,
        'billingLastSyncedAt' => date('c')
    ];
    return users_store_update_by_id((string)$userId, $payload);
}

function billing_refresh_user($userId)
{
    return users_store_find_by_id((string)$userId);
}

function billing_ensure_customer_for_user($user, $client)
{
    $existingCustomerId = trim((string)($user['stripeCustomerId'] ?? ''));
    if ($existingCustomerId !== '') {
        return $existingCustomerId;
    }

    $customer = $client->customers->create([
        'email' => trim((string)($user['email'] ?? '')),
        'name' => trim((string)($user['name'] ?? '')),
        'metadata' => [
            'ugc_user_id' => (string)($user['id'] ?? '')
        ]
    ]);

    $customerId = trim((string)($customer->id ?? ''));
    if ($customerId === '') {
        throw new RuntimeException('Não consegui criar o customer na Stripe.');
    }

    $ok = billing_mark_customer_on_user((string)($user['id'] ?? ''), $customerId);
    if (!$ok) {
        throw new RuntimeException(users_store_last_error() ?: 'Não consegui salvar o customer da Stripe.');
    }

    return $customerId;
}

function billing_find_user_by_subscription_or_customer($subscriptionId, $customerId)
{
    $subscriptionId = trim((string)$subscriptionId);
    if ($subscriptionId !== '') {
        $user = users_store_find_by_stripe_subscription_id($subscriptionId);
        if ($user) return $user;
    }

    $customerId = trim((string)$customerId);
    if ($customerId !== '') {
        $user = users_store_find_by_stripe_customer_id($customerId);
        if ($user) return $user;
    }

    return null;
}

function billing_find_user_for_event_object($object)
{
    if ($object instanceof \Stripe\StripeObject && method_exists($object, 'toArray')) {
        $data = $object->toArray();
    } elseif (is_object($object) && method_exists($object, 'toArray')) {
        $data = $object->toArray();
    } elseif (is_array($object)) {
        $data = $object;
    } else {
        $data = [];
    }

    $metadata = is_array($data['metadata'] ?? null) ? $data['metadata'] : [];
    $userId = trim((string)($metadata['ugc_user_id'] ?? ($data['client_reference_id'] ?? '')));
    if ($userId !== '') {
        $user = users_store_find_by_id($userId);
        if ($user) return $user;
    }

    $customerId = $data['customer'] ?? '';
    if (is_array($customerId)) {
        $customerId = $customerId['id'] ?? '';
    } elseif (is_object($customerId)) {
        $customerId = $customerId->id ?? '';
    }

    $subscriptionId = $data['subscription'] ?? ($data['id'] ?? '');
    if (is_array($subscriptionId)) {
        $subscriptionId = $subscriptionId['id'] ?? '';
    } elseif (is_object($subscriptionId)) {
        $subscriptionId = $subscriptionId->id ?? '';
    }

    return billing_find_user_by_subscription_or_customer($subscriptionId, $customerId);
}

function billing_sync_user_from_stripe($user, $client)
{
    if (!$user || empty($user['id'])) return $user;

    $subscriptionId = trim((string)($user['stripeSubscriptionId'] ?? ''));
    if ($subscriptionId !== '') {
        try {
            $subscription = $client->subscriptions->retrieve($subscriptionId, []);
            billing_apply_subscription_to_user((string)$user['id'], $subscription, null, $user['stripeCustomerId'] ?? null);
            $fresh = billing_refresh_user((string)$user['id']);
            return $fresh ?: $user;
        } catch (Throwable $e) {
        }
    }

    $customerId = trim((string)($user['stripeCustomerId'] ?? ''));
    if ($customerId === '') {
        $email = strtolower(trim((string)($user['email'] ?? '')));
        if ($email !== '') {
            try {
                $customers = $client->customers->all([
                    'email' => $email,
                    'limit' => 10
                ]);
                $customerItems = is_array($customers->data ?? null) ? $customers->data : [];
                foreach ($customerItems as $customer) {
                    $candidateCustomerId = trim((string)($customer->id ?? ''));
                    if ($candidateCustomerId === '') continue;

                    $subscriptions = $client->subscriptions->all([
                        'customer' => $candidateCustomerId,
                        'status' => 'all',
                        'limit' => 10
                    ]);
                    $items = is_array($subscriptions->data ?? null) ? $subscriptions->data : [];
                    if (!$items) continue;

                    $selected = $items[0];
                    foreach ($items as $candidate) {
                        $status = trim((string)($candidate->status ?? ''));
                        if ($status !== 'canceled' && $status !== 'incomplete_expired') {
                            $selected = $candidate;
                            break;
                        }
                    }

                    billing_apply_subscription_to_user((string)$user['id'], $selected, null, $candidateCustomerId);
                    $fresh = billing_refresh_user((string)$user['id']);
                    return $fresh ?: $user;
                }
            } catch (Throwable $e) {
            }
        }

        return $user;
    }

    try {
        $subscriptions = $client->subscriptions->all([
            'customer' => $customerId,
            'status' => 'all',
            'limit' => 10
        ]);
        $items = is_array($subscriptions->data ?? null) ? $subscriptions->data : [];
        if (!$items) return $user;

        $selected = $items[0];
        foreach ($items as $candidate) {
            $status = trim((string)($candidate->status ?? ''));
            if ($status !== 'canceled' && $status !== 'incomplete_expired') {
                $selected = $candidate;
                break;
            }
        }

        billing_apply_subscription_to_user((string)$user['id'], $selected, null, $customerId);
        $fresh = billing_refresh_user((string)$user['id']);
        return $fresh ?: $user;
    } catch (Throwable $e) {
        return $user;
    }
}
