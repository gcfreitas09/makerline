<?php
ini_set('display_errors', '0');
error_reporting(0);

require_once __DIR__ . '/users_store.php';
require_once __DIR__ . '/states_store.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

$statesDir = __DIR__ . '/../storage/states';
$deletedEmailsFile = __DIR__ . '/../storage/deleted_emails.json';

function respond($status, $data = [])
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function safeUserIdForFile($userId)
{
    $raw = (string)($userId ?? '');
    $safe = preg_replace('/[^a-zA-Z0-9_-]/', '_', $raw);
    if ($safe === '' || $safe === null) {
        $safe = 'user_' . hash('sha256', $raw);
    }
    return $safe;
}

function markDeletedEmail($file, $email)
{
    $email = trim(strtolower((string)$email));
    if ($email === '') return;

    $list = [];
    if (file_exists($file)) {
        $raw = file_get_contents($file);
        $data = json_decode((string)$raw, true);
        if (is_array($data)) $list = $data;
    }

    $list[] = $email;
    $clean = array_values(array_unique(array_map(function ($item) {
        return trim(strtolower((string)$item));
    }, $list)));

    @file_put_contents($file, json_encode($clean, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function purgeStateBackups($statesDir, $safeUserId)
{
    $backupDir = rtrim((string)$statesDir, '/\\') . DIRECTORY_SEPARATOR . 'backups';
    if (!is_dir($backupDir)) return;

    $pattern = $backupDir . DIRECTORY_SEPARATOR . $safeUserId . '_*.json';
    $files = glob($pattern) ?: [];
    foreach ($files as $path) {
        @unlink($path);
    }
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    respond(405, ['error' => 'Método não permitido.']);
}

if (users_store_backend() === 'error') {
    respond(500, ['error' => users_store_last_error() ?: 'Banco configurado, mas não está pronto ainda.']);
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    respond(400, ['error' => 'JSON inválido.']);
}

$token = trim((string)($body['token'] ?? ''));
if (strlen($token) < 10) {
    respond(401, ['error' => 'Sessão inválida. Faz login de novo.']);
}

$tokenHash = hash('sha256', $token);
$now = time();
$user = users_store_find_by_session_token_hash($tokenHash);
if (!$user || empty($user['id'])) {
    respond(401, ['error' => 'Sessão inválida. Faz login de novo.']);
}

$expires = (int)($user['sessionTokenExpires'] ?? 0);
if ($expires && $expires < $now) {
    respond(401, ['error' => 'Sessão expirada. Faz login de novo.']);
}

$userId = trim((string)($user['id'] ?? ''));
if ($userId === '') {
    respond(400, ['error' => 'Conta inválida.']);
}

$userEmail = strtolower(trim((string)($user['email'] ?? '')));

$ok = users_store_delete_by_id($userId);
if (!$ok) {
    respond(500, ['error' => users_store_last_error() ?: 'Não consegui excluir sua conta agora.']);
}

users_store_purge_legacy_user($userId, $userEmail);

if (states_store_backend() === 'supabase') {
    states_store_delete_by_user_id($userId);
}

if (is_dir($statesDir)) {
    $safe = safeUserIdForFile($userId);
    $stateFile = $statesDir . '/' . $safe . '.json';
    if (file_exists($stateFile)) {
        @unlink($stateFile);
    }
    purgeStateBackups($statesDir, $safe);
}

markDeletedEmail($deletedEmailsFile, $userEmail);

respond(200, [
    'ok' => true,
    'deleted' => true,
    'user' => [
        'id' => $userId,
        'email' => (string)($user['email'] ?? ''),
        'name' => (string)($user['name'] ?? '')
    ]
]);
