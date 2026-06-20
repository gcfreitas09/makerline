<?php
// api/stripe.php
require_once __DIR__ . '/url.php';

const UGC_STRIPE_CONFIG_PATH = __DIR__ . '/../storage/stripe.json';
const UGC_STRIPE_DEFAULT_SUCCESS_PATH = '/app.html?section=dashboard&billing=success&session_id={CHECKOUT_SESSION_ID}';
const UGC_STRIPE_DEFAULT_CANCEL_PATH = '/app.html?section=plans&billing=cancel';
const UGC_STRIPE_DEFAULT_PORTAL_RETURN_PATH = '/app.html?section=settings&billing=portal';
const UGC_STRIPE_API_VERSION = '2026-02-25.clover';

$GLOBALS['UGC_STRIPE_LAST_INFO'] = null;
$GLOBALS['UGC_STRIPE_CONFIG'] = null;
$GLOBALS['UGC_STRIPE_CLIENT'] = null;

function stripe_normalize_test_amount_cents($value)
{
    $amount = (int)$value;
    return $amount >= 50 ? $amount : 50;
}

function stripe_last_info()
{
    return $GLOBALS['UGC_STRIPE_LAST_INFO'];
}

function stripe_config()
{
    if (!is_array($GLOBALS['UGC_STRIPE_CONFIG'])) {
        load_stripe_config();
    }
    return is_array($GLOBALS['UGC_STRIPE_CONFIG']) ? $GLOBALS['UGC_STRIPE_CONFIG'] : null;
}

function stripe_info($config, $reason, $error = null)
{
    $safe = [
        'stripeConfigured' => (bool)$config,
        'reason' => (string)$reason,
        'configPath' => 'storage/stripe.json',
        'examplePath' => 'storage/stripe.example.json',
        'error' => $error ? (string)$error : null
    ];

    if ($config) {
        $safe['stripe'] = [
            'enabled' => !empty($config['enabled']),
            'secret_key_present' => !empty($config['secret_key']),
            'secret_key_mode' => stripe_secret_key_mode((string)($config['secret_key'] ?? '')),
            'webhook_secret_present' => !empty($config['webhook_secret']),
            'publishable_key_present' => !empty($config['publishable_key']),
            'price_monthly' => (string)($config['price_monthly'] ?? ''),
            'price_annual' => (string)($config['price_annual'] ?? ''),
            'success_path' => (string)($config['success_path'] ?? UGC_STRIPE_DEFAULT_SUCCESS_PATH),
            'cancel_path' => (string)($config['cancel_path'] ?? UGC_STRIPE_DEFAULT_CANCEL_PATH),
            'portal_return_path' => (string)($config['portal_return_path'] ?? UGC_STRIPE_DEFAULT_PORTAL_RETURN_PATH),
            'test_payment_amount_cents' => stripe_normalize_test_amount_cents($config['test_payment_amount_cents'] ?? 50)
        ];
    }

    return $safe;
}

