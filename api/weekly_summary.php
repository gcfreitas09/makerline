<?php
// api/weekly_summary.php
ini_set('display_errors', '0');
error_reporting(0);

require_once __DIR__ . '/users_store.php';
require_once __DIR__ . '/mailer.php';

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
$token = trim((string)($body['token'] ?? ''));
$snapshot = $body['snapshot'] ?? null;

if (strlen($token) < 10) {
    respond(401, ['error' => 'Sessão inválida. Faz login de novo.']);
}

$tokenHash = hash('sha256', $token);
$now = time();
$foundUser = users_store_find_by_session_token_hash($tokenHash);
if (!$foundUser || empty($foundUser['id'])) {
    respond(401, ['error' => 'Sessão inválida. Faz login de novo.']);
}

$expires = (int)($foundUser['sessionTokenExpires'] ?? 0);
if ($expires && $expires < $now) {
    respond(401, ['error' => 'Sessão expirada. Faz login de novo.']);
}

if (empty($foundUser['weeklySummary'])) {
    respond(400, ['error' => 'Ativa o resumo semanal nas configurações primeiro.']);
}

$snapshotUsed = is_array($snapshot) ? $snapshot : null;

$formatMoney = function ($value) {
    $safe = is_numeric($value) ? (int)$value : 0;
    return 'R$ ' . number_format($safe, 0, ',', '.');
};

if (function_exists('load_smtp_config')) {
    load_smtp_config();
}
$mailerInfo = function_exists('mailer_last_info') ? mailer_last_info() : null;

$to = (string)($foundUser['email'] ?? '');
$name = (string)($foundUser['name'] ?? 'Creator');

$subject = 'Seu resumo semanal Makerline';
$message = "Oi {$name}!\n\n";

if ($snapshotUsed) {
    $pending = (int)($snapshotUsed['pending'] ?? 0);
    $negotiating = (int)($snapshotUsed['negotiating'] ?? 0);
    $done = (int)($snapshotUsed['done'] ?? 0);
    $scripts = (int)($snapshotUsed['scripts'] ?? 0);
    $streak = (int)($snapshotUsed['streak'] ?? 0);
    $level = (int)($snapshotUsed['level'] ?? 1);
    $xp = (int)($snapshotUsed['xp'] ?? 0);
    $totalReceived = $formatMoney($snapshotUsed['totalReceived'] ?? 0);
    $focus = is_array($snapshotUsed['focus'] ?? null) ? $snapshotUsed['focus'] : [];
    $focusLabel = (string)($focus['label'] ?? 'Seu foco');
    $focusCurrent = (int)($focus['current'] ?? 0);
    $focusTarget = (int)($focus['target'] ?? 0);

    $message .=
        "Resumo da semana:\n" .
        "- Campanhas: {$done} pagas, {$negotiating} em negociação, {$pending} em prospecção\n" .
        "- Total recebido: {$totalReceived}\n" .
        "- Roteiros criados: {$scripts}\n" .
        "- Streak: {$streak} dias\n" .
        "- Nível: {$level} ({$xp} XP)\n\n" .
        "Foco: {$focusLabel} ({$focusCurrent}/{$focusTarget})\n\n" .
        "Bora pra próxima!\n" .
        "Equipe Makerline";
} else {
    $message .=
        "Aqui vai um resumão rapidinho:\n" .
        "- Propostas enviadas: 24\n" .
        "- Campanhas em andamento: 3\n" .
        "- Novos roteiros: 2\n" .
        "- Streak atual: 5 dias\n\n" .
        "Continue evoluindo seu conteúdo!\n" .
        "Equipe Makerline";
}

$preview = null;
$sent = 0;
$failed = 0;

if (!$to) {
    $failed = 1;
} else {
    $ok = send_email($to, $subject, $message);
    $mailerInfo = function_exists('mailer_last_info') ? mailer_last_info() : $mailerInfo;
    if ($ok) {
        $sent = 1;
    } else {
        $failed = 1;
        if ($snapshotUsed) $preview = $message;
    }

    logEmail($logFile, [
        'email' => $to,
        'sent' => $ok,
        'kind' => 'weekly_summary',
        'subject' => $subject,
        'message' => $message,
        'mailer' => $mailerInfo,
        'timestamp' => date('c')
    ]);
}

respond(200, [
    'ok' => true,
    'sent' => $sent,
    'failed' => $failed,
    'recipients' => 1,
    'snapshot' => $snapshotUsed,
    'mailer' => $mailerInfo,
    'preview' => $preview
]);
