<?php
// api/users_store.php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/supabase_client.php';

const UGC_USERS_FILE_PATH = __DIR__ . '/../storage/users.json';
const UGC_USERS_TABLE_FALLBACK = 'ugc_users';
const UGC_DELETED_EMAILS_FILE_PATH = __DIR__ . '/../storage/deleted_emails.json';
const UGC_SECURITY_AUDIT_FILE_PATH = __DIR__ . '/../storage/security_audit.log';

$GLOBALS['UGC_USERS_STORE_LAST_ERROR'] = null;

function users_store_last_error()
{
    return $GLOBALS['UGC_USERS_STORE_LAST_ERROR'];
}

function users_store_set_error($message)
{
    $GLOBALS['UGC_USERS_STORE_LAST_ERROR'] = (string)$message;
}

function users_store_security_audit($action, $userId = '', $origin = '', $adminId = null, $meta = [])
{
    $entry = [
        'created_at' => date('c'),
        'user_id' => (string)$userId,
        'action' => (string)$action,
        'origin' => (string)$origin,
        'admin_id' => $adminId === null ? null : (string)$adminId,
        'meta' => is_array($meta) ? $meta : [],
    ];

    $entry['meta'] = array_filter($entry['meta'], function ($value, $key) {
        return !in_array(strtolower((string)$key), ['password', 'senha', 'newpassword', 'currentpassword'], true);
    }, ARRAY_FILTER_USE_BOTH);

    @file_put_contents(
        UGC_SECURITY_AUDIT_FILE_PATH,
        json_encode($entry, JSON_UNESCAPED_UNICODE) . PHP_EOL,
        FILE_APPEND | LOCK_EX
    );
}

function users_store_is_blank_secret($value)
{
    if ($value === null) return true;
    if (is_string($value)) return trim($value) === '';
    return true;
}

function users_store_filter_update_fields($id, $fields, $origin = 'users_store_update_by_id', $adminId = null)
{
    $clean = is_array($fields) ? $fields : (array)$fields;

    foreach (['password', 'senha'] as $key) {
        if (!array_key_exists($key, $clean)) continue;

        if ($key === 'senha' || users_store_is_blank_secret($clean[$key])) {
            users_store_security_audit('empty_password_update_ignored', $id, $origin, $adminId, [
                'field' => $key,
                'reason' => $key === 'senha' ? 'unsupported_alias' : 'blank_value',
            ]);
            unset($clean[$key]);
            continue;
        }

        users_store_security_audit('password_changed', $id, $origin, $adminId);
    }

    return $clean;
}

function users_store_table()
{
    $cfg = db_config();
    $table = is_array($cfg) ? (string)($cfg['table_users'] ?? '') : '';
    $table = trim($table);
    return $table !== '' ? $table : UGC_USERS_TABLE_FALLBACK;
}

function users_store_db_ready()
{
    static $checked = false;
    static $ready = false;

    if ($checked) return $ready;
    $checked = true;

    $cfg = db_config();
    if (!$cfg || empty($cfg['enabled'])) {
        $ready = false;
        return $ready;
    }

    $pdo = db();
    if (!$pdo) {
        $info = db_last_info();
        $err = is_array($info) && !empty($info['error']) ? $info['error'] : 'Falha ao conectar no banco.';
        users_store_set_error($err);
        $ready = false;
        return $ready;
    }

    $table = users_store_table();
    try {
        $pdo->query("SELECT 1 FROM `{$table}` LIMIT 1");
        $ready = true;
        return $ready;
    } catch (Throwable $e) {
        users_store_set_error('Banco configurado, mas a tabela de usuários não existe ainda. Importa o schema SQL.');
        $ready = false;
        return $ready;
    }
}

function users_store_supabase_table()
{
    $cfg = supabase_config();
    $table = is_array($cfg) ? (string)($cfg['table_users'] ?? '') : '';
    $table = trim($table);
    return $table !== '' ? $table : UGC_USERS_TABLE_FALLBACK;
}

function users_store_supabase_eq($value)
{
    // PostgREST expects filters like eq.value here. Quoting the whole value
    // breaks matches for emails/ids and causes false "not found" responses.
    return 'eq.' . (string)$value;
}

function users_store_supabase_ready()
{
    static $checked = false;
    static $ready = false;

    if ($checked) return $ready;
    $checked = true;

    $cfg = supabase_config();
    if (!$cfg || empty($cfg['enabled'])) {
        $ready = false;
        return $ready;
    }

    $serviceKey = trim((string)($cfg['service_key'] ?? ''));
    if ($serviceKey === '' || preg_match('/^(sb_publishable_|sb_anon_|anon_)/i', $serviceKey)) {
        users_store_set_error('Supabase está configurado sem chave de serviço no backend. Usando storage/users.json como fallback.');
        $ready = false;
        return $ready;
    }

    $table = users_store_supabase_table();
    $res = supabase_client_request('GET', $table, ['select' => 'id', 'limit' => 1], null);
    if (is_array($res) && !empty($res['ok'])) {
        $ready = true;
        return $ready;
    }

    $status = (int)($res['status'] ?? 0);
    $err = (string)($res['error'] ?? '');

    if ($status === 404) {
        users_store_set_error('Supabase configurado, mas a tabela de usuários não existe ainda. Roda o SQL em sql/ugc_users.supabase.sql.');
    } elseif ($status === 401 || $status === 403) {
        users_store_set_error('Supabase: sem permissão para acessar a tabela. Confira storage/supabase.json (service_key).');
    } else {
        users_store_set_error($err ?: 'Falha ao acessar Supabase.');
    }

    $ready = false;
    return $ready;
}

function users_store_backend()
{
    $supabaseCfg = supabase_config();
    if (is_array($supabaseCfg) && !empty($supabaseCfg['enabled'])) {
        if (users_store_supabase_ready()) return 'supabase';
    }

    $cfg = db_config();
    if (is_array($cfg) && !empty($cfg['enabled'])) {
        if (users_store_db_ready()) return 'mysql';
    }

    return 'json';
}

function users_store_ensure_file()
{
    $file = UGC_USERS_FILE_PATH;
    if (file_exists($file)) return true;

    // Se o arquivo sumiu (deploy/FTP sobrescreveu), tenta restaurar do último backup.
    if (users_store_restore_latest_backup()) {
        return file_exists($file);
    }
    $dir = dirname($file);
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    $ok = @file_put_contents($file, json_encode([], JSON_UNESCAPED_UNICODE), LOCK_EX);
    if ($ok === false) {
        users_store_set_error('Não consegui criar storage/users.json. Confira a permissão de escrita no servidor.');
        return false;
    }
    return true;
}

