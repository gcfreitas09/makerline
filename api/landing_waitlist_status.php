<?php
require_once __DIR__ . '/landing_insights_access.php';
require_once __DIR__ . '/waitlist_store.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

function landing_waitlist_status_respond($status, $data = [])
{
    http_response_code((int)$status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    landing_waitlist_status_respond(405, ['ok' => false, 'error' => 'Metodo nao permitido.']);
}

$raw = file_get_contents('php://input');
$body = json_decode((string)$raw, true);
if (!is_array($body)) {
    landing_waitlist_status_respond(400, ['ok' => false, 'error' => 'JSON invalido.']);
}

$auth = landing_private_authenticate_token($body['token'] ?? '');
if (($auth['ok'] ?? false) !== true) {
    landing_waitlist_status_respond((int)($auth['status'] ?? 401), [
        'ok' => false,
        'error' => (string)($auth['error'] ?? 'Sessao privada invalida ou expirada.'),
    ]);
}

$leadId = trim((string)($body['leadId'] ?? ''));
$status = trim((string)($body['status'] ?? ''));
if ($leadId === '' || $status === '') {
    landing_waitlist_status_respond(400, ['ok' => false, 'error' => 'Informe o lead e o status desejado.']);
}

$result = waitlist_store_update_status_by_id($leadId, $status);
if (($result['ok'] ?? false) !== true) {
    landing_waitlist_status_respond((int)($result['status'] ?? 500), [
        'ok' => false,
        'error' => (string)($result['error'] ?? 'Nao consegui atualizar o status do lead.'),
    ]);
}

$lead = is_array($result['lead'] ?? null) ? $result['lead'] : [];
landing_waitlist_status_respond(200, [
    'ok' => true,
    'lead' => [
        'id' => (string)($lead['id'] ?? $leadId),
        'leadStatus' => (string)($lead['leadStatus'] ?? waitlist_store_normalize_lead_status($status)),
        'updatedAt' => (string)($lead['updatedAt'] ?? ''),
    ],
]);
