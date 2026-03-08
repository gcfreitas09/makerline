<?php
// api/admin_users.php
require_once __DIR__ . '/users_store.php';
require_once __DIR__ . '/states_store.php';

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

function countCampaignsFromState($state)
{
    if (!is_array($state)) return 0;
    $campaigns = $state['campaigns'] ?? null;
    return is_array($campaigns) ? count($campaigns) : 0;
}

function sanitizeStateFileUserId($userId)
{
    return preg_replace('/[^a-zA-Z0-9_\-]/', '_', (string)$userId);
}

function countCampaignsFromLocalStateFile($userId)
{
    $safeUserId = sanitizeStateFileUserId($userId);
    if (!is_string($safeUserId) || $safeUserId === '') return null;

    $stateFile = __DIR__ . '/../storage/states/' . $safeUserId . '.json';
    if (!is_file($stateFile)) return null;

    $raw = @file_get_contents($stateFile);
    if ($raw === false || trim((string)$raw) === '') return null;

    $payload = json_decode((string)$raw, true);
    if (!is_array($payload)) return null;

    $state = is_array($payload['state'] ?? null) ? $payload['state'] : null;
    return countCampaignsFromState($state);
}

function loadCampaignCountsFromLocalStateFiles($userIds)
{
    $counts = [];
    foreach ((array)$userIds as $userId) {
        $id = trim((string)$userId);
        if ($id === '') continue;
        $count = countCampaignsFromLocalStateFile($id);
        if ($count === null) continue;
        $counts[$id] = (int)$count;
    }
    return $counts;
}

function isSafeSupabaseUserId($userId)
{
    // IDs legados do app usam "." (ex: u_xxx.yyy), então precisa aceitar ponto também.
    return preg_match('/^[a-zA-Z0-9._\-]+$/', (string)$userId) === 1;
}

function loadCampaignCountsFromSupabase($userIds)
{
    $counts = [];
    if (!function_exists('states_store_backend') || states_store_backend() !== 'supabase') return $counts;
    if (!function_exists('supabase_client_request') || !function_exists('states_store_supabase_table')) return $counts;

    $safeIds = [];
    foreach ((array)$userIds as $userId) {
        $id = trim((string)$userId);
        if ($id === '' || !isSafeSupabaseUserId($id)) continue;
        $safeIds[$id] = true;
    }
    $safeIds = array_keys($safeIds);
    if (!$safeIds) return $counts;

    $table = states_store_supabase_table();
    $chunks = array_chunk($safeIds, 150);
    foreach ($chunks as $chunk) {
        if (!is_array($chunk) || !$chunk) continue;
        $quotedChunk = array_map(function ($id) {
            return '"' . $id . '"';
        }, $chunk);
        $inFilter = 'in.(' . implode(',', $quotedChunk) . ')';
        $res = supabase_client_request(
            'GET',
            $table,
            ['select' => 'user_id,state', 'user_id' => $inFilter],
            null
        );
        if (!is_array($res) || empty($res['ok'])) continue;

        $rows = is_array($res['data'] ?? null) ? $res['data'] : [];
        foreach ($rows as $row) {
            if (!is_array($row)) continue;
            $rowUserId = trim((string)($row['user_id'] ?? ''));
            if ($rowUserId === '') continue;

            $rawState = $row['state'] ?? null;
            if (is_string($rawState) && trim($rawState) !== '') {
                $decoded = json_decode($rawState, true);
                if (is_array($decoded)) $rawState = $decoded;
            }
            $state = is_array($rawState) ? $rawState : null;
            $counts[$rowUserId] = countCampaignsFromState($state);
        }
    }

    return $counts;
}

