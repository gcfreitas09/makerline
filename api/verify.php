<?php
// api/verify.php
ini_set('display_errors', '0');
error_reporting(0);

require_once __DIR__ . '/users_store.php';
require_once __DIR__ . '/url.php';

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
$email = trim(strtolower((string)($body['email'] ?? '')));
$code = preg_replace('/\\D/', '', (string)($body['code'] ?? ''));

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(400, ['error' => 'Email inválido']);
}

if (!preg_match('/^\\d{6}$/', $code)) {
    respond(400, ['error' => 'Código inválido (6 dígitos)']);
}

$user = users_store_find_by_email($email);
if (!$user || empty($user['id'])) {
    respond(404, ['error' => 'Conta não encontrada']);
}

$storedHash = (string)($user['resetCodeHash'] ?? '');
$expires = (int)($user['resetCodeExpires'] ?? 0);
$now = time();

if (!$storedHash) {
    respond(400, ['error' => 'Pede um código novo e tenta de novo.']);
}
if ($expires < $now) {
    respond(400, ['error' => 'Esse código expirou. Pede outro.']);
}

$incomingHash = hash('sha256', $code);
if (!hash_equals($storedHash, $incomingHash)) {
    respond(400, ['error' => 'Código errado.']);
}

$token = bin2hex(random_bytes(16));
$tokenHash = hash('sha256', $token);

$ok = users_store_update_by_id((string)$user['id'], [
    'resetTokenHash' => $tokenHash,
    'resetTokenExpires' => $now + 3600,
    'resetCodeHash' => null,
    'resetCodeExpires' => null
]);

if (!$ok) {
    respond(500, ['error' => users_store_last_error() ?: 'Não consegui confirmar o código agora.']);
}

$resetLink = ugc_base_url() . '/reset.html?token=' . $token;

respond(200, [
    'ok' => true,
    'resetLink' => $resetLink
]);

