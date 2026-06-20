<?php
// api/email_log.php
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

$ip = $_SERVER['REMOTE_ADDR'] ?? '';
$allowed = ['127.0.0.1', '::1'];
if (!in_array($ip, $allowed, true)) {
    http_response_code(403);
    echo json_encode(['error' => 'Acesso bloqueado'], JSON_UNESCAPED_UNICODE);
    exit;
}

$file = __DIR__ . '/../storage/email_log.json';
if (!file_exists($file)) {
    echo json_encode(['ok' => true, 'entries' => []], JSON_UNESCAPED_UNICODE);
    exit;
}

$raw = file_get_contents($file);
$data = json_decode($raw, true);
if (!is_array($data)) {
    $data = [];
}

$limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 30;
if ($limit < 1) $limit = 1;
if ($limit > 200) $limit = 200;

$slice = array_slice($data, -$limit);
$entries = [];
foreach ($slice as $row) {
    if (!is_array($row)) continue;

    $mailer = $row['mailer'] ?? [];
    $entries[] = [
        'kind' => $row['kind'] ?? ($row['type'] ?? 'email'),
        'email' => $row['email'] ?? '',
        'sent' => (bool) ($row['sent'] ?? false),
        'timestamp' => $row['timestamp'] ?? null,
        'subject' => $row['subject'] ?? null,
        'mailer' => [
            'smtpConfigured' => $mailer['smtpConfigured'] ?? null,
            'driver' => $mailer['driver'] ?? null,
            'error' => $mailer['error'] ?? null
        ]
    ];
}

echo json_encode([
    'ok' => true,
    'count' => count($entries),
    'entries' => $entries
], JSON_UNESCAPED_UNICODE);
