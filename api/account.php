<?php
// api/account.php
ini_set('display_errors', '0');
error_reporting(0);

require_once __DIR__ . '/users_store.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

function respond($status, $data = [])
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    respond(405, ['error' => 'Método não permitido']);
}

if (users_store_backend() === 'error') {
    respond(500, ['error' => users_store_last_error() ?: 'Banco configurado, mas não está pronto ainda.']);
}

$body = json_decode(file_get_contents('php://input'), true) ?? [];
$token = trim((string)($body['token'] ?? ''));
$newEmail = trim(strtolower((string)($body['newEmail'] ?? '')));
$newPassword = (string)($body['newPassword'] ?? '');

if (strlen($token) < 10) {
    respond(401, ['error' => 'Sessão inválida. Faz login de novo.']);
}

if ($newEmail && !filter_var($newEmail, FILTER_VALIDATE_EMAIL)) {
    respond(400, ['error' => 'Novo email inválido']);
}

$hasUpdates = (bool)$newEmail || (bool)$newPassword;
if (!$hasUpdates) {
    respond(400, ['error' => 'Nada pra salvar. Preencha um novo email ou uma nova senha.']);
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

$updates = [];

if ($newEmail) {
    $currentEmail = trim(strtolower((string)($user['email'] ?? '')));
    if ($newEmail !== $currentEmail) {
        $check = users_store_find_by_email($newEmail);
        if ($check && !empty($check['id']) && (string)$check['id'] !== (string)$user['id']) {
            respond(409, ['error' => 'Esse email já está em uso']);
        }
        $updates['email'] = $newEmail;
    }
}

if ($newPassword) {
    if (strlen($newPassword) < 6) {
        respond(400, ['error' => 'Senha muito curta (mín. 6)']);
    }
    $updates['password'] = password_hash($newPassword, PASSWORD_DEFAULT);
}

$newToken = bin2hex(random_bytes(24));
$updates['sessionTokenHash'] = hash('sha256', $newToken);
$updates['sessionTokenExpires'] = time() + 60 * 60 * 24 * 7;

$ok = users_store_update_by_id((string)$user['id'], $updates);
if (!$ok) {
    respond(500, ['error' => users_store_last_error() ?: 'Não consegui salvar agora.']);
}

$fresh = users_store_find_by_email($updates['email'] ?? ($user['email'] ?? ''));

respond(200, [
    'ok' => true,
    'token' => $newToken,
    'user' => [
        'id' => (string)($fresh['id'] ?? ($user['id'] ?? '')),
        'name' => (string)($fresh['name'] ?? ($user['name'] ?? '')),
        'email' => (string)($fresh['email'] ?? ($updates['email'] ?? ($user['email'] ?? ''))),
        'weeklySummary' => (bool)($fresh['weeklySummary'] ?? ($user['weeklySummary'] ?? false))
    ]
]);

