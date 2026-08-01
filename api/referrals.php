<?php
// api/referrals.php
require_once __DIR__ . '/supabase_client.php';
require_once __DIR__ . '/url.php';

const UGC_REFERRALS_FILE_PATH = __DIR__ . '/../storage/referrals.json';

function access_internal_emails()
{
    return [
        'fgui3662@gmail.com',
        'lorenzo.ritter13@gmail.com',
        'lorenzo.ritter27@gmail.com',
        'assessoriaricardoolavo@gmail.com',
        'contatokeilabragante@gmail.com',
    ];
}

function access_user_has_internal_access($user)
{
    if (!is_array($user)) return false;
    $email = trim(strtolower((string)($user['email'] ?? '')));
    return $email !== '' && in_array($email, access_internal_emails(), true);
}

function referrals_partners()
{
    return [
        'rickolavo' => [
            'code' => 'rickolavo',
            'partnerCode' => 'rickolavo',
            'name' => 'Rick Olavo',
            'email' => 'assessoriaricardoolavo@gmail.com',
            'instagram' => '@rickolavo',
            'instagramUrl' => 'https://instagram.com/rickolavo',
            'urlSlug' => 'RickOlavo',
            'commissionPercent' => 35,
            'trialDays' => 30,
            'aliases' => ['rick-olavo'],
        ],
        'keilabragante-30' => [
            'code' => 'keilabragante-30',
            'partnerCode' => 'keilabragante',
            'name' => 'Keila Bragante',
            'email' => 'contatokeilabragante@gmail.com',
            'instagram' => '@keilabraganteugc',
            'instagramUrl' => 'https://instagram.com/keilabraganteugc',
            'urlSlug' => 'KeilaBragante_30',
            'commissionPercent' => 25,
            'trialDays' => 30,
            'aliases' => ['keilabragante30'],
        ],
        'keilabragante-15' => [
            'code' => 'keilabragante-15',
            'partnerCode' => 'keilabragante',
            'name' => 'Keila Bragante',
            'email' => 'contatokeilabragante@gmail.com',
            'instagram' => '@keilabraganteugc',
            'instagramUrl' => 'https://instagram.com/keilabraganteugc',
            'urlSlug' => 'KeilaBragante_15',
            'commissionPercent' => 25,
            'trialDays' => 15,
            'aliases' => ['keilabragante-1', 'keilabragante1', 'keilabragante-2', 'keilabragante2'],
        ],
    ];
}

function referrals_partner_identifiers($partner)
{
    if (!is_array($partner)) return [];

    $values = [
        $partner['code'] ?? null,
        $partner['partnerCode'] ?? null,
        $partner['urlSlug'] ?? null,
    ];

    $aliases = is_array($partner['aliases'] ?? null) ? $partner['aliases'] : [];
    foreach ($aliases as $alias) {
        $values[] = $alias;
    }

    $normalized = [];
    foreach ($values as $value) {
        $safe = referrals_normalize_code($value);
        if ($safe !== '') {
            $normalized[$safe] = true;
        }
    }

    return array_keys($normalized);
}

function referrals_normalize_code($value)
{
    $safe = strtolower(trim((string)$value));
    $safe = preg_replace('/[^a-z0-9-]+/', '-', $safe);
    $safe = preg_replace('/-+/', '-', $safe);
    return trim((string)$safe, '-');
}

function referrals_partner_by_code($code)
{
    $safe = referrals_normalize_code($code);
    if ($safe === '') return null;

    $partners = referrals_partners();
    if (isset($partners[$safe])) return $partners[$safe];

    foreach ($partners as $partner) {
        foreach (referrals_partner_identifiers($partner) as $identifier) {
            if ($identifier === $safe) return $partner;
        }
    }

    return null;
}

function referrals_partner_by_email($email)
{
    $safeEmail = trim(strtolower((string)$email));
    if ($safeEmail === '') return null;

    foreach (referrals_partners() as $partner) {
        if (trim(strtolower((string)($partner['email'] ?? ''))) === $safeEmail) {
            return $partner;
        }
    }

    return null;
}

