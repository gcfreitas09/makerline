<?php
// api/push_subscribe.php
// Guarda (ou remove) a inscricao de push do navegador do usuario logado.

ini_set('display_errors', '0');
error_reporting(0);

require_once __DIR__ . '/users_store.php';
require_once __DIR__ . '/push_crypto.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

function push_subscribe_respond($status, $data = [])
{
    http_response_code((int)$status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function push_subscriptions_table()
{
    $config = function_exists('supabase_config') ? supabase_config() : null;
    $table = is_array($config) ? trim((string)($config['table_push_subscriptions'] ?? '')) : '';
    return $table !== '' ? $table : 'push_subscriptions';
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    push_subscribe_respond(405, ['ok' => false, 'error' => 'Metodo nao permitido']);
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    push_subscribe_respond(400, ['ok' => false, 'error' => 'JSON invalido']);
}

// A chave publica VAPID e publica de proposito: o navegador precisa dela pra se inscrever.
if (($body['action'] ?? '') === 'public-key') {
    $keys = push_vapid_keys();
    if (!$keys) push_subscribe_respond(500, ['ok' => false, 'error' => 'Nao consegui preparar as chaves de push.']);
    push_subscribe_respond(200, ['ok' => true, 'publicKey' => $keys['publicKey']]);
}

$token = trim((string)($body['token'] ?? ''));
if (strlen($token) < 10) {
    push_subscribe_respond(401, ['ok' => false, 'error' => 'Sessao invalida.']);
}

$user = users_store_find_by_session_token_hash(hash('sha256', $token));
if (!$user) {
    push_subscribe_respond(401, ['ok' => false, 'error' => 'Sessao invalida.']);
}

$expires = (int)($user['sessionTokenExpires'] ?? 0);
if ($expires && $expires < time()) {
    push_subscribe_respond(401, ['ok' => false, 'error' => 'Sessao expirada.']);
}

$table = push_subscriptions_table();
$action = trim((string)($body['action'] ?? 'subscribe'));
$endpoint = trim((string)($body['endpoint'] ?? ''));

if ($action === 'unsubscribe') {
    if ($endpoint === '') push_subscribe_respond(400, ['ok' => false, 'error' => 'Endpoint obrigatorio.']);

    supabase_client_request('DELETE', $table, ['endpoint' => 'eq.' . $endpoint], null, ['Prefer' => 'return=minimal']);
    push_subscribe_respond(200, ['ok' => true, 'removed' => true]);
}

$p256dh = trim((string)($body['p256dh'] ?? ''));
$auth = trim((string)($body['auth'] ?? ''));

if ($endpoint === '' || $p256dh === '' || $auth === '') {
    push_subscribe_respond(400, ['ok' => false, 'error' => 'Dados da inscricao incompletos.']);
}
if (!filter_var($endpoint, FILTER_VALIDATE_URL) || stripos($endpoint, 'https://') !== 0) {
    push_subscribe_respond(400, ['ok' => false, 'error' => 'Endpoint invalido.']);
}

$row = [
    'id' => 'push_' . substr(hash('sha256', $endpoint), 0, 32),
    'user_id' => (string)($user['id'] ?? ''),
    'user_email' => strtolower(trim((string)($user['email'] ?? ''))),
    'endpoint' => $endpoint,
    'p256dh' => $p256dh,
    'auth' => $auth,
    'user_agent' => substr(trim((string)($_SERVER['HTTP_USER_AGENT'] ?? '')), 0, 300),
    'notify_deadlines' => !isset($body['notifyDeadlines']) || !empty($body['notifyDeadlines']),
    'notify_payments' => !isset($body['notifyPayments']) || !empty($body['notifyPayments']),
    'updated_at' => date('c'),
];

$response = supabase_client_request(
    'POST',
    $table,
    ['on_conflict' => 'endpoint'],
    $row,
    ['Prefer' => 'resolution=merge-duplicates,return=minimal']
);

if (($response['ok'] ?? false) !== true) {
    push_subscribe_respond(500, [
        'ok' => false,
        'error' => (string)($response['error'] ?? 'Nao consegui salvar a inscricao.'),
    ]);
}

push_subscribe_respond(200, ['ok' => true, 'subscribed' => true]);
