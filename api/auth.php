<?php
// api/auth.php
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

$body = json_decode(file_get_contents('php://input'), true) ?? [];
$action = (string)($body['action'] ?? '');
$email = trim(strtolower((string)($body['email'] ?? '')));
$password = (string)($body['password'] ?? '');
$name = trim((string)($body['name'] ?? ''));

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(400, ['error' => 'Email inválido']);
}

if ($action !== 'signup' && $action !== 'login') {
    respond(400, ['error' => 'Ação inválida']);
}

if (users_store_backend() === 'error') {
    respond(500, ['error' => users_store_last_error() ?: 'Banco configurado, mas não está pronto ainda.']);
}

if ($action === 'signup') {
    if ($name === '') {
        respond(400, ['error' => 'Nome obrigatório']);
    }
    if (strlen($password) < 6) {
        respond(400, ['error' => 'Senha muito curta (mín. 6)']);
    }

    if (users_store_find_by_email($email)) {
        respond(409, ['error' => 'Esse email já está cadastrado']);
    }

    $token = bin2hex(random_bytes(24));
    $newUser = [
        'id' => uniqid('u_', true),
        'name' => $name,
        'email' => $email,
        'weeklySummary' => false,
        'accessCount' => 0,
        'timeSpentSeconds' => 0,
        'lastLoginAt' => date('c'),
        'password' => password_hash($password, PASSWORD_DEFAULT),
        'createdAt' => date('c'),
        'sessionTokenHash' => hash('sha256', $token),
        'sessionTokenExpires' => time() + 60 * 60 * 24 * 7,
        'resetTokenHash' => null,
        'resetTokenExpires' => null,
        'resetCodeHash' => null,
        'resetCodeExpires' => null,
        'lastSeenAt' => null,
        'lastAccessAt' => null
    ];

    $ok = users_store_insert($newUser);
    if (!$ok) {
        respond(500, [
            'error' => users_store_last_error() ?: 'Não consegui salvar sua conta agora.',
            'hint' => 'Confere o banco (storage/db.json) ou a permissão de escrita do servidor.'
        ]);
    }

    respond(201, [
        'ok' => true,
        'token' => $token,
        'user' => [
            'id' => $newUser['id'],
            'name' => $newUser['name'],
            'email' => $newUser['email'],
            'weeklySummary' => (bool)$newUser['weeklySummary']
        ]
    ]);
}

// login
$user = users_store_find_by_email($email);
if (!$user) {
    respond(401, ['error' => 'Email ou senha inválidos']);
}

$storedPassword = (string)($user['password'] ?? '');
if ($storedPassword === '') {
    // Conta veio de import/backup sem senha. Se a pessoa digitar uma senha válida agora, já grava e segue login normal.
    if (strlen($password) < 6) {
        respond(401, ['error' => 'Conta sem senha. Digite uma nova senha com pelo menos 6 caracteres.']);
    }

    $token = bin2hex(random_bytes(24));
    $updates = [
        'password' => password_hash($password, PASSWORD_DEFAULT),
        'sessionTokenHash' => hash('sha256', $token),
        'sessionTokenExpires' => time() + 60 * 60 * 24 * 7,
        'lastLoginAt' => date('c')
    ];

    $ok = users_store_update_by_id($user['id'], $updates);
    if (!$ok) {
        respond(500, [
            'error' => users_store_last_error() ?: 'Não consegui salvar sua sessão agora.',
            'hint' => 'Confere o banco (storage/db.json) ou a permissão de escrita do servidor.'
        ]);
    }

    respond(200, [
        'ok' => true,
        'token' => $token,
        'user' => [
            'id' => $user['id'] ?? '',
            'name' => $user['name'] ?? '',
            'email' => $user['email'] ?? $email,
            'weeklySummary' => (bool)($user['weeklySummary'] ?? false)
        ]
    ]);
}

$passwordInfo = function_exists('password_get_info') ? password_get_info($storedPassword) : ['algo' => 0];
$isHashed = (int)($passwordInfo['algo'] ?? 0) !== 0;

if (!$isHashed) {
    if (hash_equals($storedPassword, (string)$password)) {
        if (empty($user['id'])) {
            respond(500, ['error' => 'Sua conta está incompleta. Cria outra conta ou fala com o suporte.']);
        }

        $token = bin2hex(random_bytes(24));
        $updates = [
            'password' => password_hash($password, PASSWORD_DEFAULT),
            'sessionTokenHash' => hash('sha256', $token),
            'sessionTokenExpires' => time() + 60 * 60 * 24 * 7,
            'lastLoginAt' => date('c')
        ];

        $ok = users_store_update_by_id($user['id'], $updates);
        if (!$ok) {
            respond(500, [
                'error' => users_store_last_error() ?: 'Não consegui salvar sua sessão agora.',
                'hint' => 'Confere o banco (storage/db.json) ou a permissão de escrita do servidor.'
            ]);
        }

        respond(200, [
            'ok' => true,
            'token' => $token,
            'user' => [
                'id' => $user['id'] ?? '',
                'name' => $user['name'] ?? '',
                'email' => $user['email'] ?? $email,
                'weeklySummary' => (bool)($user['weeklySummary'] ?? false)
            ]
        ]);
    }

    respond(401, ['error' => 'Email ou senha inválidos']);
}

if (!password_verify($password, $storedPassword)) {
    respond(401, ['error' => 'Email ou senha inválidos']);
}

if (empty($user['id'])) {
    respond(500, ['error' => 'Sua conta está incompleta. Cria outra conta ou fala com o suporte.']);
}

$token = bin2hex(random_bytes(24));
$updates = [
    'sessionTokenHash' => hash('sha256', $token),
    'sessionTokenExpires' => time() + 60 * 60 * 24 * 7,
    'lastLoginAt' => date('c')
];

$ok = users_store_update_by_id($user['id'], $updates);
if (!$ok) {
    respond(500, [
        'error' => users_store_last_error() ?: 'Não consegui salvar sua sessão agora.',
        'hint' => 'Confere o banco (storage/db.json) ou a permissão de escrita do servidor.'
    ]);
}

respond(200, [
    'ok' => true,
    'token' => $token,
    'user' => [
        'id' => $user['id'] ?? '',
        'name' => $user['name'] ?? '',
        'email' => $user['email'] ?? $email,
        'weeklySummary' => (bool)($user['weeklySummary'] ?? false)
    ]
]);
