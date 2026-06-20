<?php
require_once __DIR__ . '/users_store.php';
require_once __DIR__ . '/states_store.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

$adminsFile = __DIR__ . '/../storage/admins.json';
$adminsExampleFile = __DIR__ . '/../storage/admins.example.json';
$statesDir = __DIR__ . '/../storage/states';
$intelligenceAllowedEmails = ['fgui3662@gmail.com', 'lorenzo.ritter27@gmail.com'];

function respond_json($status, $data = [])
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function load_json_file($file)
{
    if (!is_file($file)) return null;
    $json = file_get_contents($file);
    $data = json_decode($json, true);
    return is_array($data) ? $data : null;
}

function load_admin_emails($adminsFile, $exampleFile)
{
    $data = load_json_file($adminsFile);
    if (!$data) $data = load_json_file($exampleFile);
    $emails = is_array($data['emails'] ?? null) ? $data['emails'] : [];
    $clean = [];
    foreach ($emails as $email) {
        $safe = trim(strtolower((string)$email));
        if ($safe === '') continue;
        $clean[] = $safe;
    }
    return array_values(array_unique($clean));
}

function sanitize_state_file_user_id($userId)
{
    return preg_replace('/[^a-zA-Z0-9_\-]/', '_', (string)$userId);
}

function is_safe_supabase_user_id($userId)
{
    return preg_match('/^[a-zA-Z0-9._\-]+$/', (string)$userId) === 1;
}

function summarize_campaigns_from_state($state)
{
    $summary = [
        'campaignCount' => 0,
        'activeCampaignCount' => 0,
        'firstCampaignCreatedAt' => null,
        'firstActiveCampaignAt' => null,
        'lastCampaignUpdatedAt' => null,
    ];

    if (!is_array($state)) return $summary;
    $campaigns = $state['campaigns'] ?? null;
    if (!is_array($campaigns)) return $summary;

    $summary['campaignCount'] = count($campaigns);

    foreach ($campaigns as $campaign) {
        if (!is_array($campaign)) continue;

        $createdAt = trim((string)($campaign['createdAt'] ?? ''));
        $updatedAt = trim((string)($campaign['updatedAt'] ?? $createdAt));
        $archived = !empty($campaign['archived']);
        $paused = !empty($campaign['paused']);
        $status = strtolower(trim((string)($campaign['status'] ?? '')));

        if ($createdAt !== '' && ($summary['firstCampaignCreatedAt'] === null || strcmp($createdAt, $summary['firstCampaignCreatedAt']) < 0)) {
            $summary['firstCampaignCreatedAt'] = $createdAt;
        }

        if ($updatedAt !== '' && ($summary['lastCampaignUpdatedAt'] === null || strcmp($updatedAt, $summary['lastCampaignUpdatedAt']) > 0)) {
            $summary['lastCampaignUpdatedAt'] = $updatedAt;
        }

        if ($archived || $paused || $status === 'concluida') {
            continue;
        }

        $summary['activeCampaignCount']++;

        if ($createdAt !== '' && ($summary['firstActiveCampaignAt'] === null || strcmp($createdAt, $summary['firstActiveCampaignAt']) < 0)) {
            $summary['firstActiveCampaignAt'] = $createdAt;
        }
    }

    return $summary;
}

