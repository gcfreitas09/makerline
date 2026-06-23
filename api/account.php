<?php
// api/account.php
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

<<<<<<< HEAD
function account_password_matches($plain, $storedHash)
{
    $storedHash = (string)$storedHash;
    if ($storedHash === '') return false;

    $info = function_exists('password_get_info') ? password_get_info($storedHash) : ['algo' => 0];
    $isHashed = (int)($info['algo'] ?? 0) !== 0;
    return $isHashed ? password_verify((string)$plain, $storedHash) : hash_equals($storedHash, (string)$plain);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    respond(405, ['error' => 'Metodo nao permitido']);
}

if (users_store_backend() === 'error') {
    respond(500, ['error' => users_store_last_error() ?: 'Banco configurado, mas nao esta pronto ainda.']);
=======
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    respond(405, ['error' => 'Método não permitido']);
}

if (users_store_backend() === 'error') {
    respond(500, ['error' => users_store_last_error() ?: 'Banco configurado, mas não está pronto ainda.']);
>>>>>>> 902074b4211073f9129513d97dbf8b86232764f7
}

$body = json_decode(file_get_contents('php://input'), true) ?? [];
$token = trim((string)($body['token'] ?? ''));
$newEmail = trim(strtolower((string)($body['newEmail'] ?? '')));
<<<<<<< HEAD
$newPassword = trim((string)($body['newPassword'] ?? ''));
$currentPassword = (string)($body['currentPassword'] ?? '');
$confirmPassword = (string)($body['confirmPassword'] ?? ($body['confirmNewPassword'] ?? ''));

if (strlen($token) < 10) {
    respond(401, ['error' => 'Sessao invalida. Faz login de novo.']);
}

if ($newEmail && !filter_var($newEmail, FILTER_VALIDATE_EMAIL)) {
    respond(400, ['error' => 'Novo e-mail invalido']);
}

if (!$newEmail && $newPassword === '') {
    respond(400, ['error' => 'Nada para salvar. Preencha um novo e-mail ou use Alterar senha.']);
=======
$newPassword = (string)($body['newPassword'] ?? '');

if (strlen($token) < 10) {
    respond(401, ['error' => 'Sessão inválida. Faz login de novo.']);
}

if ($newEmail && !filter_var($newEmail, FILTER_VALIDATE_EMAIL)) {
    respond(400, ['error' => 'Novo email inválido']);
}

$hasUpdates = (bool)$newEmail || (bool)$newPassword;
if (!$hasUpdates) {
    respond(400, ['error' => 'Nada pra salvar. Preencha um novo email ou uma nova senha.']);
>>>>>>> 902074b4211073f9129513d97dbf8b86232764f7
}

$tokenHash = hash('sha256', $token);
$now = time();
$user = users_store_find_by_session_token_hash($tokenHash);
if (!$user || empty($user['id'])) {
<<<<<<< HEAD
    respond(401, ['error' => 'Sessao invalida. Faz login de novo.']);
=======
    respond(401, ['error' => 'Sessão inválida. Faz login de novo.']);
>>>>>>> 902074b4211073f9129513d97dbf8b86232764f7
}

$expires = (int)($user['sessionTokenExpires'] ?? 0);
if ($expires && $expires < $now) {
<<<<<<< HEAD
    respond(401, ['error' => 'Sessao expirada. Faz login de novo.']);
=======
    respond(401, ['error' => 'Sessão expirada. Faz login de novo.']);
>>>>>>> 902074b4211073f9129513d97dbf8b86232764f7
}

$updates = [];

if ($newEmail) {
    $currentEmail = trim(strtolower((string)($user['email'] ?? '')));
    if ($newEmail !== $currentEmail) {
        $check = users_store_find_by_email($newEmail);
        if ($check && !empty($check['id']) && (string)$check['id'] !== (string)$user['id']) {
<<<<<<< HEAD
            respond(409, ['error' => 'Esse e-mail ja esta em uso']);
=======
            respond(409, ['error' => 'Esse email já está em uso']);
>>>>>>> 902074b4211073f9129513d97dbf8b86232764f7
        }
        $updates['email'] = $newEmail;
    }
}

<<<<<<< HEAD
if ($newPassword !== '') {
    if ($confirmPassword === '' || !hash_equals($newPassword, (string)$confirmPassword)) {
        respond(400, ['error' => 'As senhas nao coincidem.']);
    }
    if (strlen($newPassword) < 6) {
        respond(400, ['error' => 'A nova senha precisa ter pelo menos 6 caracteres.']);
    }

    $storedPassword = (string)($user['password'] ?? '');
    if ($storedPassword === '') {
        $backupPassword = users_store_find_backup_password_for_user($user);
        if ($backupPassword !== '') {
            users_store_update_by_id((string)$user['id'], ['password' => $backupPassword], 'account_password_restore_before_change');
            $storedPassword = $backupPassword;
        }
    }

    if (!account_password_matches($currentPassword, $storedPassword)) {
        respond(400, ['error' => 'A senha atual esta incorreta.']);
    }

=======
if ($newPassword) {
    if (strlen($newPassword) < 6) {
        respond(400, ['error' => 'Senha muito curta (mín. 6)']);
    }
>>>>>>> 902074b4211073f9129513d97dbf8b86232764f7
    $updates['password'] = password_hash($newPassword, PASSWORD_DEFAULT);
}

$newToken = bin2hex(random_bytes(24));
$updates['sessionTokenHash'] = hash('sha256', $newToken);
$updates['sessionTokenExpires'] = time() + 60 * 60 * 24 * 7;

<<<<<<< HEAD
$ok = users_store_update_by_id((string)$user['id'], $updates, 'account_update');
if (!$ok) {
    respond(500, ['error' => users_store_last_error() ?: 'Nao consegui salvar agora.']);
=======
$ok = users_store_update_by_id((string)$user['id'], $updates);
if (!$ok) {
    respond(500, ['error' => users_store_last_error() ?: 'Não consegui salvar agora.']);
>>>>>>> 902074b4211073f9129513d97dbf8b86232764f7
}

$fresh = users_store_find_by_email($updates['email'] ?? ($user['email'] ?? ''));

respond(200, [
    'ok' => true,
    'token' => $newToken,
    'user' => [
        'id' => (string)($fresh['id'] ?? ($user['id'] ?? '')),
        'name' => (string)($fresh['name'] ?? ($user['name'] ?? '')),
        'email' => (string)($fresh['email'] ?? ($updates['email'] ?? ($user['email'] ?? ''))),
<<<<<<< HEAD
    ],
]);
=======
        'weeklySummary' => (bool)($fresh['weeklySummary'] ?? ($user['weeklySummary'] ?? false))
    ]
]);

>>>>>>> 902074b4211073f9129513d97dbf8b86232764f7