function users_store_load_all_json()
{
    if (!users_store_ensure_file()) return null;

    $raw = @file_get_contents(UGC_USERS_FILE_PATH);
    if ($raw === false) {
        users_store_set_error('Não consegui ler storage/users.json. Confira a permissão de leitura no servidor.');
        return null;
    }

    $trimmed = trim((string)$raw);
    if ($trimmed === '') {
        // Tenta recuperar automaticamente do último backup.
        if (users_store_restore_latest_backup()) {
            $raw = @file_get_contents(UGC_USERS_FILE_PATH);
            if ($raw === false) {
                users_store_set_error('Não consegui ler storage/users.json depois do restore. Confira a permissão.');
                return null;
            }
            $trimmed = trim((string)$raw);
        }

        if ($trimmed === '') {
            users_store_set_error('storage/users.json está vazio. Isso costuma acontecer quando o arquivo foi apagado/truncado.');
            return null;
        }
    }

    $data = json_decode((string)$raw, true);
    if (!is_array($data)) {
        // Tenta recuperar automaticamente do último backup.
        if (users_store_restore_latest_backup()) {
            $raw = @file_get_contents(UGC_USERS_FILE_PATH);
            $data = json_decode((string)$raw, true);
        }

        if (!is_array($data)) {
            users_store_set_error('storage/users.json está corrompido (JSON inválido).');
            return null;
        }
    }

    // Se o arquivo foi sobrescrito (ex: virou "[]") mas ainda existem backups, tenta trazer o último backup.
    if (is_array($data) && count($data) === 0) {
        if (users_store_restore_latest_backup()) {
            $raw2 = @file_get_contents(UGC_USERS_FILE_PATH);
            $data2 = $raw2 !== false ? json_decode((string)$raw2, true) : null;
            if (is_array($data2) && count($data2) > 0) {
                $data = $data2;
            }
        }
    }

    // Se o arquivo foi sobrescrito num deploy (ficou com poucos/nenhum usuário),
    // tenta recuperar os cadastros a partir dos states existentes.
    if (is_array($data)) {
        $filtered = users_store_filter_deleted_users($data);
        if (count($filtered) !== count($data)) {
            $data = $filtered;
            users_store_save_all_json($data);
        }
        $data = users_store_merge_missing_from_state_files($data);
        $data = users_store_restore_missing_passwords_from_backups($data);
    }

    if (!is_array($data)) {
        return null;
    }

    $normalized = [];
    foreach ($data as $user) {
        $safe = users_store_normalize_user(is_array($user) ? $user : null);
        if ($safe) $normalized[] = $safe;
    }

    return $normalized;
}

function users_store_states_dir()
{
    return __DIR__ . '/../storage/states';
}

function users_store_list_state_files()
{
    $dir = users_store_states_dir();
    if (!is_dir($dir)) return [];
    $files = glob($dir . DIRECTORY_SEPARATOR . '*.json') ?: [];
    return array_values(array_filter($files, function ($path) {
        return is_string($path) && is_file($path);
    }));
}

function users_store_load_deleted_emails_map()
{
    $file = UGC_DELETED_EMAILS_FILE_PATH;
    if (!is_file($file)) return [];

    $raw = @file_get_contents($file);
    if ($raw === false || trim((string)$raw) === '') return [];

    $data = json_decode((string)$raw, true);
    if (!is_array($data)) return [];

    $map = [];
    foreach ($data as $email) {
        $e = trim(strtolower((string)$email));
        if ($e === '') continue;
        if (!filter_var($e, FILTER_VALIDATE_EMAIL)) continue;
        $map[$e] = true;
    }
    return $map;
}

function users_store_is_deleted_email($email)
{
    $email = trim(strtolower((string)$email));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) return false;

    $deletedEmails = users_store_load_deleted_emails_map();
    return isset($deletedEmails[$email]);
}

function users_store_filter_deleted_users($users)
{
    if (!is_array($users) || !$users) {
        return is_array($users) ? $users : [];
    }

    $deletedEmails = users_store_load_deleted_emails_map();
    if (!$deletedEmails) return $users;

    return array_values(array_filter($users, function ($user) use ($deletedEmails) {
        $email = trim(strtolower((string)($user['email'] ?? '')));
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) return true;
        return !isset($deletedEmails[$email]);
    }));
}

function users_store_purge_legacy_user($id, $email = '')
{
    $id = trim((string)$id);
    $email = trim(strtolower((string)$email));

    $users = users_store_load_legacy_users_json();
    if (!is_array($users)) return true;

    $filtered = array_values(array_filter($users, function ($user) use ($id, $email) {
        $userId = trim((string)($user['id'] ?? ''));
        $userEmail = trim(strtolower((string)($user['email'] ?? '')));

        if ($id !== '' && $userId === $id) return false;
        if ($email !== '' && $userEmail === $email) return false;
        return true;
    }));

    if (count($filtered) === count($users)) return true;
    return users_store_save_all_json($filtered);
}

function users_store_user_from_state_file($path)
{
    $raw = @file_get_contents($path);
    if ($raw === false) return null;
    $payload = json_decode((string)$raw, true);
    if (!is_array($payload)) return null;

    $userId = trim((string)($payload['userId'] ?? ''));
    $state = $payload['state'] ?? null;
    if ($userId === '' || !is_array($state)) return null;

    $profile = is_array($state['profile'] ?? null) ? $state['profile'] : [];
    $email = trim(strtolower((string)($profile['email'] ?? '')));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) return null;
    if (users_store_is_deleted_email($email)) return null;

    $name = trim((string)($profile['name'] ?? ''));
    if ($name === '') {
        $name = (string)(strstr($email, '@', true) ?: 'Creator');
    }

    $createdAt = (string)($payload['updatedAt'] ?? '');
    if ($createdAt === '') {
        $mtime = @filemtime($path);
        $createdAt = $mtime ? date('c', $mtime) : date('c');
    }

    return [
        'id' => $userId,
        'name' => $name,
        'email' => $email,
        'referralCode' => null,
        'referredBy' => null,
        // Se recuperou via state, pode estar sem senha. Aí o login pede "Esqueci minha senha".
        'password' => '',
        'createdAt' => $createdAt,
        'accessCount' => 0,
        'timeSpentSeconds' => 0,
        'lastLoginAt' => null,
        'lastSeenAt' => null,
        'lastAccessAt' => null,
        'stripeCustomerId' => null,
        'stripeSubscriptionId' => null,
        'stripePriceId' => null,
        'stripeProductId' => null,
        'billingStatus' => 'free',
        'billingInterval' => null,
        'billingCurrentPeriodEnd' => null,
        'billingCancelAtPeriodEnd' => false,
        'billingLastEventId' => null,
        'billingLastSyncedAt' => null,
        'sessionTokenHash' => null,
        'sessionTokenExpires' => null,
        'resetTokenHash' => null,
        'resetTokenExpires' => null,
        'resetCodeHash' => null,
        'resetCodeExpires' => null
    ];
}

function users_store_merge_missing_from_state_files($users)
{
    if (!is_array($users)) return $users;

    $stateFiles = users_store_list_state_files();
    if (!$stateFiles) return $users;

    // Só tenta reconstruir/mesclar se tem mais state do que usuário (sinal de que users.json foi sobrescrito).
    if (count($stateFiles) <= count($users)) return $users;

    $byId = [];
    $byEmail = [];
    foreach ($users as $u) {
        $id = (string)($u['id'] ?? '');
        $email = trim(strtolower((string)($u['email'] ?? '')));
        if ($id !== '') $byId[$id] = true;
        if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) $byEmail[$email] = true;
    }

    $merged = $users;
    $added = 0;
    $deletedEmails = users_store_load_deleted_emails_map();

    foreach ($stateFiles as $path) {
        $candidate = users_store_user_from_state_file($path);
        if (!$candidate) continue;
        $id = (string)($candidate['id'] ?? '');
        $email = trim(strtolower((string)($candidate['email'] ?? '')));
        if ($id === '' || $email === '') continue;
        if (isset($deletedEmails[$email])) continue;
        if (isset($byId[$id]) || isset($byEmail[$email])) continue;

        $merged[] = $candidate;
        $byId[$id] = true;
        $byEmail[$email] = true;
        $added++;
    }

    if ($added > 0) {
        usort($merged, function ($a, $b) {
            return strcmp((string)($a['createdAt'] ?? ''), (string)($b['createdAt'] ?? ''));
        });
        users_store_save_all_json($merged);
    }

    return $merged;
}

