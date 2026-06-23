<?php
// api/settings.php
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
$weekly = $body['weekly'] ?? null;

if (strlen($token) < 10) {
    respond(401, ['error' => 'Sessão inválida. Faz login de novo.']);
}

$weeklyBool = filter_var($weekly, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
if ($weeklyBool === null) {
    respond(400, ['error' => 'Parâmetro semanal inválido']);
}

$tokenHash = hash('sha256', $token);
$user = users_store_find_by_session_token_hash($tokenHash);
if (!$user) {
    respond(401, ['error' => 'Sessão inválida. Faz login de novo.']);
}

$now = time();
$expires = (int)($user['sessionTokenExpires'] ?? 0);
if ($expires && $expires < $now) {
    respond(401, ['error' => 'Sessão expirada. Faz login de novo.']);
}

$ok = users_store_update_by_id($user['id'] ?? '', [
    'weeklySummary' => $weeklyBool
]);

if (!$ok) {
    respond(500, ['error' => users_store_last_error() ?: 'Não consegui salvar agora.']);
}

respond(200, ['ok' => true, 'weeklySummary' => $weeklyBool]);

