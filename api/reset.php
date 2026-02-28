<?php
// api/reset.php
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
$password = (string)($body['password'] ?? '');

if (strlen($token) < 10) {
    respond(400, ['error' => 'Token inválido']);
}

if (strlen($password) < 6) {
    respond(400, ['error' => 'Senha muito curta (mín. 6)']);
}

$tokenHash = hash('sha256', $token);
$user = users_store_find_by_reset_token_hash($tokenHash);
if (!$user || empty($user['id'])) {
    respond(400, ['error' => 'Token inválido']);
}

$now = time();
$expires = (int)($user['resetTokenExpires'] ?? 0);
if ($expires < $now) {
    respond(400, ['error' => 'Link expirado']);
}

$ok = users_store_update_by_id((string)$user['id'], [
    'password' => password_hash($password, PASSWORD_DEFAULT),
    'resetTokenHash' => null,
    'resetTokenExpires' => null,
    'sessionTokenHash' => null,
    'sessionTokenExpires' => null
]);

if (!$ok) {
    respond(500, ['error' => users_store_last_error() ?: 'Não consegui salvar a nova senha agora.']);
}

respond(200, ['ok' => true]);