function users_store_restore_latest_backup()
{
    $file = UGC_USERS_FILE_PATH;
    $dir = dirname($file);
    $backupDir = $dir . DIRECTORY_SEPARATOR . 'backups';
    if (!is_dir($backupDir)) return false;

    $pattern = $backupDir . DIRECTORY_SEPARATOR . 'users_*.json';
    $candidates = glob($pattern) ?: [];
    if (!$candidates) return false;

    usort($candidates, function ($a, $b) {
        return (int)@filemtime($b) <=> (int)@filemtime($a);
    });

    $latest = $candidates[0] ?? null;
    if (!$latest || !is_file($latest)) return false;

    return @copy($latest, $file);
}

function users_store_backup_users_file()
{
    $file = UGC_USERS_FILE_PATH;
    if (!file_exists($file)) return true;

    $dir = dirname($file);
    $backupDir = $dir . DIRECTORY_SEPARATOR . 'backups';
    if (!is_dir($backupDir)) {
        @mkdir($backupDir, 0775, true);
    }

    // Evita criar mil backups (ex: cada login atualiza token).
    $pattern = $backupDir . DIRECTORY_SEPARATOR . 'users_*.json';
    $existing = glob($pattern) ?: [];
    $latestMtime = 0;
    foreach ($existing as $path) {
        $mtime = @filemtime($path);
        if ($mtime && $mtime > $latestMtime) $latestMtime = $mtime;
    }
    if ($latestMtime && (time() - $latestMtime) < 1800) {
        return true;
    }

    $timestamp = date('Ymd_His');
    $backupFile = $backupDir . DIRECTORY_SEPARATOR . "users_{$timestamp}.json";

    // Não trava o app se backup falhar (mas tenta).
    @copy($file, $backupFile);

    // Mantém só os mais recentes (pra não lotar o disco).
    $existing = glob($pattern) ?: [];
    if (count($existing) > 60) {
        usort($existing, function ($a, $b) {
            return (int)@filemtime($a) <=> (int)@filemtime($b);
        });
        $toDelete = array_slice($existing, 0, count($existing) - 60);
        foreach ($toDelete as $path) {
            @unlink($path);
        }
    }

    return true;
}

function users_store_find_backup_password_for_user($user)
{
    if (!is_array($user)) return '';

    $id = trim((string)($user['id'] ?? ''));
    $email = trim(strtolower((string)($user['email'] ?? '')));
    if ($id === '' && $email === '') return '';

    $backupDir = dirname(UGC_USERS_FILE_PATH) . DIRECTORY_SEPARATOR . 'backups';
    if (!is_dir($backupDir)) return '';

    $candidates = glob($backupDir . DIRECTORY_SEPARATOR . 'users*.json') ?: [];
    if (!$candidates) return '';

    usort($candidates, function ($a, $b) {
        return (int)@filemtime($b) <=> (int)@filemtime($a);
    });

    foreach ($candidates as $path) {
        $raw = @file_get_contents($path);
        $data = $raw !== false ? json_decode((string)$raw, true) : null;
        if (!is_array($data)) continue;

        foreach ($data as $candidate) {
            if (!is_array($candidate)) continue;

            $candidateId = trim((string)($candidate['id'] ?? ''));
            $candidateEmail = trim(strtolower((string)($candidate['email'] ?? '')));
            $matchesId = $id !== '' && $candidateId === $id;
            $matchesEmail = $email !== '' && $candidateEmail === $email;
            if (!$matchesId && !$matchesEmail) continue;

            $password = trim((string)($candidate['password'] ?? ''));
            if ($password !== '') return $password;
        }
    }

    return '';
}

function users_store_restore_missing_passwords_from_backups($users)
{
    if (!is_array($users) || !$users) return $users;

    $changed = false;
    foreach ($users as $index => $user) {
        if (!is_array($user)) continue;
        if (trim((string)($user['password'] ?? '')) !== '') continue;

        $password = users_store_find_backup_password_for_user($user);
        if ($password === '') continue;

        $users[$index]['password'] = $password;
        $changed = true;
    }

    if ($changed) {
        users_store_save_all_json($users);
    }

    return $users;
}

function users_store_restore_missing_password_for_user($user)
{
    if (!is_array($user) || empty($user['id'])) return $user;
    if (trim((string)($user['password'] ?? '')) !== '') return $user;

    $password = users_store_find_backup_password_for_user($user);
    if ($password === '') return $user;

    if (users_store_update_by_id((string)$user['id'], ['password' => $password])) {
        $user['password'] = $password;
    }

    return $user;
}

