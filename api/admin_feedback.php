<?php
// api/admin_feedback.php
// Lista os feedbacks enviados pelos clientes. So os fundadores veem isso.

ini_set('display_errors', '0');
error_reporting(0);

require_once __DIR__ . '/users_store.php';
require_once __DIR__ . '/supabase_client.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

function admin_feedback_respond($status, $data = [])
{
    http_response_code((int)$status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function admin_feedback_allowed_emails()
{
    return [
        'fgui3662@gmail.com',
        'lorenzo.ritter27@gmail.com'
    ];
}

function admin_feedback_table($config)
{
    $table = is_array($config) ? trim((string)($config['table_client_feedback'] ?? '')) : '';
    return $table !== '' ? $table : 'client_feedback';
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    admin_feedback_respond(405, ['error' => 'Metodo nao permitido']);
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    admin_feedback_respond(400, ['error' => 'JSON invalido']);
}

$token = trim((string)($body['token'] ?? ''));
if (strlen($token) < 10) {
    admin_feedback_respond(401, ['error' => 'Sessao invalida. Faz login de novo.']);
}

$user = users_store_find_by_session_token_hash(hash('sha256', $token));
if (!$user) {
    admin_feedback_respond(401, ['error' => 'Sessao invalida. Faz login de novo.']);
}

$expires = (int)($user['sessionTokenExpires'] ?? 0);
if ($expires && $expires < time()) {
    admin_feedback_respond(401, ['error' => 'Sessao expirada. Faz login de novo.']);
}

$email = strtolower(trim((string)($user['email'] ?? '')));
if ($email === '' || !in_array($email, admin_feedback_allowed_emails(), true)) {
    admin_feedback_respond(403, ['error' => 'Sem permissao para ver isso.']);
}

$config = supabase_config();
if (!$config || empty($config['enabled'])) {
    admin_feedback_respond(500, ['error' => 'Supabase nao esta configurado neste ambiente.']);
}

$table = admin_feedback_table($config);
$action = trim((string)($body['action'] ?? 'list'));

if ($action === 'delete') {
    $id = trim((string)($body['id'] ?? ''));
    if ($id === '') {
        admin_feedback_respond(400, ['error' => 'Faltou o id.']);
    }

    $res = supabase_client_request('DELETE', $table, ['id' => 'eq.' . $id], null, ['Prefer' => 'return=minimal']);
    if (empty($res['ok'])) {
        admin_feedback_respond(500, ['error' => (string)($res['error'] ?? 'Nao consegui apagar o feedback.')]);
    }

    admin_feedback_respond(200, ['ok' => true]);
}

$res = supabase_client_request(
    'GET',
    $table,
    ['select' => '*', 'order' => 'created_at.desc', 'limit' => 300],
    null
);

if (empty($res['ok'])) {
    $status = (int)($res['status'] ?? 500);
    if ($status === 404) {
        admin_feedback_respond(500, ['error' => 'A tabela client_feedback ainda nao existe no Supabase. Rode o SQL primeiro.']);
    }
    admin_feedback_respond(500, ['error' => (string)($res['error'] ?? 'Nao consegui carregar os feedbacks.')]);
}

admin_feedback_respond(200, ['ok' => true, 'items' => is_array($res['data']) ? $res['data'] : []]);