function stripe_read_env()
{
    $enabled = getenv('UGC_STRIPE_ENABLED');
    if ($enabled !== false) {
        $enabledBool = filter_var($enabled, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        if ($enabledBool === false) {
            return ['enabled' => false];
        }
    }

    $secretKey = trim((string)(getenv('UGC_STRIPE_SECRET_KEY') ?: ''));
    $publishableKey = trim((string)(getenv('UGC_STRIPE_PUBLISHABLE_KEY') ?: ''));
    $restrictedKey = trim((string)(getenv('UGC_STRIPE_RESTRICTED_KEY') ?: ''));
    $webhookSecret = trim((string)(getenv('UGC_STRIPE_WEBHOOK_SECRET') ?: ''));
    $priceMonthly = trim((string)(getenv('UGC_STRIPE_PRICE_MONTHLY') ?: ''));
    $priceAnnual = trim((string)(getenv('UGC_STRIPE_PRICE_ANNUAL') ?: ''));
    $productMonthly = trim((string)(getenv('UGC_STRIPE_PRODUCT_MONTHLY') ?: ''));
    $productAnnual = trim((string)(getenv('UGC_STRIPE_PRODUCT_ANNUAL') ?: ''));
    $testPaymentAmount = trim((string)(getenv('UGC_STRIPE_TEST_PAYMENT_AMOUNT_CENTS') ?: '50'));

    if ($secretKey === '' && $webhookSecret === '' && $priceMonthly === '' && $priceAnnual === '' && $publishableKey === '') {
        return null;
    }

    return [
        'enabled' => true,
        'secret_key' => $secretKey,
        'publishable_key' => $publishableKey,
        'restricted_key' => $restrictedKey,
        'webhook_secret' => $webhookSecret,
        'price_monthly' => $priceMonthly,
        'price_annual' => $priceAnnual,
        'product_monthly' => $productMonthly,
        'product_annual' => $productAnnual,
        'success_path' => trim((string)(getenv('UGC_STRIPE_SUCCESS_PATH') ?: UGC_STRIPE_DEFAULT_SUCCESS_PATH)),
        'cancel_path' => trim((string)(getenv('UGC_STRIPE_CANCEL_PATH') ?: UGC_STRIPE_DEFAULT_CANCEL_PATH)),
        'portal_return_path' => trim((string)(getenv('UGC_STRIPE_PORTAL_RETURN_PATH') ?: UGC_STRIPE_DEFAULT_PORTAL_RETURN_PATH)),
        'test_payment_amount_cents' => stripe_normalize_test_amount_cents($testPaymentAmount)
    ];
}

function load_stripe_config()
{
    $file = UGC_STRIPE_CONFIG_PATH;
    $env = stripe_read_env();

    if (!file_exists($file)) {
        if (is_array($env)) {
            if (array_key_exists('enabled', $env) && !$env['enabled']) {
                $GLOBALS['UGC_STRIPE_LAST_INFO'] = stripe_info(null, 'stripe_disabled_env');
                return null;
            }

            $config = [
                'enabled' => true,
                'secret_key' => trim((string)($env['secret_key'] ?? '')),
                'publishable_key' => trim((string)($env['publishable_key'] ?? '')),
                'restricted_key' => trim((string)($env['restricted_key'] ?? '')),
                'webhook_secret' => trim((string)($env['webhook_secret'] ?? '')),
                'price_monthly' => trim((string)($env['price_monthly'] ?? '')),
                'price_annual' => trim((string)($env['price_annual'] ?? '')),
                'product_monthly' => trim((string)($env['product_monthly'] ?? '')),
                'product_annual' => trim((string)($env['product_annual'] ?? '')),
                'success_path' => trim((string)($env['success_path'] ?? UGC_STRIPE_DEFAULT_SUCCESS_PATH)) ?: UGC_STRIPE_DEFAULT_SUCCESS_PATH,
                'cancel_path' => trim((string)($env['cancel_path'] ?? UGC_STRIPE_DEFAULT_CANCEL_PATH)) ?: UGC_STRIPE_DEFAULT_CANCEL_PATH,
                'portal_return_path' => trim((string)($env['portal_return_path'] ?? UGC_STRIPE_DEFAULT_PORTAL_RETURN_PATH)) ?: UGC_STRIPE_DEFAULT_PORTAL_RETURN_PATH,
                'test_payment_amount_cents' => stripe_normalize_test_amount_cents($env['test_payment_amount_cents'] ?? 50)
            ];
            $GLOBALS['UGC_STRIPE_CONFIG'] = $config;
            $GLOBALS['UGC_STRIPE_LAST_INFO'] = stripe_info($config, 'ok');
            return $config;
        }

        $GLOBALS['UGC_STRIPE_LAST_INFO'] = stripe_info(null, 'stripe_file_missing');
        return null;
    }

    $raw = @file_get_contents($file);
    $data = json_decode((string)$raw, true);
    if (!is_array($data)) {
        $GLOBALS['UGC_STRIPE_LAST_INFO'] = stripe_info(null, 'stripe_invalid_json');
        return null;
    }

    if (array_key_exists('enabled', $data) && !$data['enabled']) {
        $GLOBALS['UGC_STRIPE_LAST_INFO'] = stripe_info(null, 'stripe_disabled');
        return null;
    }

    $config = [
        'enabled' => true,
        'secret_key' => trim((string)($data['secret_key'] ?? '')),
        'publishable_key' => trim((string)($data['publishable_key'] ?? '')),
        'restricted_key' => trim((string)($data['restricted_key'] ?? '')),
        'webhook_secret' => trim((string)($data['webhook_secret'] ?? '')),
        'price_monthly' => trim((string)($data['price_monthly'] ?? '')),
        'price_annual' => trim((string)($data['price_annual'] ?? '')),
        'product_monthly' => trim((string)($data['product_monthly'] ?? '')),
        'product_annual' => trim((string)($data['product_annual'] ?? '')),
        'success_path' => trim((string)($data['success_path'] ?? UGC_STRIPE_DEFAULT_SUCCESS_PATH)) ?: UGC_STRIPE_DEFAULT_SUCCESS_PATH,
        'cancel_path' => trim((string)($data['cancel_path'] ?? UGC_STRIPE_DEFAULT_CANCEL_PATH)) ?: UGC_STRIPE_DEFAULT_CANCEL_PATH,
        'portal_return_path' => trim((string)($data['portal_return_path'] ?? UGC_STRIPE_DEFAULT_PORTAL_RETURN_PATH)) ?: UGC_STRIPE_DEFAULT_PORTAL_RETURN_PATH,
        'test_payment_amount_cents' => stripe_normalize_test_amount_cents($data['test_payment_amount_cents'] ?? 50)
    ];

    $GLOBALS['UGC_STRIPE_CONFIG'] = $config;
    $GLOBALS['UGC_STRIPE_LAST_INFO'] = stripe_info($config, 'ok');
    return $config;
}

function stripe_secret_key_mode($key)
{
    $safe = trim((string)$key);
    if (strpos($safe, 'sk_live_') === 0) return 'live';
    if (strpos($safe, 'sk_test_') === 0) return 'test';
    if (strpos($safe, 'rk_live_') === 0) return 'live_restricted';
    if (strpos($safe, 'rk_test_') === 0) return 'test_restricted';
    return $safe === '' ? 'missing' : 'unknown';
}

function stripe_autoload_path()
{
    return __DIR__ . '/../vendor/autoload.php';
}

function stripe_sdk_is_available()
{
    if (class_exists('\\Stripe\\StripeClient')) {
        return true;
    }

    $autoload = stripe_autoload_path();
    if (!file_exists($autoload)) {
        return false;
    }

    require_once $autoload;
    return class_exists('\\Stripe\\StripeClient');
}

function stripe_client()
{
    if ($GLOBALS['UGC_STRIPE_CLIENT'] instanceof \Stripe\StripeClient) {
        return $GLOBALS['UGC_STRIPE_CLIENT'];
    }

    $config = stripe_config();
    if (!$config || empty($config['enabled'])) {
        $GLOBALS['UGC_STRIPE_LAST_INFO'] = stripe_info(null, 'stripe_not_enabled');
        return null;
    }

    if (!stripe_sdk_is_available()) {
        $GLOBALS['UGC_STRIPE_LAST_INFO'] = stripe_info($config, 'stripe_sdk_missing', 'SDK do Stripe não encontrado. Rode o composer install no projeto.');
        return null;
    }

    $secretKey = trim((string)($config['secret_key'] ?? ''));
    if ($secretKey === '') {
        $GLOBALS['UGC_STRIPE_LAST_INFO'] = stripe_info($config, 'stripe_incomplete', 'Falta secret_key em storage/stripe.json.');
        return null;
    }

    try {
        $GLOBALS['UGC_STRIPE_CLIENT'] = new \Stripe\StripeClient([
            'api_key' => $secretKey,
            'stripe_version' => UGC_STRIPE_API_VERSION
        ]);
        return $GLOBALS['UGC_STRIPE_CLIENT'];
    } catch (Throwable $e) {
        $GLOBALS['UGC_STRIPE_LAST_INFO'] = stripe_info($config, 'stripe_client_failed', $e->getMessage());
        return null;
    }
}

function stripe_path_to_url($path)
{
    $safe = trim((string)$path);
    if ($safe === '') {
        return ugc_base_url() . UGC_STRIPE_DEFAULT_SUCCESS_PATH;
    }
    if (preg_match('#^https://#i', $safe)) {
        return $safe;
    }
    if ($safe[0] !== '/') {
        $safe = '/' . $safe;
    }
    return ugc_base_url() . $safe;
}