function users_store_save_all_json($users)
{
    if (!users_store_ensure_file()) return false;
    users_store_backup_users_file();
    $ok = @file_put_contents(
        UGC_USERS_FILE_PATH,
        json_encode($users, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
        LOCK_EX
    );
    if ($ok === false) {
        users_store_set_error('Não consegui salvar em storage/users.json. Confira a permissão de escrita no servidor.');
        return false;
    }
    return true;
}

function users_store_normalize_user($user)
{
    if (!is_array($user)) return null;

    if (array_key_exists('email', $user)) {
        $user['email'] = trim(strtolower((string)$user['email']));
    }
    if (array_key_exists('instagram', $user)) {
        $instagram = strtolower(trim((string)$user['instagram']));
        $instagram = ltrim($instagram, '@');
        $instagram = preg_replace('/[^a-z0-9._]+/', '', $instagram);
        $user['instagram'] = trim((string)$instagram) ?: null;
    } else {
        $user['instagram'] = null;
    }

    $user['referralCode'] = trim((string)($user['referralCode'] ?? '')) ?: null;
    $user['referredBy'] = trim((string)($user['referredBy'] ?? '')) ?: null;
    $user['accessCount'] = (int)($user['accessCount'] ?? 0);
    $user['timeSpentSeconds'] = (int)($user['timeSpentSeconds'] ?? 0);
    $user['sessionTokenExpires'] = $user['sessionTokenExpires'] !== null ? (int)$user['sessionTokenExpires'] : null;
    $user['resetTokenExpires'] = $user['resetTokenExpires'] !== null ? (int)$user['resetTokenExpires'] : null;
    $user['resetCodeExpires'] = $user['resetCodeExpires'] !== null ? (int)$user['resetCodeExpires'] : null;

    $user['stripeCustomerId'] = trim((string)($user['stripeCustomerId'] ?? '')) ?: null;
    $user['stripeSubscriptionId'] = trim((string)($user['stripeSubscriptionId'] ?? '')) ?: null;
    $user['stripePriceId'] = trim((string)($user['stripePriceId'] ?? '')) ?: null;
    $user['stripeProductId'] = trim((string)($user['stripeProductId'] ?? '')) ?: null;
    $user['billingStatus'] = trim((string)($user['billingStatus'] ?? '')) ?: 'free';
    $user['billingInterval'] = trim((string)($user['billingInterval'] ?? '')) ?: null;
    $user['billingCurrentPeriodEnd'] = array_key_exists('billingCurrentPeriodEnd', $user) && $user['billingCurrentPeriodEnd'] !== null
        ? (trim((string)$user['billingCurrentPeriodEnd']) ?: null)
        : null;
    $user['billingCancelAtPeriodEnd'] = !empty($user['billingCancelAtPeriodEnd']);
    $user['billingLastEventId'] = trim((string)($user['billingLastEventId'] ?? '')) ?: null;
    $user['billingLastSyncedAt'] = array_key_exists('billingLastSyncedAt', $user) && $user['billingLastSyncedAt'] !== null
        ? (trim((string)$user['billingLastSyncedAt']) ?: null)
        : null;
    $user['cpfHash'] = trim((string)($user['cpfHash'] ?? '')) ?: null;
    $user['cpfLast4'] = trim((string)($user['cpfLast4'] ?? '')) ?: null;
    $user['trialStartedAt'] = array_key_exists('trialStartedAt', $user) && $user['trialStartedAt'] !== null
        ? (trim((string)$user['trialStartedAt']) ?: null)
        : null;
    $user['trialEndsAt'] = array_key_exists('trialEndsAt', $user) && $user['trialEndsAt'] !== null
        ? (trim((string)$user['trialEndsAt']) ?: null)
        : null;

    return $user;
}

function users_store_row_to_user($row)
{
    if (!is_array($row)) return null;
    $user = $row;

    // Mapeia snake_case (Supabase) para camelCase (app).
    $map = [
        'created_at' => 'createdAt',
        'instagram' => 'instagram',
        'referral_code' => 'referralCode',
        'referred_by' => 'referredBy',
        'access_count' => 'accessCount',
        'time_spent_seconds' => 'timeSpentSeconds',
        'last_login_at' => 'lastLoginAt',
        'last_seen_at' => 'lastSeenAt',
        'last_access_at' => 'lastAccessAt',
        'stripe_customer_id' => 'stripeCustomerId',
        'stripe_subscription_id' => 'stripeSubscriptionId',
        'stripe_price_id' => 'stripePriceId',
        'stripe_product_id' => 'stripeProductId',
        'billing_status' => 'billingStatus',
        'billing_interval' => 'billingInterval',
        'billing_current_period_end' => 'billingCurrentPeriodEnd',
        'billing_cancel_at_period_end' => 'billingCancelAtPeriodEnd',
        'billing_last_event_id' => 'billingLastEventId',
        'billing_last_synced_at' => 'billingLastSyncedAt',
        'cpf_hash' => 'cpfHash',
        'cpf_last4' => 'cpfLast4',
        'trial_started_at' => 'trialStartedAt',
        'trial_ends_at' => 'trialEndsAt',
        'session_token_hash' => 'sessionTokenHash',
        'session_token_expires' => 'sessionTokenExpires',
        'reset_token_hash' => 'resetTokenHash',
        'reset_token_expires' => 'resetTokenExpires',
        'reset_code_hash' => 'resetCodeHash',
        'reset_code_expires' => 'resetCodeExpires'
    ];
    foreach ($map as $from => $to) {
        if (array_key_exists($from, $row) && !array_key_exists($to, $user)) {
            $user[$to] = $row[$from];
        }
    }

    if (array_key_exists('email', $user)) {
        $user['email'] = trim(strtolower((string)$user['email']));
    }

    return users_store_normalize_user($user);
}

function users_store_load_all()
{
    $backend = users_store_backend();
    if ($backend === 'mysql') {
        $pdo = db();
        $table = users_store_table();
        $rows = $pdo->query("SELECT * FROM `{$table}`")->fetchAll();
        $out = [];
        foreach ($rows as $row) {
            $u = users_store_row_to_user($row);
            if ($u) $out[] = $u;
        }
        return $out;
    }
    if ($backend === 'supabase') {
        $table = users_store_supabase_table();
        $res = supabase_client_request('GET', $table, ['select' => '*', 'order' => 'created_at.desc'], null);
        if (!is_array($res) || empty($res['ok'])) {
            users_store_set_error((string)($res['error'] ?? 'Falha ao listar usuários no Supabase.'));
            return [];
        }
        $rows = $res['data'];
        if (!is_array($rows)) return [];
        $out = [];
        foreach ($rows as $row) {
            $u = users_store_row_to_user(is_array($row) ? $row : null);
            if ($u) $out[] = $u;
        }
        return $out;
    }
    if ($backend === 'error') {
        return [];
    }
    $users = users_store_load_all_json();
    return is_array($users) ? $users : [];
}

function users_store_find_by_email_mysql($email)
{
    $pdo = db();
    if (!$pdo) return null;
    $table = users_store_table();
    $stmt = $pdo->prepare("SELECT * FROM `{$table}` WHERE `email` = :email LIMIT 1");
    $stmt->execute(['email' => $email]);
    $row = $stmt->fetch();
    return users_store_row_to_user($row ?: null);
}

function users_store_find_by_instagram_mysql($instagram)
{
    $pdo = db();
    if (!$pdo) return null;
    $table = users_store_table();

    try {
        $stmt = $pdo->prepare("SELECT * FROM `{$table}` WHERE `instagram` = :instagram LIMIT 1");
        $stmt->execute(['instagram' => $instagram]);
        $row = $stmt->fetch();
        return users_store_row_to_user($row ?: null);
    } catch (Throwable $e) {
        users_store_set_error($e->getMessage());
        return null;
    }
}

function users_store_load_legacy_users_json()
{
    $file = UGC_USERS_FILE_PATH;
    if (!file_exists($file)) return [];
    $raw = @file_get_contents($file);
    $data = json_decode((string)$raw, true);
    return users_store_filter_deleted_users(is_array($data) ? $data : []);
}

function users_store_payload_from_legacy($row)
{
    if (!is_array($row)) return null;

    $email = trim(strtolower((string)($row['email'] ?? '')));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) return null;

    $id = trim((string)($row['id'] ?? ''));
    if ($id === '') $id = uniqid('u_', true);

    return [
        'id' => $id,
        'name' => (string)($row['name'] ?? 'Creator'),
        'email' => $email,
        'instagram' => $row['instagram'] ?? null,
        'password' => (string)($row['password'] ?? ''),
        'createdAt' => (string)($row['createdAt'] ?? date('c')),
        'accessCount' => (int)($row['accessCount'] ?? 0),
        'timeSpentSeconds' => (int)($row['timeSpentSeconds'] ?? 0),
        'lastLoginAt' => $row['lastLoginAt'] ?? null,
        'lastSeenAt' => $row['lastSeenAt'] ?? null,
        'lastAccessAt' => $row['lastAccessAt'] ?? null,
        'stripeCustomerId' => $row['stripeCustomerId'] ?? null,
        'stripeSubscriptionId' => $row['stripeSubscriptionId'] ?? null,
        'stripePriceId' => $row['stripePriceId'] ?? null,
        'stripeProductId' => $row['stripeProductId'] ?? null,
        'billingStatus' => $row['billingStatus'] ?? 'free',
        'billingInterval' => $row['billingInterval'] ?? null,
        'billingCurrentPeriodEnd' => $row['billingCurrentPeriodEnd'] ?? null,
        'billingCancelAtPeriodEnd' => !empty($row['billingCancelAtPeriodEnd']),
        'billingLastEventId' => $row['billingLastEventId'] ?? null,
        'billingLastSyncedAt' => $row['billingLastSyncedAt'] ?? null,
        'cpfHash' => $row['cpfHash'] ?? null,
        'cpfLast4' => $row['cpfLast4'] ?? null,
        'trialStartedAt' => $row['trialStartedAt'] ?? null,
        'trialEndsAt' => $row['trialEndsAt'] ?? null,
        'sessionTokenHash' => $row['sessionTokenHash'] ?? null,
        'sessionTokenExpires' => $row['sessionTokenExpires'] ?? null,
        'resetTokenHash' => $row['resetTokenHash'] ?? null,
        'resetTokenExpires' => $row['resetTokenExpires'] ?? null,
        'resetCodeHash' => $row['resetCodeHash'] ?? null,
        'resetCodeExpires' => $row['resetCodeExpires'] ?? null
    ];
}