// Links internos (bio do Instagram, etc.) que servem só pra saber de onde o cadastro veio --
// nunca sao parceiros de comissao (referrals_partner_by_code sempre retorna null pra eles),
// entao guardar o codigo em referredBy e seguro e nao aciona nenhuma logica de pagamento.
function referrals_internal_tracking_links()
{
    return [
        'bio' => ['label' => 'Bio do Instagram (Makerline)'],
        'biol' => ['label' => 'Bio do Lorenzo'],
    ];
}

function referrals_internal_tracking_label($code)
{
    $links = referrals_internal_tracking_links();
    $safe = referrals_normalize_code($code);
    return $links[$safe]['label'] ?? null;
}

function referrals_valid_code_or_null($value)
{
    $code = referrals_normalize_code($value);
    if ($code === '') return null;

    if (referrals_internal_tracking_label($code)) return $code;

    $partner = referrals_partner_by_code($code);
    return $partner ? (string)$partner['code'] : null;
}

function referrals_trial_days_for_code($code, $fallback = 15)
{
    $partner = referrals_partner_by_code($code);
    if (!$partner) return max(0, (int)$fallback);

    $days = (int)($partner['trialDays'] ?? $fallback);
    return max(0, $days);
}

function referrals_code_for_checkout($user, $requestCode = '')
{
    $userCode = referrals_valid_code_or_null($user['referredBy'] ?? null);
    if ($userCode) return $userCode;

    $requestCode = referrals_valid_code_or_null($requestCode);
    if (!$requestCode) return null;

    $partner = referrals_partner_by_code($requestCode);
    $userEmail = trim(strtolower((string)($user['email'] ?? '')));
    $partnerEmail = trim(strtolower((string)($partner['email'] ?? '')));
    if ($userEmail !== '' && $userEmail === $partnerEmail) return null;

    return $requestCode;
}

function referrals_metadata_for_code($code)
{
    $partner = referrals_partner_by_code($code);
    if (!$partner) return [];

    return [
        'ugc_referral_code' => (string)$partner['code'],
        'ugc_partner_code' => (string)($partner['partnerCode'] ?? $partner['code']),
        'ugc_partner_email' => (string)$partner['email'],
        'ugc_commission_percent' => (string)((int)$partner['commissionPercent']),
        'ugc_trial_days' => (string)referrals_trial_days_for_code($partner['code'], 15)
    ];
}

function referrals_public_partner_payload($partner)
{
    if (!is_array($partner)) return null;

    $slug = trim((string)($partner['urlSlug'] ?? ''));
    $signupUrl = $slug !== ''
        ? ugc_base_url() . '/' . rawurlencode($slug)
        : ugc_base_url() . '/lancamento.html?ref=' . rawurlencode((string)($partner['code'] ?? ''));

    return [
        'partnerCode' => (string)($partner['partnerCode'] ?? $partner['code'] ?? ''),
        'referralCode' => (string)($partner['code'] ?? ''),
        'name' => (string)($partner['name'] ?? ''),
        'email' => (string)($partner['email'] ?? ''),
        'instagram' => (string)($partner['instagram'] ?? ''),
        'instagramUrl' => (string)($partner['instagramUrl'] ?? ''),
        'urlSlug' => (string)($partner['urlSlug'] ?? ''),
        'commissionPercent' => (int)($partner['commissionPercent'] ?? 0),
        'trialDays' => (int)($partner['trialDays'] ?? 0),
        'identifiers' => referrals_partner_identifiers($partner),
        'signupUrl' => $signupUrl
    ];
}

function referrals_object_to_array($value)
{
    if (is_object($value) && method_exists($value, 'toArray')) return $value->toArray();
    if (is_array($value)) return $value;
    return [];
}

function referrals_load_ledger()
{
    $file = UGC_REFERRALS_FILE_PATH;
    if (!is_file($file)) {
        return ['events' => [], 'commissions' => []];
    }

    $raw = @file_get_contents($file);
    $data = $raw !== false ? json_decode((string)$raw, true) : null;
    if (!is_array($data)) return ['events' => [], 'commissions' => []];

    return [
        'events' => is_array($data['events'] ?? null) ? $data['events'] : [],
        'commissions' => is_array($data['commissions'] ?? null) ? $data['commissions'] : []
    ];
}