function loadCampaignCountsByUserIds($userIds)
{
    $ids = [];
    foreach ((array)$userIds as $userId) {
        $id = trim((string)$userId);
        if ($id === '') continue;
        $ids[$id] = true;
    }
    $ids = array_keys($ids);
    if (!$ids) return [];

    $counts = [];
    $isSupabaseStates = function_exists('states_store_backend') && states_store_backend() === 'supabase';

    if ($isSupabaseStates) {
        // Fonte de verdade quando states está no Supabase: evita usar arquivo local desatualizado.
        $remoteCounts = loadCampaignCountsFromSupabase($ids);
        foreach ($remoteCounts as $id => $count) {
            $counts[(string)$id] = (int)$count;
        }

        // Fallback local somente para IDs que não vieram do Supabase.
        $missing = [];
        foreach ($ids as $id) {
            if (!array_key_exists($id, $counts)) $missing[] = $id;
        }
        if ($missing) {
            $localCounts = loadCampaignCountsFromLocalStateFiles($missing);
            foreach ($localCounts as $id => $count) {
                $counts[(string)$id] = (int)$count;
            }
        }
    } else {
        $localCounts = loadCampaignCountsFromLocalStateFiles($ids);
        foreach ($localCounts as $id => $count) {
            $counts[(string)$id] = (int)$count;
        }
    }

    // Garante retorno consistente para todos IDs.
    foreach ($ids as $id) {
        if (!array_key_exists($id, $counts)) {
            $counts[$id] = 0;
        }
    }
    return $counts;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    respond(405, ['error' => 'Metodo nao permitido']);
}

if (users_store_backend() === 'error') {
    respond(500, ['error' => users_store_last_error() ?: 'Banco configurado, mas nao esta pronto ainda.']);
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    respond(400, ['error' => 'JSON invalido']);
}

$token = trim((string)($body['token'] ?? ''));
if (strlen($token) < 10) {
    respond(401, ['error' => 'Sessao invalida. Faz login de novo.']);
}

$tokenHash = hash('sha256', $token);
$now = time();
$foundUser = users_store_find_by_session_token_hash($tokenHash);
if (!$foundUser) {
    respond(401, ['error' => 'Sessao invalida. Faz login de novo.']);
}

$expires = (int)($foundUser['sessionTokenExpires'] ?? 0);
if ($expires && $expires < $now) {
    respond(401, ['error' => 'Sessao expirada. Faz login de novo.']);
}

$adminEmails = loadAdmins($adminsFile, $adminsExampleFile);
$currentEmail = strtolower(trim((string)($foundUser['email'] ?? '')));
if (!$currentEmail || !in_array($currentEmail, $adminEmails, true)) {
    respond(403, ['error' => 'Sem permissao pra ver isso.']);
}

$users = users_store_load_all();

$list = [];
$userIds = [];
foreach ($users as $user) {
    $email = strtolower(trim((string)($user['email'] ?? '')));
    if ($email === '') {
        continue;
    }

    $id = (string)($user['id'] ?? '');
    if ($id !== '') $userIds[] = $id;
    $list[] = [
        'id' => $id,
        'name' => (string)($user['name'] ?? ''),
        'email' => $email,
        'createdAt' => (string)($user['createdAt'] ?? ''),
        'weeklySummary' => (bool)($user['weeklySummary'] ?? false),
        'accessCount' => (int)($user['accessCount'] ?? 0),
        'timeSpentSeconds' => (int)($user['timeSpentSeconds'] ?? 0),
        'lastAccessAt' => (string)($user['lastAccessAt'] ?? ''),
        'lastLoginAt' => (string)($user['lastLoginAt'] ?? ''),
        'lastSeenAt' => (string)($user['lastSeenAt'] ?? ''),
        'campaignCount' => 0
    ];
}

$campaignCounts = loadCampaignCountsByUserIds($userIds);
for ($i = 0; $i < count($list); $i++) {
    $id = (string)($list[$i]['id'] ?? '');
    $list[$i]['campaignCount'] = (int)($campaignCounts[$id] ?? 0);
}

usort($list, function ($a, $b) {
    return strcmp($b['createdAt'] ?? '', $a['createdAt'] ?? '');
});

respond(200, [
    'ok' => true,
    'count' => count($list),
    'users' => $list
]);
