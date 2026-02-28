<?php
// api/track_time.php
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

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    respond(400, ['error' => 'JSON inválido']);
}

$token = trim((string)($body['token'] ?? ''));
$seconds = (int)($body['seconds'] ?? 0);

if (strlen($token) < 10) {
    respond(401, ['error' => 'Sessão inválida.']);
}

if ($seconds <= 0) {
    respond(200, ['ok' => true]);
}

// Limite simples pra evitar spam no MVP.
if ($seconds > 60 * 60 * 24) {
    $seconds = 60 * 60 * 24;
}

$tokenHash = hash('sha256', $token);
$now = time();
$user = users_store_find_by_session_token_hash($tokenHash);
if (!$user || empty($user['id'])) {
    respond(401, ['error' => 'Sessão inválida.']);
}

$expires = (int)($user['sessionTokenExpires'] ?? 0);
if ($expires && $expires < $now) {
    respond(401, ['error' => 'Sessão expirada.']);
}

$newTotal = (int)($user['timeSpentSeconds'] ?? 0) + $seconds;
$ok = users_store_update_by_id((string)$user['id'], [
    'timeSpentSeconds' => $newTotal,
    'lastSeenAt' => date('c')
]);

if (!$ok) {
    respond(500, ['error' => users_store_last_error() ?: 'Não consegui salvar agora.']);
}

respond(200, ['ok' => true]);