function referrals_save_ledger($ledger)
{
    $file = UGC_REFERRALS_FILE_PATH;
    $dir = dirname($file);
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }

    $payload = [
        'events' => is_array($ledger['events'] ?? null) ? $ledger['events'] : [],
        'commissions' => is_array($ledger['commissions'] ?? null) ? $ledger['commissions'] : []
    ];

    return @file_put_contents($file, json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX) !== false;
}

function referrals_table_partner_commissions()
{
    $config = supabase_config();
    $table = is_array($config) ? trim((string)($config['table_partner_commissions'] ?? '')) : '';
    return $table !== '' ? $table : 'partner_commissions';
}

function referrals_subscription_first_price($subscriptionArray)
{
    $items = is_array($subscriptionArray['items']['data'] ?? null) ? $subscriptionArray['items']['data'] : [];
    $firstItem = is_array($items[0] ?? null) ? $items[0] : [];
    return is_array($firstItem['price'] ?? null) ? $firstItem['price'] : [];
}

function referrals_plan_from_price($priceId, $productId, $interval)
{
    if (function_exists('billing_plan_from_price_or_product')) {
        $plan = billing_plan_from_price_or_product((string)$priceId, (string)$productId);
        if ($plan && $plan !== 'unknown') return $plan;
    }

    $safeInterval = strtolower(trim((string)$interval));
    if ($safeInterval === 'year') return 'annual';
    if ($safeInterval === 'month') return 'monthly';
    return null;
}

function referrals_unix_to_iso($value)
{
    $timestamp = is_numeric($value) ? (int)$value : 0;
    return $timestamp > 0 ? date('c', $timestamp) : null;
}

function referrals_payout_month_from_iso($value)
{
    $time = strtotime((string)$value);
    if (!$time) $time = time();
    return date('Y-m-01', $time);
}

function referrals_record_commission_to_supabase($entry, $invoiceArray = [])
{
    if (!is_array($entry) || empty($entry['eventId'])) return false;

    $table = referrals_table_partner_commissions();
    $row = [
        'id' => (string)($entry['id'] ?? ('ref_' . hash('sha256', (string)$entry['eventId']))),
        'event_id' => (string)$entry['eventId'],
        'invoice_id' => $entry['invoiceId'] ?? null,
        'subscription_id' => $entry['subscriptionId'] ?? null,
        'customer_id' => $entry['customerId'] ?? null,
        'user_id' => $entry['userId'] ?? null,
        'user_email' => $entry['userEmail'] ?? null,
        'partner_code' => $entry['partnerCode'] ?? null,
        'referral_code' => $entry['referralCode'] ?? null,
        'partner_name' => $entry['partnerName'] ?? null,
        'partner_email' => $entry['partnerEmail'] ?? null,
        'plan_code' => $entry['planCode'] ?? null,
        'billing_interval' => $entry['billingInterval'] ?? null,
        'price_id' => $entry['priceId'] ?? null,
        'product_id' => $entry['productId'] ?? null,
        'amount_paid_cents' => (int)($entry['amountPaid'] ?? 0),
        'commission_percent' => (float)($entry['commissionPercent'] ?? 0),
        'commission_amount_cents' => (int)($entry['commissionAmount'] ?? 0),
        'currency' => $entry['currency'] ?? 'brl',
        'stripe_created_at' => $entry['stripeCreatedAt'] ?? null,
        'paid_at' => $entry['paidAt'] ?? date('c'),
        'payout_month' => referrals_payout_month_from_iso($entry['paidAt'] ?? null),
        'payout_status' => $entry['status'] ?? 'pending',
        'raw_invoice' => is_array($invoiceArray) ? $invoiceArray : null
    ];

    $res = supabase_client_request(
        'POST',
        $table,
        ['on_conflict' => 'event_id'],
        $row,
        ['Prefer' => 'resolution=merge-duplicates,return=minimal']
    );

    if (!empty($res['ok']) || (int)($res['status'] ?? 0) === 409) return true;
    error_log('[referrals] Supabase commission insert failed: ' . (string)($res['error'] ?? 'unknown'));
    return false;
}

