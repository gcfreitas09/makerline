<?php
// api/admin_delete_user.php
// Exclui uma conta (admin-only). Remove também o state salvo em storage/states.

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
    $clean = array_values(array_unique(array_map(function ($e) {
        return trim(strtolower((string)$e));
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
    respond(405, ['error' => 'Método não permitido']);
}

if (users_store_backend() === 'error') {
    respond(500, ['error' => users_store_last_error() ?: 'Banco configurado, mas não está pronto ainda.']);
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

$targetId = trim((string)($body['userId'] ?? ''));
if ($targetId === '') {
    respond(400, ['error' => 'UserId inválido']);
}

if ((string)($foundUser['id'] ?? '') === $targetId) {
    respond(400, ['error' => 'Não dá pra excluir você mesmo aqui.']);
}

$target = users_store_find_by_id($targetId);
if (!$target) {
    respond(404, ['error' => 'Usuário não encontrado.']);
}

$targetEmail = strtolower(trim((string)($target['email'] ?? '')));
if ($targetEmail && in_array($targetEmail, $adminEmails, true)) {
    respond(400, ['error' => 'Essa conta é admin. Melhor não mexer nela por aqui.']);
}

$confirm = strtolower(trim((string)($body['confirm'] ?? '')));
if ($confirm === '') {
    respond(400, ['error' => 'Confirmação obrigatória. Digita EXCLUIR pra confirmar.']);
}

if ($confirm !== 'excluir' && $confirm !== $targetEmail) {
    respond(400, ['error' => 'Confirmação errada. Digita EXCLUIR (ou o email da pessoa).']);
}

$ok = users_store_delete_by_id($targetId);
if (!$ok) {
    respond(500, ['error' => users_store_last_error() ?: 'Não consegui excluir agora.']);
}

// Se o state estiver no Supabase, tenta remover também (não bloqueia se falhar).
if (states_store_backend() === 'supabase') {
    states_store_delete_by_user_id($targetId);
}

if (is_dir($statesDir)) {
    $safe = safeUserIdForFile($targetId);
    $stateFile = $statesDir . '/' . $safe . '.json';
    if (file_exists($stateFile)) {
        @unlink($stateFile);
    }
    purgeStateBackups($statesDir, $safe);
}

// Marca email como removido para não ser reimportado de backups/estados.
markDeletedEmail($deletedEmailsFile, $targetEmail);

respond(200, [
    'ok' => true,
    'deleted' => true,
    'user' => [
        'id' => (string)($target['id'] ?? ''),
        'email' => (string)($target['email'] ?? ''),
        'name' => (string)($target['name'] ?? '')
    ]
]);
