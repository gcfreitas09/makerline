<?php
// api/feedback_submit.php
// Qualquer usuario logado pode enviar um feedback/bug pro fundador.

ini_set('display_errors', '0');
error_reporting(0);

require_once __DIR__ . '/users_store.php';
require_once __DIR__ . '/supabase_client.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

function feedback_submit_respond($status, $data = [])
{
    http_response_code((int)$status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function feedback_submit_table($config)
{
    $table = is_array($config) ? trim((string)($config['table_client_feedback'] ?? '')) : '';
    return $table !== '' ? $table : 'client_feedback';
}

function feedback_submit_id()
{
    return 'fb_' . bin2hex(random_bytes(12));
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    feedback_submit_respond(405, ['error' => 'Metodo nao permitido']);
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    feedback_submit_respond(400, ['error' => 'JSON invalido']);
}

$token = trim((string)($body['token'] ?? ''));
if (strlen($token) < 10) {
    feedback_submit_respond(401, ['error' => 'Sessao invalida. Faz login de novo.']);
}

$user = users_store_find_by_session_token_hash(hash('sha256', $token));
if (!$user) {
    feedback_submit_respond(401, ['error' => 'Sessao invalida. Faz login de novo.']);
}

$expires = (int)($user['sessionTokenExpires'] ?? 0);
if ($expires && $expires < time()) {
    feedback_submit_respond(401, ['error' => 'Sessao expirada. Faz login de novo.']);
}

$message = trim((string)($body['message'] ?? ''));
if ($message === '') {
    feedback_submit_respond(400, ['error' => 'Escreve alguma coisa antes de enviar.']);
}
if (mb_strlen($message) > 4000) {
    $message = mb_substr($message, 0, 4000);
}

$page = trim((string)($body['page'] ?? ''));
if (mb_strlen($page) > 120) {
    $page = mb_substr($page, 0, 120);
}

$rawImages = is_array($body['images'] ?? null) ? $body['images'] : [];
$images = [];
foreach ($rawImages as $image) {
    if (count($images) >= 4) break;
    $image = (string)$image;
    if (!preg_match('/^data:image\/(png|jpe?g|gif|webp);base64,/', $image)) continue;
    if (strlen($image) > 6 * 1024 * 1024) continue;
    $images[] = $image;
}

$config = supabase_config();
if (!$config || empty($config['enabled'])) {
    feedback_submit_respond(500, ['error' => 'Supabase nao esta configurado neste ambiente.']);
}

$table = feedback_submit_table($config);
$row = [
    'id' => feedback_submit_id(),
    'user_email' => strtolower(trim((string)($user['email'] ?? ''))),
    'user_name' => trim((string)($user['name'] ?? '')) ?: 'Sem nome',
    'message' => $message,
    'page' => $page !== '' ? $page : null,
    'images' => $images ?: null,
    'created_at' => date('c'),
];

$res = supabase_client_request('POST', $table, [], $row, ['Prefer' => 'return=representation']);
if (empty($res['ok'])) {
    feedback_submit_respond(500, ['error' => (string)($res['error'] ?? 'Nao consegui enviar o feedback agora.')]);
}

feedback_submit_respond(200, ['ok' => true]);
