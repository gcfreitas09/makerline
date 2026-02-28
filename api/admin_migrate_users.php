<?php
// api/admin_migrate_users.php
// Importa usuários do storage/users.json para o banco (MySQL ou Supabase), quando estiver habilitado.

ini_set('display_errors', '0');
error_reporting(0);

require_once __DIR__ . '/users_store.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

$adminsFile = __DIR__ . '/../storage/admins.json';
$adminsExampleFile = __DIR__ . '/../storage/admins.example.json';
$deletedEmailsFile = __DIR__ . '/../storage/deleted_emails.json';

function respond($status, $data = [])
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function loadJsonFile($file)
{
    if (!file_exists($file)) return null;
    $json = file_get_contents($file);
    $data = json_decode($json, true);
    return is_array($data) ? $data : null;
}

function loadAdmins($adminsFile, $exampleFile)
{
    $data = loadJsonFile($adminsFile);
    if (!$data) $data = loadJsonFile($exampleFile);
    $emails = is_array($data['emails'] ?? null) ? $data['emails'] : [];
    $clean = [];
    foreach ($emails as $email) {
        $e = trim(strtolower((string)$email));
        if (!$e) continue;
        $clean[] = $e;
    }
    return array_values(array_unique($clean));
}

function safeUsersFromJson($file)
{
    if (!file_exists($file)) return [];
    $raw = file_get_contents($file);
    $data = json_decode((string)$raw, true);
    return is_array($data) ? $data : [];
}

function loadDeletedEmails($file)
{
    if (!file_exists($file)) return [];
    $raw = file_get_contents($file);
    $data = json_decode((string)$raw, true);
    if (!is_array($data)) return [];
    $out = [];
    foreach ($data as $email) {
        $e = trim(strtolower((string)$email));
        if ($e) $out[$e] = true;
    }
    return $out;
}

function mergeUniqueUsers($base, $extra)
{
    $out = is_array($base) ? $base : [];
    if (!is_array($extra)) return $out;

    $seenEmails = [];
    foreach ($out as $u) {
        $e = trim(strtolower((string)($u['email'] ?? '')));
        if ($e) $seenEmails[$e] = true;
    }

    foreach ($extra as $row) {
        if (!is_array($row)) continue;
        $email = trim(strtolower((string)($row['email'] ?? '')));
        if ($email === '' || isset($seenEmails[$email])) continue;
        $seenEmails[$email] = true;
        $out[] = $row;
    }

    return $out;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    respond(405, ['error' => 'Método não permitido']);
}

if (users_store_backend() === 'error') {
    respond(500, ['error' => users_store_last_error() ?: 'Banco configurado, mas não está pronto ainda.']);
}

$backend = users_store_backend();
if ($backend !== 'mysql' && $backend !== 'supabase') {
    respond(400, ['error' => 'O banco ainda não está ativo. Cria o storage/db.json (MySQL) ou storage/supabase.json (Supabase) e importa o SQL primeiro.']);
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    respond(400, ['error' => 'JSON inválido']);
}

$token = trim((string)($body['token'] ?? ''));
if (strlen($token) < 10) {
    respond(401, ['error' => 'Sessão inválida. Faz login de novo.']);
}

$tokenHash = hash('sha256', $token);
$now = time();
$foundUser = users_store_find_by_session_token_hash($tokenHash);
if (!$foundUser) {
    respond(401, ['error' => 'Sessão inválida. Faz login de novo.']);
}

$expires = (int)($foundUser['sessionTokenExpires'] ?? 0);
if ($expires && $expires < $now) {
    respond(401, ['error' => 'Sessão expirada. Faz login de novo.']);
}

$adminEmails = loadAdmins($adminsFile, $adminsExampleFile);
$currentEmail = strtolower(trim((string)($foundUser['email'] ?? '')));
if (!$currentEmail || !in_array($currentEmail, $adminEmails, true)) {
    respond(403, ['error' => 'Sem permissão pra ver isso.']);
}

$jsonUsersFile = __DIR__ . '/../storage/users.json';
$jsonUsers = safeUsersFromJson($jsonUsersFile);

$deletedEmails = loadDeletedEmails($deletedEmailsFile);

$backupDir = __DIR__ . '/../storage/backups';
if (is_dir($backupDir)) {
    $files = glob($backupDir . '/users_*.json') ?: [];
    usort($files, function ($a, $b) {
        return (int)@filemtime($b) <=> (int)@filemtime($a);
    });
    foreach ($files as $file) {
        $jsonUsers = mergeUniqueUsers($jsonUsers, safeUsersFromJson($file));
    }
}

// Se users.json/backup perderam cadastros mas ainda temos states, tenta reconstruir a partir deles.
if (function_exists('users_store_merge_missing_from_state_files')) {
    $jsonUsers = users_store_merge_missing_from_state_files($jsonUsers);
}

$total = count($jsonUsers);
$imported = 0;
$skipped = 0;
$errors = 0;

foreach ($jsonUsers as $row) {
    if (!is_array($row)) {
        $skipped++;
        continue;
    }

    $email = trim(strtolower((string)($row['email'] ?? '')));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $skipped++;
        continue;
    }

    if (isset($deletedEmails[$email])) {
        $skipped++;
        continue;
    }

    $id = trim((string)($row['id'] ?? ''));
    if ($id === '') $id = uniqid('u_', true);

    $payload = [
        'id' => $id,
        'name' => (string)($row['name'] ?? 'Creator'),
        'email' => $email,
        'password' => (string)($row['password'] ?? ''),
        'createdAt' => (string)($row['createdAt'] ?? date('c')),
        'weeklySummary' => !empty($row['weeklySummary']),
        'accessCount' => (int)($row['accessCount'] ?? 0),
        'timeSpentSeconds' => (int)($row['timeSpentSeconds'] ?? 0),
        'lastLoginAt' => $row['lastLoginAt'] ?? null,
        'lastSeenAt' => $row['lastSeenAt'] ?? null,
        'lastAccessAt' => $row['lastAccessAt'] ?? null,
        'sessionTokenHash' => $row['sessionTokenHash'] ?? null,
        'sessionTokenExpires' => $row['sessionTokenExpires'] ?? null,
        'resetTokenHash' => $row['resetTokenHash'] ?? null,
        'resetTokenExpires' => $row['resetTokenExpires'] ?? null,
        'resetCodeHash' => $row['resetCodeHash'] ?? null,
        'resetCodeExpires' => $row['resetCodeExpires'] ?? null
    ];

    $ok = users_store_insert($payload);
    if (!$ok) {
        $err = (string)(users_store_last_error() ?? '');
        $looksLikeIdDup = stripos($err, 'duplicate') !== false && (stripos($err, 'PRIMARY') !== false || stripos($err, 'id') !== false);
        if ($looksLikeIdDup) {
            $payload['id'] = uniqid('u_', true);
            $ok = users_store_insert($payload);
        }

        if (!$ok) {
            $err2 = (string)(users_store_last_error() ?? '');
            $looksLikeEmailDup = stripos($err2, 'duplicate') !== false && (stripos($err2, 'email') !== false || stripos($err2, 'unique') !== false);
            if ($looksLikeEmailDup) {
                $skipped++;
                continue;
            }
        }
    }

    if ($ok) {
        $imported++;
    } else {
        $errors++;
    }
}

respond(200, [
    'ok' => true,
    'backend' => $backend,
    'total' => $total,
    'imported' => $imported,
    'skipped' => $skipped,
    'errors' => $errors
]);