function referrals_record_commission_from_invoice($user, $invoice, $eventId, $subscription = null)
{
    $invoiceArray = referrals_object_to_array($invoice);
    $subscriptionArray = referrals_object_to_array($subscription);
    $eventId = trim((string)$eventId);
    if ($eventId === '' || !is_array($user)) return false;

    $metadata = is_array($subscriptionArray['metadata'] ?? null) ? $subscriptionArray['metadata'] : [];
    $code = referrals_valid_code_or_null($user['referredBy'] ?? null);
    if (!$code) {
        $code = referrals_valid_code_or_null($metadata['ugc_referral_code'] ?? null);
    }
    if (!$code) return false;

    $partner = referrals_partner_by_code($code);
    if (!$partner) return false;

    $userEmail = trim(strtolower((string)($user['email'] ?? '')));
    $partnerEmail = trim(strtolower((string)($partner['email'] ?? '')));
    if ($userEmail !== '' && $userEmail === $partnerEmail) return false;

    $amountPaid = (int)($invoiceArray['amount_paid'] ?? 0);
    if ($amountPaid <= 0) return false;

    $invoiceId = trim((string)($invoiceArray['id'] ?? ''));
    $subscriptionId = $invoiceArray['subscription'] ?? ($subscriptionArray['id'] ?? '');
    if (is_array($subscriptionId)) $subscriptionId = $subscriptionId['id'] ?? '';
    if (is_object($subscriptionId)) $subscriptionId = $subscriptionId->id ?? '';

    $ledger = referrals_load_ledger();
    if (!empty($ledger['events'][$eventId])) return true;

    foreach ($ledger['commissions'] as $entry) {
        if ($invoiceId !== '' && (string)($entry['invoiceId'] ?? '') === $invoiceId) {
            $ledger['events'][$eventId] = date('c');
            return referrals_save_ledger($ledger);
        }
    }

    $percent = (int)$partner['commissionPercent'];
    $commissionAmount = (int)round($amountPaid * ($percent / 100));
    $platformAmount = max(0, $amountPaid - $commissionAmount);
    $price = referrals_subscription_first_price($subscriptionArray);
    $priceId = trim((string)($price['id'] ?? ''));
    $productId = trim((string)($price['product'] ?? ''));
    $recurring = is_array($price['recurring'] ?? null) ? $price['recurring'] : [];
    $interval = trim((string)($recurring['interval'] ?? ''));
    $paidAt = referrals_unix_to_iso($invoiceArray['status_transitions']['paid_at'] ?? null)
        ?: referrals_unix_to_iso($invoiceArray['created'] ?? null)
        ?: date('c');
    $entryId = 'ref_' . hash('sha256', $eventId . '|' . ($invoiceId ?: trim((string)$subscriptionId)));

    $ledger['events'][$eventId] = date('c');
    $entry = [
        'id' => $entryId,
        'createdAt' => date('c'),
        'paidAt' => $paidAt,
        'stripeCreatedAt' => referrals_unix_to_iso($invoiceArray['created'] ?? null),
        'status' => 'pending',
        'eventId' => $eventId,
        'invoiceId' => $invoiceId ?: null,
        'subscriptionId' => trim((string)$subscriptionId) ?: null,
        'customerId' => trim((string)($invoiceArray['customer'] ?? '')) ?: null,
        'userId' => (string)($user['id'] ?? ''),
        'userEmail' => $userEmail,
        'partnerCode' => (string)($partner['partnerCode'] ?? $partner['code']),
        'referralCode' => (string)$partner['code'],
        'partnerName' => (string)$partner['name'],
        'partnerEmail' => (string)$partner['email'],
        'commissionPercent' => $percent,
        'amountPaid' => $amountPaid,
        'commissionAmount' => $commissionAmount,
        'platformAmount' => $platformAmount,
        'commissionMode' => trim((string)($metadata['ugc_commission_mode'] ?? 'ledger_only')) ?: 'ledger_only',
        'stripePartnerAccountId' => trim((string)($metadata['ugc_stripe_partner_account_id'] ?? '')) ?: null,
        'currency' => strtolower(trim((string)($invoiceArray['currency'] ?? 'brl'))) ?: 'brl',
        'planCode' => referrals_plan_from_price($priceId, $productId, $interval),
        'billingInterval' => $interval ?: null,
        'priceId' => $priceId ?: null,
        'productId' => $productId ?: null
    ];

    $ledger['commissions'][] = $entry;

    $localOk = referrals_save_ledger($ledger);
    $supabaseOk = referrals_record_commission_to_supabase($entry, $invoiceArray);
    return $localOk || $supabaseOk;
}
