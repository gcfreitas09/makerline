<?php
require_once __DIR__ . '/users_store.php';

const LANDING_INSIGHTS_PRIVATE_ADMINS_FILE = __DIR__ . '/../storage/admins.json';
const LANDING_INSIGHTS_PRIVATE_ADMINS_EXAMPLE_FILE = __DIR__ . '/../storage/admins.example.json';
const LANDING_INSIGHTS_PRIVATE_SESSIONS_FILE = __DIR__ . '/../storage/landing_insights_sessions.json';
const LANDING_INSIGHTS_PRIVATE_ALLOWED_EMAILS = [
    'fgui3662@gmail.com',
    'lorenzo.ritter27@gmail.com',
];
const LANDING_INSIGHTS_PRIVATE_TTL_DEFAULT = 43200;
const LANDING_INSIGHTS_PRIVATE_TTL_REMEMBER = 1209600;

function landing_private_now_iso()
{
    return date('c');
}

function landing_private_load_json_file($file)
{
    if (!is_file($file)) return null;
    $raw = @file_get_contents($file);
    if ($raw === false) return null;
    $decoded = json_decode((string)$raw, true);
    return is_array($decoded) ? $decoded : null;
}

function landing_private_admin_emails()
{
    $data = landing_private_load_json_file(LANDING_INSIGHTS_PRIVATE_ADMINS_FILE);
    if (!$data) {
        $data = landing_private_load_json_file(LANDING_INSIGHTS_PRIVATE_ADMINS_EXAMPLE_FILE);
    }

    $rawEmails = is_array($data['emails'] ?? null) ? $data['emails'] : [];
    $emails = [];
    foreach ($rawEmails as $rawEmail) {
        $safe = strtolower(trim((string)$rawEmail));
        if ($safe === '') continue;
        $emails[$safe] = true;
    }

    return array_keys($emails);
}

function landing_private_allowed_emails()
{
    return LANDING_INSIGHTS_PRIVATE_ALLOWED_EMAILS;
}

function landing_private_is_allowed_email($email)
{
    $safeEmail = strtolower(trim((string)$email));
    if ($safeEmail === '') return false;

    return in_array($safeEmail, landing_private_allowed_emails(), true)
        && in_array($safeEmail, landing_private_admin_emails(), true);
}

function landing_private_verify_password($user, $password)
{
    if (!is_array($user)) return false;

    $storedPassword = (string)($user['password'] ?? '');
    if ($storedPassword === '') return false;

    $passwordInfo = function_exists('password_get_info') ? password_get_info($storedPassword) : ['algo' => 0];
    $isHashed = (int)($passwordInfo['algo'] ?? 0) !== 0;

    if (!$isHashed) {
        return hash_equals($storedPassword, (string)$password);
    }

    return password_verify((string)$password, $storedPassword);
}

function landing_private_default_sessions_store()
{
    return [
        'updatedAt' => null,
        'sessions' => [],
    ];
}

function landing_private_ensure_sessions_file($file = LANDING_INSIGHTS_PRIVATE_SESSIONS_FILE)
{
    if (is_file($file)) {
        return true;
    }

    $dir = dirname($file);
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        return false;
    }

    $created = @file_put_contents(
        $file,
        json_encode(landing_private_default_sessions_store(), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
        LOCK_EX
    );

    return $created !== false;
}

function landing_private_decode_sessions_store($raw)
{
    $decoded = json_decode((string)$raw, true);
    if (!is_array($decoded)) {
        return landing_private_default_sessions_store();
    }

    return [
        'updatedAt' => (string)($decoded['updatedAt'] ?? ''),
        'sessions' => is_array($decoded['sessions'] ?? null) ? array_values($decoded['sessions']) : [],
    ];
}

function landing_private_request_fingerprint()
{
    $userAgent = trim((string)($_SERVER['HTTP_USER_AGENT'] ?? ''));
    if ($userAgent === '') {
        return '';
    }

    return hash('sha256', $userAgent);
}

function landing_private_time_from_iso($value)
{
    $ts = strtotime((string)$value);
    return $ts !== false ? (int)$ts : 0;
}

function landing_private_gc_sessions($sessions)
{
    $now = time();
    $clean = [];

    foreach ((array)$sessions as $session) {
        if (!is_array($session)) continue;
        $tokenHash = trim((string)($session['tokenHash'] ?? ''));
        $email = strtolower(trim((string)($session['email'] ?? '')));
        $expiresAt = trim((string)($session['expiresAt'] ?? ''));

        if ($tokenHash === '' || $email === '' || $expiresAt === '') continue;
        if (landing_private_time_from_iso($expiresAt) <= $now) continue;

        $clean[] = $session;
    }

    return array_values($clean);
}

function landing_private_encode_sessions_store($store)
{
    $store['updatedAt'] = landing_private_now_iso();
    return json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
}

function landing_private_write_sessions_store($fp, $store)
{
    $json = landing_private_encode_sessions_store($store);
    if (!is_string($json)) {
        return false;
    }

    rewind($fp);
    ftruncate($fp, 0);
    $written = fwrite($fp, $json);
    fflush($fp);

    return $written !== false;
}

function landing_private_open_sessions_handle($file = LANDING_INSIGHTS_PRIVATE_SESSIONS_FILE)
{
    if (!landing_private_ensure_sessions_file($file)) {
        return null;
    }

    $fp = @fopen($file, 'c+');
    return $fp ?: null;
}