function build_onboarding_snapshot($state, $campaignSummary)
{
    $progress = is_array($state['progress'] ?? null) ? $state['progress'] : [];
    $onboarding = is_array($progress['onboarding'] ?? null) ? $progress['onboarding'] : [];
    $campaignCount = (int)($campaignSummary['campaignCount'] ?? 0);
    $activeCampaignCount = (int)($campaignSummary['activeCampaignCount'] ?? 0);

    $steps = [
        [
            'id' => 'account_created',
            'label' => 'Criou conta',
            'completed' => true,
            'completedAt' => null,
        ],
        [
            'id' => 'first_login',
            'label' => 'Fez primeiro login',
            'completed' => !empty($onboarding['welcomeGranted']) || !empty($onboarding['welcomeAwarded']),
            'completedAt' => $onboarding['welcomeAt'] ?? null,
        ],
        [
            'id' => 'first_campaign_created',
            'label' => 'Criou primeira campanha',
            'completed' => $campaignCount > 0 || !empty($onboarding['firstCampaignCreated']) || !empty($onboarding['hasCampaigns']),
            'completedAt' => $campaignSummary['firstCampaignCreatedAt'] ?? null,
        ],
        [
            'id' => 'first_campaign_activated',
            'label' => 'Ativou primeira campanha',
            'completed' => $activeCampaignCount > 0,
            'completedAt' => $campaignSummary['firstActiveCampaignAt'] ?? null,
        ],
        [
            'id' => 'returned_after_7_days',
            'label' => 'Retornou após 7 dias',
            'completed' => !empty($progress['streak']['lastSeenDate']),
            'completedAt' => $progress['streak']['lastSeenDate'] ?? null,
        ],
    ];

    return [
        'steps' => $steps,
        'raw' => $onboarding,
    ];
}

function extract_state_signals($state, $stateUpdatedAt)
{
    $profile = is_array($state['profile'] ?? null) ? $state['profile'] : [];
    $progress = is_array($state['progress'] ?? null) ? $state['progress'] : [];
    $weekly = is_array($progress['weekly'] ?? null) ? $progress['weekly'] : [];
    $brands = is_array($state['brands'] ?? null) ? $state['brands'] : [];
    $scripts = is_array($state['scripts'] ?? null) ? $state['scripts'] : [];

    return [
        'profile' => [
            'level' => (int)($profile['level'] ?? 1),
            'xp' => (int)($profile['xp'] ?? 0),
            'streak' => (int)($profile['streak'] ?? 0),
        ],
        'activity' => [
            'dailyCompleteDays' => is_array($weekly['dailyCompleteDays'] ?? null) ? array_values($weekly['dailyCompleteDays']) : [],
            'campaignUpdateDays' => is_array($weekly['campaignUpdateDays'] ?? null) ? array_values($weekly['campaignUpdateDays']) : [],
            'lastSeenDate' => $progress['streak']['lastSeenDate'] ?? null,
            'stateUpdatedAt' => $stateUpdatedAt,
        ],
        'counts' => [
            'brands' => count($brands),
            'scripts' => count($scripts),
        ],
    ];
}

function load_state_payload_for_user($userId, $statesDir)
{
    $payload = [
        'state' => null,
        'updatedAt' => null,
        'backend' => 'none',
    ];

    $safeUserId = sanitize_state_file_user_id($userId);
    $stateFile = rtrim($statesDir, '/\\') . DIRECTORY_SEPARATOR . $safeUserId . '.json';
    $filePayload = load_json_file($stateFile);
    $fileState = is_array($filePayload['state'] ?? null) ? $filePayload['state'] : null;
    $fileUpdatedAt = is_array($filePayload) ? ($filePayload['updatedAt'] ?? null) : null;

    if (states_store_backend() === 'supabase' && is_safe_supabase_user_id($userId)) {
        $remote = states_store_load_by_user_id((string)$userId);
        $remoteState = is_array($remote['state'] ?? null) ? $remote['state'] : null;
        $remoteUpdatedAt = is_array($remote) ? ($remote['updatedAt'] ?? null) : null;

        if ($remoteState && $fileState) {
            $remoteScore = count($remoteState['campaigns'] ?? []) + count($remoteState['brands'] ?? []) + count($remoteState['scripts'] ?? []);
            $fileScore = count($fileState['campaigns'] ?? []) + count($fileState['brands'] ?? []) + count($fileState['scripts'] ?? []);
            if ($remoteScore > $fileScore || ($remoteScore === $fileScore && strcmp((string)$remoteUpdatedAt, (string)$fileUpdatedAt) >= 0)) {
                return ['state' => $remoteState, 'updatedAt' => $remoteUpdatedAt, 'backend' => 'supabase'];
            }
        }

        if ($remoteState) {
            return ['state' => $remoteState, 'updatedAt' => $remoteUpdatedAt, 'backend' => 'supabase'];
        }
    }

    if ($fileState) {
        return ['state' => $fileState, 'updatedAt' => $fileUpdatedAt, 'backend' => 'file'];
    }

    return $payload;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    respond_json(405, ['error' => 'Método não permitido']);
}

