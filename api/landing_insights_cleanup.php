<?php
require_once __DIR__ . '/landing_insights_access.php';
require_once __DIR__ . '/landing_insights_store.php';
require_once __DIR__ . '/waitlist_store.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

function landing_insights_cleanup_respond($status, $data = [])
{
    http_response_code((int)$status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function landing_insights_cleanup_is_test_event($event)
{
    if (!is_array($event)) return false;
    if (!empty($event['is_test']) || !empty($event['isTest'])) return true;

    $joined = strtolower(trim(implode(' ', array_filter([
        (string)($event['page_url'] ?? ($event['entryUrl'] ?? '')),
        (string)($event['referrer'] ?? ''),
        (string)($event['referrer_host'] ?? ($event['referrerHost'] ?? '')),
        (string)($event['hostname'] ?? ''),
        (string)($event['environment'] ?? ''),
    ]))));

    return strpos($joined, 'localhost') !== false
        || strpos($joined, '127.0.0.1') !== false
        || strpos($joined, 'file://') !== false
        || strpos($joined, 'development') !== false
        || strpos($joined, 'staging') !== false;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    landing_insights_cleanup_respond(405, ['ok' => false, 'error' => 'Metodo nao permitido.']);
}

$raw = file_get_contents('php://input');
$body = json_decode((string)$raw, true);
if (!is_array($body)) {
    landing_insights_cleanup_respond(400, ['ok' => false, 'error' => 'JSON invalido.']);
}

$auth = landing_private_authenticate_token($body['token'] ?? '');
if (($auth['ok'] ?? false) !== true) {
    landing_insights_cleanup_respond((int)($auth['status'] ?? 401), [
        'ok' => false,
        'error' => (string)($auth['error'] ?? 'Sessao privada invalida ou expirada.'),
    ]);
}

$store = landing_insights_load_store();
$events = is_array($store['events'] ?? null) ? array_values($store['events']) : [];
$beforeEvents = count($events);
$events = array_values(array_filter($events, function ($event) {
    return !landing_insights_cleanup_is_test_event($event);
}));
$store['events'] = $events;
$eventsSaved = landing_insights_save_store($store);
if (!$eventsSaved) {
    landing_insights_cleanup_respond(500, ['ok' => false, 'error' => 'Nao consegui limpar os eventos de teste.']);
}

$waitlistCleanup = waitlist_store_delete_test_entries();
if (($waitlistCleanup['ok'] ?? false) !== true) {
    landing_insights_cleanup_respond(500, ['ok' => false, 'error' => (string)($waitlistCleanup['error'] ?? 'Nao consegui limpar os leads de teste.')]);
}

landing_insights_cleanup_respond(200, [
    'ok' => true,
    'deletedEvents' => max(0, $beforeEvents - count($events)),
    'deletedLeads' => (int)($waitlistCleanup['deletedCount'] ?? 0),
    'remainingEvents' => count($events),
    'remainingLeads' => (int)($waitlistCleanup['remainingCount'] ?? 0),
]);
