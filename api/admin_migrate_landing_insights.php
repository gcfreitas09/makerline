<?php
// api/admin_migrate_landing_insights.php
// Importa eventos de storage/landing_insights.json pro Supabase (admin-only).
// Serve para não perder o histórico de views/leads da landing quando fizer deploy/FTP.

ini_set('display_errors', '0');
error_reporting(0);

require_once __DIR__ . '/users_store.php';
require_once __DIR__ . '/landing_insights_store.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

$adminsFile = __DIR__ . '/../storage/admins.json';
$adminsExampleFile = __DIR__ . '/../storage/admins.example.json';

function respond($status, $data = [])
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function loadJsonFile($file)
{
    if (!file_exists($file)) return null;
    $json = file_get_contents($file);
    $data = json_decode($json, true);
    return is_array($data) ? $data : null;
}

function loadAdmins($adminsFile, $exampleFile)
{
    $data = loadJsonFile($adminsFile);
    if (!$data) $data = loadJsonFile($exampleFile);
    $emails = is_array($data['emails'] ?? null) ? $data['emails'] : [];
    $clean = [];
    foreach ($emails as $email) {
        $e = trim(strtolower((string)$email));
        if (!$e) continue;
        $clean[] = $e;
    }
    return array_values(array_unique($clean));
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    respond(405, ['error' => 'Método não permitido']);
}

if (users_store_backend() === 'error') {
    respond(500, ['error' => users_store_last_error() ?: 'Banco configurado, mas não está pronto ainda.']);
}

if (landing_insights_remote_table() === '') {
    respond(400, [
        'error' => 'Supabase não está configurado para os eventos da landing.',
        'hint' => 'Confira storage/supabase.json (enabled: true) e roda o SQL em sql/landing_insights_events.supabase.sql.'
    ]);
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    respond(400, ['error' => 'JSON inválido']);
}

$token = trim((string)($body['token'] ?? ''));
if (strlen($token) < 10) {
    respond(401, ['error' => 'Sessão inválida. Faz login de novo.']);
}

$tokenHash = hash('sha256', $token);
$now = time();
$foundUser = users_store_find_by_session_token_hash($tokenHash);
if (!$foundUser) {
    respond(401, ['error' => 'Sessão inválida. Faz login de novo.']);
}

$expires = (int)($foundUser['sessionTokenExpires'] ?? 0);
if ($expires && $expires < $now) {
    respond(401, ['error' => 'Sessão expirada. Faz login de novo.']);
}

$adminEmails = loadAdmins($adminsFile, $adminsExampleFile);
$currentEmail = strtolower(trim((string)($foundUser['email'] ?? '')));
if (!$currentEmail || !in_array($currentEmail, $adminEmails, true)) {
    respond(403, ['error' => 'Sem permissão para fazer isso.']);
}

$localFile = LANDING_INSIGHTS_STORAGE_FILE;
$raw = @file_get_contents($localFile);
$localStore = landing_insights_decode_store($raw ?: '');
$events = is_array($localStore['events']) ? $localStore['events'] : [];

$totalEvents = count($events);
$imported = 0;
$errors = 0;

foreach ($events as $event) {
    if (!is_array($event)) {
        $errors++;
        continue;
    }

    if (landing_insights_remote_upsert_event($event)) {
        $imported++;
    } else {
        $errors++;
    }
}

respond(200, [
    'ok' => true,
    'backend' => 'supabase',
    'totalEvents' => $totalEvents,
    'imported' => $imported,
    'errors' => $errors,
    'lastError' => $errors > 0 ? landing_insights_remote_last_error() : null,
]);
