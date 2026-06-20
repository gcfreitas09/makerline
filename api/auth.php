<?php
ini_set('display_errors', '0');
error_reporting(0);

require_once __DIR__ . '/users_store.php';
require_once __DIR__ . '/referrals.php';
require_once __DIR__ . '/billing_common.php';
require_once __DIR__ . '/waitlist_store.php';

const UGC_ADMINS_FILE_PATH = __DIR__ . '/../storage/admins.json';
const UGC_ADMINS_EXAMPLE_FILE_PATH = __DIR__ . '/../storage/admins.example.json';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

function respond($status, $data = [])
{
    http_response_code((int)$status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function auth_public_user($user, $fallbackEmail = '')
{
    $instagram = trim((string)($user['instagram'] ?? ''));
    if ($instagram !== '' && $instagram[0] !== '@') {
        $instagram = '@' . $instagram;
    }

    return [
        'id' => $user['id'] ?? '',
        'name' => $user['name'] ?? '',
        'email' => $user['email'] ?? $fallbackEmail,
        'instagram' => $instagram,
        'billing' => billing_snapshot_from_user($user, billing_is_stripe_enabled()),
    ];
}

function auth_load_json_file($file)
{
    if (!is_file($file)) return null;
    $raw = @file_get_contents($file);
    if ($raw === false) return null;
    $data = json_decode((string)$raw, true);
    return is_array($data) ? $data : null;
}

function auth_admin_emails()
{
    static $emails = null;
    if (is_array($emails)) return $emails;

    $data = auth_load_json_file(UGC_ADMINS_FILE_PATH);
    if (!$data) {
        $data = auth_load_json_file(UGC_ADMINS_EXAMPLE_FILE_PATH);
    }

    $rawEmails = is_array($data['emails'] ?? null) ? $data['emails'] : [];
    $clean = [];
    foreach ($rawEmails as $rawEmail) {
        $safeEmail = trim(strtolower((string)$rawEmail));
        if ($safeEmail === '' || !filter_var($safeEmail, FILTER_VALIDATE_EMAIL)) continue;
        $clean[$safeEmail] = true;
    }

    $emails = array_keys($clean);
    return $emails;
}

function auth_request_host()
{
    $host = trim((string)($_SERVER['HTTP_HOST'] ?? ($_SERVER['SERVER_NAME'] ?? '')));
    if ($host === '') return '';
    if (strpos($host, ':') !== false) {
        $host = strstr($host, ':', true) ?: $host;
    }
    return strtolower($host);
}

function auth_is_local_request()
{
    $host = auth_request_host();
    $remoteAddr = trim((string)($_SERVER['REMOTE_ADDR'] ?? ''));
    $serverAddr = trim((string)($_SERVER['SERVER_ADDR'] ?? ''));

    $localhostHosts = ['localhost', '127.0.0.1', '::1'];
    $localhostAddrs = ['127.0.0.1', '::1'];

    if (in_array($host, $localhostHosts, true)) return true;
    if (in_array($remoteAddr, $localhostAddrs, true) && in_array($serverAddr, $localhostAddrs, true)) return true;
    return false;
}

function auth_can_use_local_admin_fallback($email, $user)
{
    $safeEmail = trim(strtolower((string)$email));
    if ($safeEmail === '' || !is_array($user)) return false;
    if (!auth_is_local_request()) return false;
    if (!in_array($safeEmail, auth_admin_emails(), true)) return false;

    $userId = trim((string)($user['id'] ?? ''));
    if ($userId === '') return false;

    foreach (users_store_list_state_files() as $path) {
        $candidate = users_store_user_from_state_file($path);
        if (!is_array($candidate)) continue;
        if (trim((string)($candidate['id'] ?? '')) !== $userId) continue;
        if (trim(strtolower((string)($candidate['email'] ?? ''))) !== $safeEmail) continue;
        return true;
    }

    return false;
}

function auth_is_trusted_access_email($email)
{
    $safeEmail = trim(strtolower((string)$email));
    if ($safeEmail === '') return false;

    if (in_array($safeEmail, auth_admin_emails(), true)) {
        return true;
    }

    if (function_exists('access_internal_emails')) {
        return in_array($safeEmail, access_internal_emails(), true);
    }

    return false;
}

function auth_normalize_instagram($value)
{
    $safe = strtolower(trim((string)$value));
    $safe = ltrim($safe, '@');
    $safe = preg_replace('/[^a-z0-9._]+/', '', $safe);
    return trim((string)$safe);
}

function auth_is_valid_instagram($value)
{
    $safe = auth_normalize_instagram($value);
    if ($safe === '') return false;
    if (strlen($safe) < 3 || strlen($safe) > 30) return false;
    return preg_match('/^[a-z0-9._]+$/', $safe) === 1;
}

function auth_instagram_to_login_email($instagram)
{
    $handle = auth_normalize_instagram($instagram);
    return $handle !== '' ? ('insta.' . $handle . '@makerline.local') : '';
}

function auth_normalize_email($value)
{
    $safe = trim(strtolower((string)$value));
    return filter_var($safe, FILTER_VALIDATE_EMAIL) ? $safe : '';
}

function auth_find_user_by_login_identifier($value)
{
    $safe = trim((string)$value);
    if ($safe === '') return [null, ''];

    $email = auth_normalize_email($safe);
    if ($email !== '') {
        return [users_store_find_by_email($email), $email];
    }

    if (!auth_is_valid_instagram($safe)) {
        return [null, ''];
    }

    $instagram = auth_normalize_instagram($safe);
    $user = users_store_find_by_instagram($instagram);
    if ($user) {
        return [$user, trim(strtolower((string)($user['email'] ?? '')))];
    }

    $legacyEmail = auth_instagram_to_login_email($instagram);
    return [users_store_find_by_email($legacyEmail), $legacyEmail];
}

function auth_issue_session_response($user, $email, $extraUpdates = [], $status = 200)
{
    $userId = trim((string)($user['id'] ?? ''));
    if ($userId === '') {
        respond(500, ['error' => 'Sua conta esta incompleta. Crie outra conta ou fale com o suporte.']);
    }

    $token = bin2hex(random_bytes(24));
    $updates = array_merge([
        'sessionTokenHash' => hash('sha256', $token),
        'sessionTokenExpires' => time() + 60 * 60 * 24 * 7,
        'lastLoginAt' => date('c'),
    ], (array)$extraUpdates);

    $ok = users_store_update_by_id($userId, $updates);
    if (!$ok) {
        respond(500, [
            'error' => users_store_last_error() ?: 'Nao consegui salvar sua sessao agora.',
            'hint' => 'Confira o banco (storage/db.json) ou a permissao de escrita do servidor.',
        ]);
    }

    $freshUser = users_store_find_by_id($userId);
    if (!is_array($freshUser)) {
        $freshUser = array_merge((array)$user, (array)$extraUpdates);
    }

    respond((int)$status, [
        'ok' => true,
        'token' => $token,
        'user' => auth_public_user($freshUser, $email),
    ]);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    respond(405, ['error' => 'Metodo nao permitido']);
}

$body = json_decode(file_get_contents('php://input'), true) ?? [];
$action = (string)($body['action'] ?? '');
$rawInstagram = trim((string)($body['instagram'] ?? ''));
$instagram = auth_normalize_instagram($rawInstagram ?? '');
$loginIdentifier = trim((string)($body['email'] ?? ($instagram !== '' ? $instagram : '')));
$email = auth_normalize_email($body['email'] ?? '');
$password = (string)($body['password'] ?? '');
$name = trim((string)($body['name'] ?? ''));
$referralCode = referrals_valid_code_or_null($body['referralCode'] ?? ($body['ref'] ?? null));

if ($action !== 'signup' && $action !== 'login') {
    respond(400, ['error' => 'Acao invalida']);
}

if (users_store_backend() === 'error') {
    respond(500, ['error' => users_store_last_error() ?: 'Banco configurado, mas nao esta pronto ainda.']);
}

if ($action === 'signup') {
    // The current signup UI no longer collects Instagram. Ignore stale/cached values
    // from older frontend bundles instead of blocking account creation.
    if ($rawInstagram !== '') {
        $instagram = '';
    }
    if ($name === '') {
        respond(400, ['error' => 'Nome obrigatorio']);
    }
    if (strlen($password) < 6) {
        respond(400, ['error' => 'Senha muito curta (min. 6)']);
    }
    if ($email === '') {
        respond(400, ['error' => 'E-mail invalido']);
    }
    if (users_store_find_by_email($email)) {
        respond(409, ['error' => 'Este e-mail ja esta cadastrado']);
    }

    $waitlistMatch = waitlist_store_find_pre_signup_match($instagram, $email);
    if (!$referralCode && is_array($waitlistMatch)) {
        $waitlistReferral = waitlist_store_resolve_partner($waitlistMatch['referralCode'] ?? '');
        $referralCode = (string)($waitlistReferral['referralCode'] ?? '') ?: null;
    }

    $trialDays = referrals_trial_days_for_code($referralCode, 15);
    $trialStartedAt = date('c');
    $trialEndsAt = date('c', time() + 60 * 60 * 24 * max(0, $trialDays));
    $token = bin2hex(random_bytes(24));

    $partnerForUser = referrals_partner_by_email($email);
    $ownReferralCode = $partnerForUser ? (string)$partnerForUser['code'] : null;
    if ($ownReferralCode && $referralCode === $ownReferralCode) {
        $referralCode = null;
    }

    $referredPartner = $referralCode ? referrals_partner_by_code($referralCode) : null;
    $referredPartnerEmail = trim(strtolower((string)($referredPartner['email'] ?? '')));
    if ($referredPartnerEmail !== '' && $referredPartnerEmail === $email) {
        $referralCode = null;
    }

    $newUser = [
        'id' => uniqid('u_', true),
        'name' => $name,
        'email' => $email,
        'instagram' => $instagram !== '' ? $instagram : null,
        'referralCode' => $ownReferralCode,
        'referredBy' => $referralCode,
        'cpfHash' => null,
        'cpfLast4' => null,
        'referralTrialDays' => $trialDays,
        'trialStartedAt' => $trialStartedAt,
        'trialEndsAt' => $trialEndsAt,
        'accessCount' => 0,
        'timeSpentSeconds' => 0,
        'lastLoginAt' => date('c'),
        'password' => password_hash($password, PASSWORD_DEFAULT),
        'createdAt' => date('c'),
        'sessionTokenHash' => hash('sha256', $token),
        'sessionTokenExpires' => time() + 60 * 60 * 24 * 7,
        'resetTokenHash' => null,
        'resetTokenExpires' => null,
        'resetCodeHash' => null,
        'resetCodeExpires' => null,
        'lastSeenAt' => null,
        'lastAccessAt' => null,
        'stripeCustomerId' => null,
        'stripeSubscriptionId' => null,
        'stripePriceId' => null,
        'billingStatus' => 'free',
        'billingInterval' => null,
        'billingCurrentPeriodEnd' => null,
        'billingCancelAtPeriodEnd' => false,
        'billingLastEventId' => null,
        'billingLastSyncedAt' => null,
    ];

    $ok = users_store_insert($newUser);
    if (!$ok) {
        respond(500, [
            'error' => users_store_last_error() ?: 'Nao consegui salvar sua conta agora.',
            'hint' => 'Confira o banco (storage/db.json) ou a permissao de escrita do servidor.',
        ]);
    }

    respond(201, [
        'ok' => true,
        'token' => $token,
        'user' => auth_public_user($newUser, $email),
    ]);
}

if ($loginIdentifier === '') {
    respond(400, ['error' => 'Informe seu e-mail.']);
}

$authLookup = auth_find_user_by_login_identifier($loginIdentifier);
$user = $authLookup[0] ?? null;
$authEmail = (string)($authLookup[1] ?? '');

if (!$user || $authEmail === '') {
    respond(401, ['error' => 'E-mail ou senha invalidos']);
}

$storedPassword = (string)($user['password'] ?? '');
if ($storedPassword === '') {
    $backupPassword = users_store_find_backup_password_for_user($user);
    if ($backupPassword !== '') {
        users_store_update_by_id((string)$user['id'], ['password' => $backupPassword]);
        $user['password'] = $backupPassword;
        $storedPassword = $backupPassword;
    }
}

if ($storedPassword === '') {
    if (auth_is_trusted_access_email($authEmail) && trim($password) !== '') {
        $passwordHash = password_hash($password, PASSWORD_DEFAULT);
        if (users_store_update_by_id((string)$user['id'], ['password' => $passwordHash])) {
            $user['password'] = $passwordHash;
            auth_issue_session_response($user, $authEmail);
        }

        respond(500, [
            'error' => users_store_last_error() ?: 'Nao consegui salvar a senha desta conta agora.',
        ]);
    }

    respond(401, ['error' => 'Conta sem senha cadastrada. Use "Esqueci minha senha" para definir uma nova.']);
}

$passwordInfo = function_exists('password_get_info') ? password_get_info($storedPassword) : ['algo' => 0];
$isHashed = (int)($passwordInfo['algo'] ?? 0) !== 0;

if (!$isHashed) {
    if (!hash_equals($storedPassword, (string)$password)) {
        if (auth_can_use_local_admin_fallback($authEmail, $user)) {
            auth_issue_session_response($user, $authEmail);
        }
        respond(401, ['error' => 'E-mail ou senha invalidos']);
    }

    auth_issue_session_response($user, $authEmail, [
        'password' => password_hash($password, PASSWORD_DEFAULT),
    ]);
}

if (!password_verify($password, $storedPassword)) {
    if (auth_can_use_local_admin_fallback($authEmail, $user)) {
        auth_issue_session_response($user, $authEmail);
    }
    respond(401, ['error' => 'E-mail ou senha invalidos']);
}

auth_issue_session_response($user, $authEmail);
