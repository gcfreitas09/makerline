<?php
// api/admin_migrate_states.php
// Importa states do storage/states/*.json pro Supabase (admin-only).
// Serve pra nao perder campanhas/roteiros/progresso quando fizer deploy/FTP.

ini_set('display_errors', '0');
error_reporting(0);

require_once __DIR__ . '/users_store.php';
require_once __DIR__ . '/states_store.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

$adminsFile = __DIR__ . '/../storage/admins.json';
$adminsExampleFile = __DIR__ . '/../storage/admins.example.json';
$statesDir = __DIR__ . '/../storage/states';

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

function listStateFiles($dir)
{
    if (!is_dir($dir)) return [];
    $pattern = rtrim($dir, '/\\') . DIRECTORY_SEPARATOR . '*.json';
    $files = glob($pattern) ?: [];
    $out = [];
    foreach ($files as $path) {
        if (!is_file($path)) continue;
        $name = basename($path);
        if ($name === '.gitkeep') continue;
        $out[] = $path;
    }
    return $out;
}

function safeStatePayload($raw)
{
    if (!is_string($raw) || trim($raw) === '') return null;
    $payload = json_decode($raw, true);
    if (!is_array($payload)) return null;
    $userId = trim((string)($payload['userId'] ?? ''));
    $updatedAt = (string)($payload['updatedAt'] ?? '');
    $state = $payload['state'] ?? null;
    if ($userId === '' || !is_array($state)) return null;
    if ($updatedAt === '') $updatedAt = date('c');
    return ['userId' => $userId, 'updatedAt' => $updatedAt, 'state' => $state];
}

function userPayloadFromState($userId, $state, $fallbackCreatedAt)
{
    if (!is_array($state)) return null;
    $profile = is_array($state['profile'] ?? null) ? $state['profile'] : [];
    $settings = is_array($state['settings'] ?? null) ? $state['settings'] : [];

    $email = trim(strtolower((string)($profile['email'] ?? '')));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) return null;

    $name = trim((string)($profile['name'] ?? ''));
    if ($name === '') $name = 'Creator';

    $createdAt = (string)$fallbackCreatedAt;
    if ($createdAt === '') $createdAt = date('c');

    return [
        'id' => (string)$userId,
        'name' => $name,
        'email' => $email,
        // Sem senha: no login vai cair no "Esqueci minha senha?"
        'password' => '',
        'createdAt' => $createdAt,
        'weeklySummary' => !empty($settings['weekly']),
        'accessCount' => 0,
        'timeSpentSeconds' => 0,
        'lastLoginAt' => null,
        'lastSeenAt' => null,
        'lastAccessAt' => null,
        'sessionTokenHash' => null,
        'sessionTokenExpires' => null,
        'resetTokenHash' => null,
        'resetTokenExpires' => null,
        'resetCodeHash' => null,
        'resetCodeExpires' => null
    ];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    respond(405, ['error' => 'Método não permitido']);
}

if (users_store_backend() === 'error') {
    respond(500, ['error' => users_store_last_error() ?: 'Banco configurado, mas não está pronto ainda.']);
}

if (states_store_backend() !== 'supabase') {
    respond(400, [
        'error' => states_store_last_error() ?: 'A tabela de states no Supabase ainda não está pronta.',
        'hint' => 'Roda o SQL em sql/ugc_user_states.supabase.sql e tenta de novo.'
    ]);
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
    respond(403, ['error' => 'Sem permissão pra fazer isso.']);
}

$files = listStateFiles($statesDir);
$totalFiles = count($files);

$imported = 0;
$skipped = 0;
$errors = 0;
$recoveredUsers = 0;

foreach ($files as $path) {
    $raw = @file_get_contents($path);
    $payload = safeStatePayload($raw ?: '');
    if (!$payload) {
        $skipped++;
        continue;
    }

    $userId = $payload['userId'];
    $state = $payload['state'];
    $updatedAt = $payload['updatedAt'];

    // Recupera/migra o usuario pro banco, se ele so existia no state.
    $existingById = users_store_find_by_id($userId);
    if (!$existingById) {
        $candidate = userPayloadFromState($userId, $state, $updatedAt);
        if ($candidate) {
            $existingByEmail = users_store_find_by_email($candidate['email']);
            if (!$existingByEmail) {
                $okUser = users_store_insert($candidate);
                if ($okUser) $recoveredUsers++;
            }
        }
    }

    $ok = states_store_upsert_by_user_id($userId, $state, $updatedAt);
    if ($ok) {
        $imported++;
    } else {
        $errors++;
    }
}

respond(200, [
    'ok' => true,
    'backend' => 'supabase',
    'totalFiles' => $totalFiles,
    'imported' => $imported,
    'skipped' => $skipped,
    'errors' => $errors,
    'recoveredUsers' => $recoveredUsers
]);