function users_store_find_by_email($email)
{
    $email = trim(strtolower((string)$email));
    if ($email === '') return null;

    $backend = users_store_backend();
    if ($backend === 'mysql') {
        $user = users_store_find_by_email_mysql($email);
        if ($user) return users_store_restore_missing_password_for_user($user);
        if (users_store_is_deleted_email($email)) return null;

        // Migração suave: se o usuário só existe no JSON antigo, puxa pro MySQL e segue o jogo.
        $legacyUsers = users_store_load_legacy_users_json();
        foreach ($legacyUsers as $row) {
            $rowEmail = trim(strtolower((string)($row['email'] ?? '')));
            if ($rowEmail !== $email) continue;

            $payload = users_store_payload_from_legacy($row);
            if (!$payload) break;

            $ok = users_store_insert($payload);
            if (!$ok) {
                $err = (string)(users_store_last_error() ?? '');
                $looksLikeIdDup = stripos($err, 'duplicate') !== false && (stripos($err, 'PRIMARY') !== false || stripos($err, 'id') !== false);
                if ($looksLikeIdDup) {
                    $payload['id'] = uniqid('u_', true);
                    $ok = users_store_insert($payload);
                }
            }

            if ($ok) {
                return users_store_restore_missing_password_for_user(users_store_find_by_email_mysql($email));
            }
            break;
        }

        return null;
    }
    if ($backend === 'supabase') {
        $table = users_store_supabase_table();
        $res = supabase_client_request('GET', $table, ['select' => '*', 'email' => users_store_supabase_eq($email), 'limit' => 1], null);
        if (is_array($res) && !empty($res['ok']) && is_array($res['data']) && count($res['data']) > 0) {
            return users_store_restore_missing_password_for_user(users_store_row_to_user(is_array($res['data'][0]) ? $res['data'][0] : null));
        }
        if (users_store_is_deleted_email($email)) return null;

        // Migração suave: se o usuário só existe no JSON antigo, puxa pro Supabase e segue o jogo.
        $legacyUsers = users_store_load_legacy_users_json();
        foreach ($legacyUsers as $row) {
            $rowEmail = trim(strtolower((string)($row['email'] ?? '')));
            if ($rowEmail !== $email) continue;

            $payload = users_store_payload_from_legacy($row);
            if (!$payload) break;

            $ok = users_store_insert($payload);
            if (!$ok) {
                $err = (string)(users_store_last_error() ?? '');
                $looksLikeIdDup = stripos($err, 'duplicate') !== false && (stripos($err, 'PRIMARY') !== false || stripos($err, 'id') !== false);
                if ($looksLikeIdDup) {
                    $payload['id'] = uniqid('u_', true);
                    $ok = users_store_insert($payload);
                }
            }

            if ($ok) {
                $res2 = supabase_client_request('GET', $table, ['select' => '*', 'email' => users_store_supabase_eq($email), 'limit' => 1], null);
                if (is_array($res2) && !empty($res2['ok']) && is_array($res2['data']) && count($res2['data']) > 0) {
                    return users_store_restore_missing_password_for_user(users_store_row_to_user(is_array($res2['data'][0]) ? $res2['data'][0] : null));
                }
            }
            break;
        }

        return null;
    }
    if ($backend === 'error') {
        return null;
    }

    $users = users_store_load_all_json();
    if (!is_array($users)) return null;
    foreach ($users as $user) {
        $rowEmail = trim(strtolower((string)($user['email'] ?? '')));
        if ($rowEmail === $email) return users_store_restore_missing_password_for_user($user);
    }
    return null;
}

function users_store_find_by_instagram($instagram)
{
    $instagram = strtolower(trim((string)$instagram));
    $instagram = ltrim($instagram, '@');
    $instagram = preg_replace('/[^a-z0-9._]+/', '', $instagram);
    $instagram = trim((string)$instagram);
    if ($instagram === '') return null;

    $backend = users_store_backend();
    if ($backend === 'mysql') {
        return users_store_find_by_instagram_mysql($instagram);
    }
    if ($backend === 'supabase') {
        $table = users_store_supabase_table();
        $res = supabase_client_request('GET', $table, ['select' => '*', 'instagram' => users_store_supabase_eq($instagram), 'limit' => 1], null);
        if (is_array($res) && !empty($res['ok']) && is_array($res['data']) && count($res['data']) > 0) {
            return users_store_row_to_user(is_array($res['data'][0]) ? $res['data'][0] : null);
        }
        return null;
    }
    if ($backend === 'error') {
        return null;
    }

    $users = users_store_load_all_json();
    if (!is_array($users)) return null;
    foreach ($users as $user) {
        $rowInstagram = strtolower(trim((string)($user['instagram'] ?? '')));
        $rowInstagram = ltrim($rowInstagram, '@');
        if ($rowInstagram === $instagram) return users_store_normalize_user($user);
    }
    return null;
}

function users_store_find_by_cpf_hash($cpfHash)
{
    $cpfHash = trim((string)$cpfHash);
    if ($cpfHash === '') return null;

    $backend = users_store_backend();
    if ($backend === 'mysql') {
        $pdo = db();
        if (!$pdo) return null;
        $table = users_store_table();
        try {
            $stmt = $pdo->prepare("SELECT * FROM `{$table}` WHERE `cpfHash` = :cpfHash LIMIT 1");
            $stmt->execute(['cpfHash' => $cpfHash]);
            $row = $stmt->fetch();
            return users_store_row_to_user($row ?: null);
        } catch (Throwable $e) {
            users_store_set_error('A coluna cpfHash não existe no banco. Atualize o schema SQL antes de liberar novos cadastros.');
            return null;
        }
    }

    if ($backend === 'supabase') {
        $table = users_store_supabase_table();
        $res = supabase_client_request('GET', $table, ['select' => '*', 'cpf_hash' => users_store_supabase_eq($cpfHash), 'limit' => 1], null);
        if (is_array($res) && !empty($res['ok']) && is_array($res['data']) && count($res['data']) > 0) {
            return users_store_row_to_user(is_array($res['data'][0]) ? $res['data'][0] : null);
        }
        if (is_array($res) && empty($res['ok'])) {
            users_store_set_error('A coluna cpf_hash não existe no Supabase. Atualize o schema SQL antes de liberar novos cadastros.');
        }
        return null;
    }

    if ($backend === 'error') {
        return null;
    }

    $users = users_store_load_all_json();
    if (!is_array($users)) return null;
    foreach ($users as $user) {
        if (hash_equals((string)($user['cpfHash'] ?? ''), $cpfHash)) return users_store_normalize_user($user);
    }
    return null;
}

