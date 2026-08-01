<?php
ini_set('display_errors', '0');
error_reporting(0);

require_once __DIR__ . '/users_store.php';
require_once __DIR__ . '/landing_insights_access.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

function landing_insights_auth_respond($status, $data = [])
{
    http_response_code((int)$status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    landing_insights_auth_respond(405, ['ok' => false, 'error' => 'Metodo nao permitido']);
}

if (users_store_backend() === 'error') {
    landing_insights_auth_respond(500, ['ok' => false, 'error' => users_store_last_error() ?: 'Banco configurado, mas nao esta pronto ainda.']);
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    landing_insights_auth_respond(400, ['ok' => false, 'error' => 'JSON invalido']);
}

$action = trim((string)($body['action'] ?? 'login'));

if ($action === 'logout') {
    $token = trim((string)($body['token'] ?? ''));
    if ($token !== '') {
        landing_private_destroy_session($token);
    }
    landing_insights_auth_respond(200, ['ok' => true]);
}

if ($action !== 'login') {
    landing_insights_auth_respond(400, ['ok' => false, 'error' => 'Acao invalida']);
}

$email = strtolower(trim((string)($body['email'] ?? '')));
$password = (string)($body['password'] ?? '');
$remember = !empty($body['remember']);

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === '') {
    landing_insights_auth_respond(400, ['ok' => false, 'error' => 'Informe e-mail e senha validos.']);
}

if (!landing_private_is_allowed_email($email)) {
    landing_insights_auth_respond(403, ['ok' => false, 'error' => 'Este login nao tem acesso ao tracker privado.']);
}

$user = users_store_find_by_email($email);
if (!is_array($user) || !landing_private_verify_password($user, $password)) {
    landing_insights_auth_respond(401, ['ok' => false, 'error' => 'E-mail ou senha invalidos.']);
}

$session = landing_private_create_session($email, $remember);
if (empty($session['ok'])) {
    landing_insights_auth_respond(500, ['ok' => false, 'error' => $session['error'] ?? 'Nao consegui criar a sessao privada.']);
}

landing_insights_auth_respond(200, [
    'ok' => true,
    'token' => (string)$session['token'],
    'expiresAt' => (string)$session['expiresAt'],
    'remember' => !empty($session['remember']),
    'user' => [
        'email' => $email,
        'name' => (string)($user['name'] ?? ''),
    ],
]);