function landing_private_create_session($email, $remember = false, $file = LANDING_INSIGHTS_PRIVATE_SESSIONS_FILE)
{
    $safeEmail = strtolower(trim((string)$email));
    if ($safeEmail === '') {
        return ['ok' => false, 'error' => 'Email invalido para sessao privada.'];
    }

    $fp = landing_private_open_sessions_handle($file);
    if (!$fp) {
        return ['ok' => false, 'error' => 'Nao consegui abrir o storage da sessao privada.'];
    }

    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        return ['ok' => false, 'error' => 'Nao consegui bloquear o storage da sessao privada.'];
    }

    $raw = stream_get_contents($fp);
    $store = landing_private_decode_sessions_store($raw ?: '');
    $store['sessions'] = landing_private_gc_sessions($store['sessions'] ?? []);

    $token = bin2hex(random_bytes(24));
    $ttl = $remember ? LANDING_INSIGHTS_PRIVATE_TTL_REMEMBER : LANDING_INSIGHTS_PRIVATE_TTL_DEFAULT;
    $nowIso = landing_private_now_iso();
    $expiresAt = date('c', time() + $ttl);

    $store['sessions'][] = [
        'tokenHash' => hash('sha256', $token),
        'email' => $safeEmail,
        'remember' => $remember ? true : false,
        'fingerprint' => landing_private_request_fingerprint(),
        'createdAt' => $nowIso,
        'lastSeenAt' => $nowIso,
        'expiresAt' => $expiresAt,
    ];

    $saved = landing_private_write_sessions_store($fp, $store);
    flock($fp, LOCK_UN);
    fclose($fp);

    if (!$saved) {
        return ['ok' => false, 'error' => 'Nao consegui salvar a sessao privada.'];
    }

    return [
        'ok' => true,
        'token' => $token,
        'expiresAt' => $expiresAt,
        'remember' => $remember ? true : false,
    ];
}

function landing_private_find_session($token, $touch = true, $file = LANDING_INSIGHTS_PRIVATE_SESSIONS_FILE)
{
    $safeToken = trim((string)$token);
    if ($safeToken === '') return null;

    $fp = landing_private_open_sessions_handle($file);
    if (!$fp) return null;

    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        return null;
    }

    $raw = stream_get_contents($fp);
    $store = landing_private_decode_sessions_store($raw ?: '');
    $sessions = landing_private_gc_sessions($store['sessions'] ?? []);
    $storeChanged = count($sessions) !== count((array)($store['sessions'] ?? []));
    $store['sessions'] = $sessions;

    $tokenHash = hash('sha256', $safeToken);
    $fingerprint = landing_private_request_fingerprint();
    $found = null;
    $foundIndex = null;

    foreach ($store['sessions'] as $index => $session) {
        if (!is_array($session)) continue;
        if (!hash_equals((string)($session['tokenHash'] ?? ''), $tokenHash)) continue;

        $sessionFingerprint = trim((string)($session['fingerprint'] ?? ''));
        if ($sessionFingerprint !== '' && $fingerprint !== '' && !hash_equals($sessionFingerprint, $fingerprint)) {
            $found = null;
            $foundIndex = null;
            break;
        }

        $found = $session;
        $foundIndex = $index;
        break;
    }

    if ($found && $touch && $foundIndex !== null) {
        $ttl = !empty($found['remember']) ? LANDING_INSIGHTS_PRIVATE_TTL_REMEMBER : LANDING_INSIGHTS_PRIVATE_TTL_DEFAULT;
        $store['sessions'][$foundIndex]['lastSeenAt'] = landing_private_now_iso();
        $store['sessions'][$foundIndex]['expiresAt'] = date('c', time() + $ttl);
        $found = $store['sessions'][$foundIndex];
        $storeChanged = true;
    }

    if ($storeChanged) {
        landing_private_write_sessions_store($fp, $store);
    }

    flock($fp, LOCK_UN);
    fclose($fp);

    return $found;
}

function landing_private_destroy_session($token, $file = LANDING_INSIGHTS_PRIVATE_SESSIONS_FILE)
{
    $safeToken = trim((string)$token);
    if ($safeToken === '') return true;

    $fp = landing_private_open_sessions_handle($file);
    if (!$fp) return false;

    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        return false;
    }

    $raw = stream_get_contents($fp);
    $store = landing_private_decode_sessions_store($raw ?: '');
    $store['sessions'] = landing_private_gc_sessions($store['sessions'] ?? []);

    $tokenHash = hash('sha256', $safeToken);
    $filtered = [];
    foreach ($store['sessions'] as $session) {
        if (!is_array($session)) continue;
        if (hash_equals((string)($session['tokenHash'] ?? ''), $tokenHash)) {
            continue;
        }
        $filtered[] = $session;
    }

    $store['sessions'] = array_values($filtered);
    $saved = landing_private_write_sessions_store($fp, $store);

    flock($fp, LOCK_UN);
    fclose($fp);

    return $saved;
}

function landing_private_authenticate_token($token)
{
    $session = landing_private_find_session($token, true);
    if (!is_array($session)) {
        return ['ok' => false, 'status' => 401, 'error' => 'Sessao privada invalida ou expirada.'];
    }

    $email = strtolower(trim((string)($session['email'] ?? '')));
    if (!landing_private_is_allowed_email($email)) {
        return ['ok' => false, 'status' => 403, 'error' => 'Sem permissao para este tracker.'];
    }

    $user = users_store_find_by_email($email);
    if (!is_array($user)) {
        return ['ok' => false, 'status' => 401, 'error' => 'Conta do tracker nao encontrada.'];
    }

    return [
        'ok' => true,
        'user' => $user,
        'session' => $session,
        'email' => $email,
    ];
}