function users_store_find_by_session_token_hash($tokenHash)
{
    $tokenHash = trim((string)$tokenHash);
    if ($tokenHash === '') return null;

    $backend = users_store_backend();
    if ($backend === 'mysql') {
        $pdo = db();
        $table = users_store_table();
        $stmt = $pdo->prepare("SELECT * FROM `{$table}` WHERE `sessionTokenHash` = :hash LIMIT 1");
        $stmt->execute(['hash' => $tokenHash]);
        $row = $stmt->fetch();
        return users_store_row_to_user($row ?: null);
    }
    if ($backend === 'supabase') {
        $table = users_store_supabase_table();
        $res = supabase_client_request(
            'GET',
            $table,
            ['select' => '*', 'session_token_hash' => users_store_supabase_eq($tokenHash), 'limit' => 1],
            null
        );
        if (is_array($res) && !empty($res['ok']) && is_array($res['data']) && count($res['data']) > 0) {
            return users_store_row_to_user(is_array($res['data'][0]) ? $res['data'][0] : null);
        }
        return null;
    }
    if ($backend === 'error') {
        return null;
    }

    $users = users_store_load_all_json();
    if (!is_array($users)) return null;
    foreach ($users as $user) {
        $storedHash = $user['sessionTokenHash'] ?? '';
        if ($storedHash && hash_equals($storedHash, $tokenHash)) return $user;
    }
    return null;
}

function users_store_find_by_stripe_customer_id($customerId)
{
    $customerId = trim((string)$customerId);
    if ($customerId === '') return null;

    $backend = users_store_backend();
    if ($backend === 'mysql') {
        $pdo = db();
        if (!$pdo) return null;
        $table = users_store_table();
        try {
            $stmt = $pdo->prepare("SELECT * FROM `{$table}` WHERE `stripeCustomerId` = :customerId LIMIT 1");
            $stmt->execute(['customerId' => $customerId]);
            $row = $stmt->fetch();
            return users_store_row_to_user($row ?: null);
        } catch (Throwable $e) {
            users_store_set_error($e->getMessage());
            return null;
        }
    }
    if ($backend === 'supabase') {
        $table = users_store_supabase_table();
        $res = supabase_client_request('GET', $table, ['select' => '*', 'stripe_customer_id' => users_store_supabase_eq($customerId), 'limit' => 1], null);
        if (is_array($res) && !empty($res['ok']) && is_array($res['data']) && count($res['data']) > 0) {
            return users_store_row_to_user(is_array($res['data'][0]) ? $res['data'][0] : null);
        }
        return null;
    }
    if ($backend === 'error') {
        return null;
    }

    $users = users_store_load_all_json();
    if (!is_array($users)) return null;
    foreach ($users as $user) {
        if (trim((string)($user['stripeCustomerId'] ?? '')) === $customerId) return $user;
    }
    return null;
}

function users_store_find_by_stripe_subscription_id($subscriptionId)
{
    $subscriptionId = trim((string)$subscriptionId);
    if ($subscriptionId === '') return null;

    $backend = users_store_backend();
    if ($backend === 'mysql') {
        $pdo = db();
        if (!$pdo) return null;
        $table = users_store_table();
        try {
            $stmt = $pdo->prepare("SELECT * FROM `{$table}` WHERE `stripeSubscriptionId` = :subscriptionId LIMIT 1");
            $stmt->execute(['subscriptionId' => $subscriptionId]);
            $row = $stmt->fetch();
            return users_store_row_to_user($row ?: null);
        } catch (Throwable $e) {
            users_store_set_error($e->getMessage());
            return null;
        }
    }
    if ($backend === 'supabase') {
        $table = users_store_supabase_table();
        $res = supabase_client_request('GET', $table, ['select' => '*', 'stripe_subscription_id' => users_store_supabase_eq($subscriptionId), 'limit' => 1], null);
        if (is_array($res) && !empty($res['ok']) && is_array($res['data']) && count($res['data']) > 0) {
            return users_store_row_to_user(is_array($res['data'][0]) ? $res['data'][0] : null);
        }
        return null;
    }
    if ($backend === 'error') {
        return null;
    }

    $users = users_store_load_all_json();
    if (!is_array($users)) return null;
    foreach ($users as $user) {
        if (trim((string)($user['stripeSubscriptionId'] ?? '')) === $subscriptionId) return $user;
    }
    return null;
}

function users_store_find_by_reset_token_hash($tokenHash)
{
    $tokenHash = trim((string)$tokenHash);
    if ($tokenHash === '') return null;

    $backend = users_store_backend();
    if ($backend === 'mysql') {
        $pdo = db();
        $table = users_store_table();
        $stmt = $pdo->prepare("SELECT * FROM `{$table}` WHERE `resetTokenHash` = :hash LIMIT 1");
        $stmt->execute(['hash' => $tokenHash]);
        $row = $stmt->fetch();
        return users_store_row_to_user($row ?: null);
    }
    if ($backend === 'supabase') {
        $table = users_store_supabase_table();
        $res = supabase_client_request('GET', $table, ['select' => '*', 'reset_token_hash' => users_store_supabase_eq($tokenHash), 'limit' => 1], null);
        if (is_array($res) && !empty($res['ok']) && is_array($res['data']) && count($res['data']) > 0) {
            return users_store_row_to_user(is_array($res['data'][0]) ? $res['data'][0] : null);
        }
        return null;
    }
    if ($backend === 'error') {
        return null;
    }

    $users = users_store_load_all_json();
    if (!is_array($users)) return null;
    foreach ($users as $user) {
        $storedHash = $user['resetTokenHash'] ?? '';
        if ($storedHash && hash_equals($storedHash, $tokenHash)) return $user;
    }
    return null;
}

