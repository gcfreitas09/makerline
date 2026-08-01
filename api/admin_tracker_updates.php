<?php
// api/admin_tracker_updates.php
// Linha do tempo de atualizacoes da equipe, dentro do painel do tracker.
// CRUD simples (listar/criar/editar/apagar), gated pela sessao privada do tracker.

ini_set('display_errors', '0');
error_reporting(0);

require_once __DIR__ . '/landing_insights_access.php';
require_once __DIR__ . '/supabase_client.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

function admin_tracker_updates_respond($status, $data = [])
{
    http_response_code((int)$status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function admin_tracker_updates_table()
{
    $config = supabase_config();
    $table = is_array($config) ? trim((string)($config['table_team_updates'] ?? '')) : '';
    return $table !== '' ? $table : 'team_updates';
}

function admin_tracker_updates_author_name($email)
{
    $map = [
        'fgui3662@gmail.com' => 'Guilherme',
        'lorenzo.ritter27@gmail.com' => 'Lorenzo',
    ];
    $safe = strtolower(trim((string)$email));
    if (isset($map[$safe])) return $map[$safe];

    $local = explode('@', $safe)[0] ?? $safe;
    $local = str_replace(['.', '_'], ' ', $local);
    return $local !== '' ? ucwords($local) : 'Equipe';
}

function admin_tracker_updates_id()
{
    return 'upd_' . bin2hex(random_bytes(12));
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    admin_tracker_updates_respond(405, ['error' => 'Metodo nao permitido']);
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    admin_tracker_updates_respond(400, ['error' => 'JSON invalido']);
}

$token = trim((string)($body['token'] ?? ''));
if ($token === '') {
    admin_tracker_updates_respond(401, ['error' => 'Sessao privada invalida. Faz login de novo.']);
}

$auth = landing_private_authenticate_token($token);
if (empty($auth['ok'])) {
    admin_tracker_updates_respond((int)($auth['status'] ?? 401), ['error' => $auth['error'] ?? 'Sessao invalida.']);
}

$email = strtolower(trim((string)($auth['email'] ?? '')));

$config = supabase_config();
if (!$config || empty($config['enabled'])) {
    admin_tracker_updates_respond(500, ['error' => 'Supabase nao esta configurado neste ambiente.']);
}

$table = admin_tracker_updates_table();
$action = trim((string)($body['action'] ?? 'list'));

if ($action === 'list') {
    $res = supabase_client_request(
        'GET',
        $table,
        ['select' => '*', 'order' => 'created_at.desc', 'limit' => 200],
        null
    );

    if (empty($res['ok'])) {
        $status = (int)($res['status'] ?? 500);
        if ($status === 404) {
            admin_tracker_updates_respond(500, ['error' => 'A tabela team_updates ainda nao existe no Supabase. Rode o SQL primeiro.']);
        }
        admin_tracker_updates_respond(500, ['error' => (string)($res['error'] ?? 'Nao consegui carregar as atualizacoes.')]);
    }

    admin_tracker_updates_respond(200, ['ok' => true, 'updates' => is_array($res['data']) ? $res['data'] : []]);
}

if ($action === 'create') {
    $message = trim((string)($body['message'] ?? ''));
    if ($message === '') {
        admin_tracker_updates_respond(400, ['error' => 'Escreve alguma coisa antes de publicar.']);
    }
    if (mb_strlen($message) > 4000) {
        $message = mb_substr($message, 0, 4000);
    }

    $now = date('c');
    $row = [
        'id' => admin_tracker_updates_id(),
        'author_email' => $email,
        'author_name' => admin_tracker_updates_author_name($email),
        'message' => $message,
        'created_at' => $now,
        'updated_at' => $now,
    ];

    $res = supabase_client_request('POST', $table, [], $row, ['Prefer' => 'return=representation']);
    if (empty($res['ok'])) {
        admin_tracker_updates_respond(500, ['error' => (string)($res['error'] ?? 'Nao consegui salvar a atualizacao.')]);
    }

    $created = is_array($res['data']) && isset($res['data'][0]) ? $res['data'][0] : $row;
    admin_tracker_updates_respond(200, ['ok' => true, 'update' => $created]);
}

if ($action === 'update') {
    $id = trim((string)($body['id'] ?? ''));
    $message = trim((string)($body['message'] ?? ''));
    if ($id === '' || $message === '') {
        admin_tracker_updates_respond(400, ['error' => 'Faltou o id ou a mensagem.']);
    }
    if (mb_strlen($message) > 4000) {
        $message = mb_substr($message, 0, 4000);
    }

    $res = supabase_client_request(
        'PATCH',
        $table,
        ['id' => 'eq.' . $id],
        ['message' => $message, 'updated_at' => date('c')],
        ['Prefer' => 'return=representation']
    );

    if (empty($res['ok'])) {
        admin_tracker_updates_respond(500, ['error' => (string)($res['error'] ?? 'Nao consegui editar a atualizacao.')]);
    }

    $rows = is_array($res['data']) ? $res['data'] : [];
    if (!$rows) {
        admin_tracker_updates_respond(404, ['error' => 'Atualizacao nao encontrada.']);
    }

    admin_tracker_updates_respond(200, ['ok' => true, 'update' => $rows[0]]);
}

if ($action === 'delete') {
    $id = trim((string)($body['id'] ?? ''));
    if ($id === '') {
        admin_tracker_updates_respond(400, ['error' => 'Faltou o id.']);
    }

    $res = supabase_client_request('DELETE', $table, ['id' => 'eq.' . $id], null, ['Prefer' => 'return=minimal']);
    if (empty($res['ok'])) {
        admin_tracker_updates_respond(500, ['error' => (string)($res['error'] ?? 'Nao consegui apagar a atualizacao.')]);
    }

    admin_tracker_updates_respond(200, ['ok' => true]);
}

admin_tracker_updates_respond(400, ['error' => 'Acao invalida.']);