if (users_store_backend() === 'error') {
    respond_json(500, ['error' => users_store_last_error() ?: 'Banco configurado, mas não está pronto ainda.']);
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    respond_json(400, ['error' => 'JSON inválido']);
}

$token = trim((string)($body['token'] ?? ''));
if (strlen($token) < 10) {
    respond_json(401, ['error' => 'Sessão inválida. Faz login de novo.']);
}

$tokenHash = hash('sha256', $token);
$now = time();
$foundUser = users_store_find_by_session_token_hash($tokenHash);
if (!$foundUser) {
    respond_json(401, ['error' => 'Sessão inválida. Faz login de novo.']);
}

$expires = (int)($foundUser['sessionTokenExpires'] ?? 0);
if ($expires && $expires < $now) {
    respond_json(401, ['error' => 'Sessão expirada. Faz login de novo.']);
}

$adminEmails = load_admin_emails($adminsFile, $adminsExampleFile);
$currentEmail = strtolower(trim((string)($foundUser['email'] ?? '')));
if (
    $currentEmail === '' ||
    !in_array($currentEmail, $adminEmails, true) ||
    !in_array($currentEmail, $intelligenceAllowedEmails, true)
) {
    respond_json(403, ['error' => 'Sem permissão para ver isso.']);
}

$users = users_store_load_all();
$list = [];

foreach ($users as $user) {
    $email = strtolower(trim((string)($user['email'] ?? '')));
    if ($email === '') continue;

    $id = (string)($user['id'] ?? '');
    $statePayload = $id !== '' ? load_state_payload_for_user($id, $statesDir) : ['state' => null, 'updatedAt' => null, 'backend' => 'none'];
    $state = is_array($statePayload['state'] ?? null) ? $statePayload['state'] : null;
    $campaignSummary = summarize_campaigns_from_state($state);
    $onboarding = build_onboarding_snapshot($state, $campaignSummary);
    $signals = extract_state_signals($state, $statePayload['updatedAt'] ?? null);

    $list[] = [
        'id' => $id,
        'name' => (string)($user['name'] ?? ''),
        'email' => $email,
        'createdAt' => (string)($user['createdAt'] ?? ''),
        'accessCount' => (int)($user['accessCount'] ?? 0),
        'timeSpentSeconds' => (int)($user['timeSpentSeconds'] ?? 0),
        'lastAccessAt' => (string)($user['lastAccessAt'] ?? ''),
        'lastLoginAt' => (string)($user['lastLoginAt'] ?? ''),
        'lastSeenAt' => (string)($user['lastSeenAt'] ?? ''),
        'campaignCount' => (int)($campaignSummary['campaignCount'] ?? 0),
        'activeCampaignCount' => (int)($campaignSummary['activeCampaignCount'] ?? 0),
        'stateUpdatedAt' => (string)($statePayload['updatedAt'] ?? ''),
        'stateBackend' => (string)($statePayload['backend'] ?? 'none'),
        'firstCampaignCreatedAt' => $campaignSummary['firstCampaignCreatedAt'],
        'firstActiveCampaignAt' => $campaignSummary['firstActiveCampaignAt'],
        'lastCampaignUpdatedAt' => $campaignSummary['lastCampaignUpdatedAt'],
        'onboarding' => $onboarding,
        'profile' => $signals['profile'],
        'activitySignals' => $signals['activity'],
        'counts' => $signals['counts'],
    ];
}

usort($list, function ($a, $b) {
    return strcmp((string)($b['createdAt'] ?? ''), (string)($a['createdAt'] ?? ''));
});

respond_json(200, [
    'ok' => true,
    'count' => count($list),
    'users' => $list,
    'meta' => [
        'generatedAt' => date('c'),
        'needsGranularActivityLogs' => true,
        'notes' => [
            'Acessos 7d/30d e séries temporais são derivados com fallback no frontend até existir histórico granular por dia/sessão.',
            'Campanhas, onboarding, login e atividade usam dados reais disponíveis hoje.',
        ],
    ],
]);