function users_store_insert($user)
{
    $user = users_store_normalize_user(is_array($user) ? $user : []);
    $backend = users_store_backend();
    if ($backend === 'mysql') {
        $pdo = db();
        $table = users_store_table();

        $payload = [
            'id' => (string)($user['id'] ?? ''),
            'name' => (string)($user['name'] ?? ''),
            'email' => (string)($user['email'] ?? ''),
            'instagram' => $user['instagram'] ?? null,
            'referralCode' => $user['referralCode'] ?? null,
            'referredBy' => $user['referredBy'] ?? null,
            'password' => (string)($user['password'] ?? ''),
            'createdAt' => (string)($user['createdAt'] ?? date('c')),
            'accessCount' => (int)($user['accessCount'] ?? 0),
            'timeSpentSeconds' => (int)($user['timeSpentSeconds'] ?? 0),
            'lastLoginAt' => $user['lastLoginAt'] ?? null,
            'lastSeenAt' => $user['lastSeenAt'] ?? null,
            'lastAccessAt' => $user['lastAccessAt'] ?? null,
            'stripeCustomerId' => $user['stripeCustomerId'] ?? null,
            'stripeSubscriptionId' => $user['stripeSubscriptionId'] ?? null,
            'stripePriceId' => $user['stripePriceId'] ?? null,
            'stripeProductId' => $user['stripeProductId'] ?? null,
            'billingStatus' => $user['billingStatus'] ?? 'free',
            'billingInterval' => $user['billingInterval'] ?? null,
            'billingCurrentPeriodEnd' => $user['billingCurrentPeriodEnd'] ?? null,
        'billingCancelAtPeriodEnd' => !empty($user['billingCancelAtPeriodEnd']) ? 1 : 0,
        'billingLastEventId' => $user['billingLastEventId'] ?? null,
        'billingLastSyncedAt' => $user['billingLastSyncedAt'] ?? null,
        'cpfHash' => $user['cpfHash'] ?? null,
        'cpfLast4' => $user['cpfLast4'] ?? null,
        'trialStartedAt' => $user['trialStartedAt'] ?? null,
        'trialEndsAt' => $user['trialEndsAt'] ?? null,
        'sessionTokenHash' => $user['sessionTokenHash'] ?? null,
            'sessionTokenExpires' => $user['sessionTokenExpires'] ?? null,
            'resetTokenHash' => $user['resetTokenHash'] ?? null,
            'resetTokenExpires' => $user['resetTokenExpires'] ?? null,
            'resetCodeHash' => $user['resetCodeHash'] ?? null,
            'resetCodeExpires' => $user['resetCodeExpires'] ?? null
        ];

        try {
            $cols = array_keys($payload);
            $colSql = implode(', ', array_map(fn($c) => "`{$c}`", $cols));
            $phSql = implode(', ', array_map(fn($c) => ":{$c}", $cols));
            $stmt = $pdo->prepare("INSERT INTO `{$table}` ({$colSql}) VALUES ({$phSql})");
            $stmt->execute($payload);
            return true;
        } catch (Throwable $e) {
            users_store_set_error($e->getMessage());
            return false;
        }
    }

    if ($backend === 'supabase') {
        $table = users_store_supabase_table();

        $payload = [
            'id' => (string)($user['id'] ?? ''),
            'name' => (string)($user['name'] ?? ''),
            'email' => trim(strtolower((string)($user['email'] ?? ''))),
            'instagram' => $user['instagram'] ?? null,
            'referral_code' => $user['referralCode'] ?? null,
            'referred_by' => $user['referredBy'] ?? null,
            'password' => (string)($user['password'] ?? ''),
            'created_at' => (string)($user['createdAt'] ?? date('c')),
            'access_count' => (int)($user['accessCount'] ?? 0),
            'time_spent_seconds' => (int)($user['timeSpentSeconds'] ?? 0),

            'last_login_at' => $user['lastLoginAt'] ?? null,
            'last_seen_at' => $user['lastSeenAt'] ?? null,
            'last_access_at' => $user['lastAccessAt'] ?? null,

            'stripe_customer_id' => $user['stripeCustomerId'] ?? null,
            'stripe_subscription_id' => $user['stripeSubscriptionId'] ?? null,
            'stripe_price_id' => $user['stripePriceId'] ?? null,
            'stripe_product_id' => $user['stripeProductId'] ?? null,
            'billing_status' => $user['billingStatus'] ?? 'free',
            'billing_interval' => $user['billingInterval'] ?? null,
            'billing_current_period_end' => $user['billingCurrentPeriodEnd'] ?? null,
            'billing_cancel_at_period_end' => !empty($user['billingCancelAtPeriodEnd']),
            'billing_last_event_id' => $user['billingLastEventId'] ?? null,
            'billing_last_synced_at' => $user['billingLastSyncedAt'] ?? null,
            'cpf_hash' => $user['cpfHash'] ?? null,
            'cpf_last4' => $user['cpfLast4'] ?? null,
            'trial_started_at' => $user['trialStartedAt'] ?? null,
            'trial_ends_at' => $user['trialEndsAt'] ?? null,

            'session_token_hash' => $user['sessionTokenHash'] ?? null,
            'session_token_expires' => $user['sessionTokenExpires'] ?? null,

            'reset_token_hash' => $user['resetTokenHash'] ?? null,
            'reset_token_expires' => $user['resetTokenExpires'] ?? null,

            'reset_code_hash' => $user['resetCodeHash'] ?? null,
            'reset_code_expires' => $user['resetCodeExpires'] ?? null
        ];

        $res = supabase_client_request('POST', $table, [], $payload, ['Prefer' => 'return=minimal']);
        if (!is_array($res) || empty($res['ok'])) {
            users_store_set_error((string)($res['error'] ?? 'Falha ao inserir usuário no Supabase.'));
            return false;
        }
        return true;
    }

    if ($backend === 'error') {
        return false;
    }

    $users = users_store_load_all_json();
    if (!is_array($users)) return false;
    $users[] = users_store_normalize_user($user);
    return users_store_save_all_json($users);
}

