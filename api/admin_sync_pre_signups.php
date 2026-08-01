<?php
require_once __DIR__ . '/users_store.php';
require_once __DIR__ . '/waitlist_store.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

function admin_sync_pre_signups_respond($status, $data = [])
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function admin_sync_pre_signups_allowed_emails()
{
    return [
        'fgui3662@gmail.com',
        'lorenzo.ritter27@gmail.com'
    ];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    admin_sync_pre_signups_respond(405, ['ok' => false, 'error' => 'Metodo nao permitido']);
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    admin_sync_pre_signups_respond(400, ['ok' => false, 'error' => 'JSON invalido']);
}

$token = trim((string)($body['token'] ?? ''));
if (strlen($token) < 10) {
    admin_sync_pre_signups_respond(401, ['ok' => false, 'error' => 'Sessao invalida. Faz login de novo.']);
}

$user = users_store_find_by_session_token_hash(hash('sha256', $token));
if (!$user) {
    admin_sync_pre_signups_respond(401, ['ok' => false, 'error' => 'Sessao invalida. Faz login de novo.']);
}

$expires = (int)($user['sessionTokenExpires'] ?? 0);
if ($expires && $expires < time()) {
    admin_sync_pre_signups_respond(401, ['ok' => false, 'error' => 'Sessao expirada. Faz login de novo.']);
}

$email = trim(strtolower((string)($user['email'] ?? '')));
if ($email === '' || !in_array($email, admin_sync_pre_signups_allowed_emails(), true)) {
    admin_sync_pre_signups_respond(403, ['ok' => false, 'error' => 'Sem permissao para sincronizar pre-cadastros.']);
}

$entries = waitlist_store_load_all();
$result = waitlist_store_sync_all_to_remote($entries);

admin_sync_pre_signups_respond(200, [
    'ok' => (bool)($result['ok'] ?? false),
    'loaded' => count($entries),
    'sent' => (int)($result['sent'] ?? 0),
    'failed' => (int)($result['failed'] ?? 0),
    'remoteError' => (string)($result['remoteError'] ?? ''),
]);
