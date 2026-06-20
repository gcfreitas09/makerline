<?php
// api/admin_reset_password.php
ini_set('display_errors', '0');
error_reporting(0);

require_once __DIR__ . '/users_store.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

$adminsFile = __DIR__ . '/../storage/admins.json';
$adminsExampleFile = __DIR__ . '/../storage/admins.example.json';

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
        if ($e === '') continue;
        $clean[] = $e;
    }
    return array_values(array_unique($clean));
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    respond(405, ['error' => 'Metodo nao permitido']);
}

if (users_store_backend() === 'error') {
    respond(500, ['error' => users_store_last_error() ?: 'Banco configurado, mas nao esta pronto ainda.']);
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    respond(400, ['error' => 'JSON invalido']);
}

$token = trim((string)($body['token'] ?? ''));
$targetId = trim((string)($body['userId'] ?? ''));
$newPassword = trim((string)($body['newPassword'] ?? ($body['temporaryPassword'] ?? '')));

if (strlen($token) < 10) {
    respond(401, ['error' => 'Sessao invalida. Faz login de novo.']);
}

$tokenHash = hash('sha256', $token);
$now = time();
$admin = users_store_find_by_session_token_hash($tokenHash);
if (!$admin) {
    respond(401, ['error' => 'Sessao invalida. Faz login de novo.']);
}

$expires = (int)($admin['sessionTokenExpires'] ?? 0);
if ($expires && $expires < $now) {
    respond(401, ['error' => 'Sessao expirada. Faz login de novo.']);
}

$adminEmails = loadAdmins($adminsFile, $adminsExampleFile);
$adminEmail = strtolower(trim((string)($admin['email'] ?? '')));
if ($adminEmail === '' || !in_array($adminEmail, $adminEmails, true)) {
    respond(403, ['error' => 'Sem permissao para fazer isso.']);
}

if ($targetId === '') {
    respond(400, ['error' => 'Usuario invalido.']);
}

if (strlen($newPassword) < 6) {
    respond(400, ['error' => 'A nova senha precisa ter pelo menos 6 caracteres.']);
}

$target = users_store_find_by_id($targetId);
if (!$target) {
    respond(404, ['error' => 'Usuario nao encontrado.']);
}

$targetEmail = strtolower(trim((string)($target['email'] ?? '')));
if ($targetEmail !== '' && in_array($targetEmail, $adminEmails, true) && (string)($admin['id'] ?? '') !== (string)($target['id'] ?? '')) {
    respond(400, ['error' => 'Nao redefina senha de outra conta admin por aqui.']);
}

$ok = users_store_update_by_id((string)$target['id'], [
    'password' => password_hash($newPassword, PASSWORD_DEFAULT),
    'sessionTokenHash' => null,
    'sessionTokenExpires' => null,
    'resetTokenHash' => null,
    'resetTokenExpires' => null,
    'resetCodeHash' => null,
    'resetCodeExpires' => null,
], 'admin_reset_password', (string)($admin['id'] ?? ''));

if (!$ok) {
    respond(500, ['error' => users_store_last_error() ?: 'Nao consegui redefinir a senha agora.']);
}

users_store_security_audit('admin_password_reset', (string)$target['id'], 'admin_reset_password', (string)($admin['id'] ?? ''), [
    'target_email' => $targetEmail,
]);

respond(200, [
    'ok' => true,
    'user' => [
        'id' => (string)($target['id'] ?? ''),
        'email' => (string)($target['email'] ?? ''),
        'name' => (string)($target['name'] ?? ''),
    ],
]);