function users_store_update_by_id($id, $fields, $origin = 'users_store_update_by_id', $adminId = null)
{
    $id = (string)$id;
    if ($id === '') return false;
    $fields = users_store_filter_update_fields($id, $fields, $origin, $adminId);
    if (!$fields) return true;

    $backend = users_store_backend();
    if ($backend === 'supabase') {
        $table = users_store_supabase_table();

        $map = [
            'name' => 'name',
            'email' => 'email',
            'instagram' => 'instagram',
            'referralCode' => 'referral_code',
            'referredBy' => 'referred_by',
            'password' => 'password',
            'accessCount' => 'access_count',
            'timeSpentSeconds' => 'time_spent_seconds',
            'lastLoginAt' => 'last_login_at',
            'lastSeenAt' => 'last_seen_at',
            'lastAccessAt' => 'last_access_at',
            'stripeCustomerId' => 'stripe_customer_id',
            'stripeSubscriptionId' => 'stripe_subscription_id',
            'stripePriceId' => 'stripe_price_id',
            'stripeProductId' => 'stripe_product_id',
            'billingStatus' => 'billing_status',
            'billingInterval' => 'billing_interval',
            'billingCurrentPeriodEnd' => 'billing_current_period_end',
            'billingCancelAtPeriodEnd' => 'billing_cancel_at_period_end',
            'billingLastEventId' => 'billing_last_event_id',
            'billingLastSyncedAt' => 'billing_last_synced_at',
            'cpfHash' => 'cpf_hash',
            'cpfLast4' => 'cpf_last4',
            'trialStartedAt' => 'trial_started_at',
            'trialEndsAt' => 'trial_ends_at',
            'sessionTokenHash' => 'session_token_hash',
            'sessionTokenExpires' => 'session_token_expires',
            'resetTokenHash' => 'reset_token_hash',
            'resetTokenExpires' => 'reset_token_expires',
            'resetCodeHash' => 'reset_code_hash',
            'resetCodeExpires' => 'reset_code_expires'
        ];

        $payload = [];
        foreach ((array)$fields as $key => $value) {
            if (!array_key_exists($key, $map)) continue;
            $col = $map[$key];

            if ($key === 'email') {
                $payload[$col] = trim(strtolower((string)$value));
                continue;
            }
            if ($key === 'instagram') {
                $instagram = strtolower(trim((string)$value));
                $instagram = ltrim($instagram, '@');
                $instagram = preg_replace('/[^a-z0-9._]+/', '', $instagram);
                $payload[$col] = trim((string)$instagram) ?: null;
                continue;
            }
            if ($key === 'billingCancelAtPeriodEnd') {
                $payload[$col] = (bool)$value;
                continue;
            }
            if ($key === 'accessCount' || $key === 'timeSpentSeconds') {
                $payload[$col] = (int)$value;
                continue;
            }
            if ($key === 'sessionTokenExpires' || $key === 'resetTokenExpires' || $key === 'resetCodeExpires') {
                $payload[$col] = $value === null ? null : (int)$value;
                continue;
            }

            $payload[$col] = $value;
        }

        if (!$payload) return true;

        $query = ['id' => users_store_supabase_eq($id)];
        $headers = ['Prefer' => 'return=minimal'];

        while ($payload) {
            $res = supabase_client_request('PATCH', $table, $query, $payload, $headers);
            if (is_array($res) && !empty($res['ok'])) {
                return true;
            }

            $error = (string)($res['error'] ?? 'Falha ao atualizar usuário no Supabase.');
            if (preg_match("/Could not find the '([^']+)' column/i", $error, $matches)) {
                $missingColumn = (string)($matches[1] ?? '');
                if ($missingColumn !== '' && array_key_exists($missingColumn, $payload)) {
                    unset($payload[$missingColumn]);
                    continue;
                }
            }

            users_store_set_error($error);
            return false;
        }

        return true;
    }
    if ($backend === 'mysql') {
        $pdo = db();
        $table = users_store_table();

        $allowed = [
            'name',
            'email',
            'instagram',
            'referralCode',
            'referredBy',
            'password',
            'accessCount',
            'timeSpentSeconds',
            'lastLoginAt',
            'lastSeenAt',
            'lastAccessAt',
            'stripeCustomerId',
            'stripeSubscriptionId',
            'stripePriceId',
            'stripeProductId',
            'billingStatus',
            'billingInterval',
            'billingCurrentPeriodEnd',
            'billingCancelAtPeriodEnd',
            'billingLastEventId',
            'billingLastSyncedAt',
            'cpfHash',
            'cpfLast4',
            'trialStartedAt',
            'trialEndsAt',
            'sessionTokenHash',
            'sessionTokenExpires',
            'resetTokenHash',
            'resetTokenExpires',
            'resetCodeHash',
            'resetCodeExpires'
        ];

        $set = [];
        $params = ['id' => $id];
        foreach ((array)$fields as $key => $value) {
            if (!in_array($key, $allowed, true)) continue;
            $set[] = "`{$key}` = :{$key}";
            if ($key === 'email') {
                $params[$key] = trim(strtolower((string)$value));
            } elseif ($key === 'instagram') {
                $instagram = strtolower(trim((string)$value));
                $instagram = ltrim($instagram, '@');
                $instagram = preg_replace('/[^a-z0-9._]+/', '', $instagram);
                $params[$key] = trim((string)$instagram) ?: null;
            } elseif ($key === 'billingCancelAtPeriodEnd') {
                $params[$key] = $value ? 1 : 0;
            } else {
                $params[$key] = $value;
            }
        }

        if (!$set) return true;

        try {
            $sql = "UPDATE `{$table}` SET " . implode(', ', $set) . " WHERE `id` = :id LIMIT 1";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            return true;
        } catch (Throwable $e) {
            users_store_set_error($e->getMessage());
            return false;
        }
    }

    if ($backend === 'error') {
        return false;
    }

    $users = users_store_load_all_json();
    if (!is_array($users)) return false;
    $found = false;
    foreach ($users as $index => $user) {
        if (($user['id'] ?? '') !== $id) continue;
        foreach ((array)$fields as $k => $v) {
            $users[$index][$k] = $v;
        }
        $users[$index] = users_store_normalize_user($users[$index]);
        $found = true;
        break;
    }

    if (!$found) return false;
    return users_store_save_all_json($users);
}

function users_store_find_by_id($id)
{
    $id = trim((string)$id);
    if ($id === '') return null;

    $backend = users_store_backend();
    if ($backend === 'supabase') {
        $table = users_store_supabase_table();
        $res = supabase_client_request('GET', $table, ['select' => '*', 'id' => users_store_supabase_eq($id), 'limit' => 1], null);
        if (is_array($res) && !empty($res['ok']) && is_array($res['data']) && count($res['data']) > 0) {
            return users_store_row_to_user(is_array($res['data'][0]) ? $res['data'][0] : null);
        }
        return null;
    }
    if ($backend === 'mysql') {
        $pdo = db();
        if (!$pdo) return null;
        $table = users_store_table();
        $stmt = $pdo->prepare("SELECT * FROM `{$table}` WHERE `id` = :id LIMIT 1");
        $stmt->execute(['id' => $id]);
        $row = $stmt->fetch();
        return users_store_row_to_user($row ?: null);
    }

    if ($backend === 'error') {
        return null;
    }

    $users = users_store_load_all_json();
    if (!is_array($users)) return null;
    foreach ($users as $user) {
        if (($user['id'] ?? '') === $id) return $user;
    }
    return null;
}

function users_store_delete_by_id($id)
{
    $id = trim((string)$id);
    if ($id === '') return false;

    $backend = users_store_backend();
    if ($backend === 'supabase') {
        $table = users_store_supabase_table();
        $res = supabase_client_request('DELETE', $table, ['id' => users_store_supabase_eq($id)], null, ['Prefer' => 'return=representation']);
        if (!is_array($res) || empty($res['ok'])) {
            users_store_set_error((string)($res['error'] ?? 'Falha ao excluir usuário no Supabase.'));
            return false;
        }
        // Em alguns cenários o Supabase retorna 204/sem payload mesmo quando remove.
        // Confirma por leitura: se não existir mais, considera sucesso.
        $remaining = users_store_find_by_id($id);
        if (is_array($remaining) && !empty($remaining)) {
            users_store_set_error('Usuário não encontrado ou não foi possível excluir.');
            return false;
        }
        return true;
    }
    if ($backend === 'mysql') {
        $pdo = db();
        if (!$pdo) {
            users_store_set_error('Falha ao conectar no banco.');
            return false;
        }

        $table = users_store_table();
        try {
            $stmt = $pdo->prepare("DELETE FROM `{$table}` WHERE `id` = :id LIMIT 1");
            $stmt->execute(['id' => $id]);
            if ($stmt->rowCount() < 1) {
                users_store_set_error('Usuário não encontrado.');
                return false;
            }
            return true;
        } catch (Throwable $e) {
            users_store_set_error($e->getMessage());
            return false;
        }
    }

    if ($backend === 'error') {
        return false;
    }

    $users = users_store_load_all_json();
    if (!is_array($users)) return false;

    $before = count($users);
    $users = array_values(array_filter($users, function ($user) use ($id) {
        return (string)($user['id'] ?? '') !== $id;
    }));

    if (count($users) === $before) {
        users_store_set_error('Usuário não encontrado.');
        return false;
    }

    return users_store_save_all_json($users);
}
