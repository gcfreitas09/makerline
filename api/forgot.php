<?php
// api/forgot.php
ini_set('display_errors', '0');
error_reporting(0);

require_once __DIR__ . '/users_store.php';
require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/url.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

$logFile = __DIR__ . '/../storage/email_log.json';
if (!file_exists($logFile)) {
    @file_put_contents($logFile, json_encode([], JSON_UNESCAPED_UNICODE), LOCK_EX);
}

function respond($status, $data = [])
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function logEmail($file, $entry)
{
    $raw = @file_get_contents($file);
    $data = json_decode((string)$raw, true);
    if (!is_array($data)) $data = [];
    $data[] = $entry;
    @file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    respond(405, ['error' => 'Método não permitido']);
}

if (users_store_backend() === 'error') {
    respond(500, ['error' => users_store_last_error() ?: 'Banco configurado, mas não está pronto ainda.']);
}

$body = json_decode(file_get_contents('php://input'), true) ?? [];
$email = trim(strtolower((string)($body['email'] ?? '')));

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(400, ['error' => 'Email inválido']);
}

$user = users_store_find_by_email($email);
if (!$user || empty($user['id'])) {
    respond(404, ['error' => 'Conta não encontrada']);
}

$code = (string)random_int(100000, 999999);
$codeHash = hash('sha256', $code);
$expires = time() + 600;

$ok = users_store_update_by_id((string)$user['id'], [
    'resetTokenHash' => null,
    'resetTokenExpires' => null,
    'resetCodeHash' => $codeHash,
    'resetCodeExpires' => $expires
]);

if (!$ok) {
    respond(500, ['error' => users_store_last_error() ?: 'Não consegui gerar o código agora.']);
}

$verifyLink = ugc_base_url() . '/verify.html?email=' . urlencode($email);
$subject = 'Código de verificação - Makerline';
$message = "Oi!\n\n" .
    "Pra confirmar que esse email é seu mesmo, aqui vai seu código:\n\n" .
    $code . "\n\n" .
    "Ele expira em 10 minutos.\n\n" .
    "Você pode abrir a tela de confirmação por aqui:\n" .
    $verifyLink . "\n\n" .
    "Se você não pediu, só ignora.\n";

$sent = send_email($email, $subject, $message);
$mailerInfo = function_exists('mailer_last_info') ? mailer_last_info() : null;

$ip = $_SERVER['REMOTE_ADDR'] ?? '';
$isLocal = in_array($ip, ['127.0.0.1', '::1'], true);

logEmail($logFile, [
    'type' => 'reset_code',
    'email' => $email,
    'verifyLink' => $verifyLink,
    'code' => $sent ? null : ($isLocal ? $code : null),
    'sent' => $sent,
    'mailer' => $mailerInfo,
    'timestamp' => date('c')
]);

$responseMessage = $sent
    ? 'Te mandei um código no email.'
    : ($isLocal
        ? 'Não deu pra enviar agora (ambiente local). Vou te mostrar o código aqui mesmo.'
        : 'Não consegui enviar o email agora. Tenta de novo mais tarde.');

if (!$sent && !$isLocal) {
    respond(503, ['error' => $responseMessage, 'sent' => false, 'mailer' => $mailerInfo]);
}

respond(200, [
    'ok' => true,
    'sent' => $sent,
    'message' => $responseMessage,
    'next' => 'verify.html?email=' . urlencode($email),
    'code' => $sent ? null : ($isLocal ? $code : null),
    'mailer' => $mailerInfo
]);

