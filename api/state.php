<?php
// api/state.php
require_once __DIR__ . '/users_store.php';
require_once __DIR__ . '/states_store.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

$statesDir = __DIR__ . '/../storage/states';
if (!is_dir($statesDir)) {
    @mkdir($statesDir, 0775, true);
}

function respond($status, $data = [])
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function ensureDir($dir)
{
    if (is_dir($dir)) return true;
    @mkdir($dir, 0775, true);
    return is_dir($dir);
}

function safeUserIdForFile($userId)
{
    $raw = (string)($userId ?? '');
    $safe = preg_replace('/[^a-zA-Z0-9_-]/', '_', $raw);
    if ($safe === '' || $safe === null) {
        $safe = 'user_' . hash('sha256', $raw);
    }
    return $safe;
}

function stateBackupsDir($statesDir)
{
    return rtrim((string)$statesDir, '/\\') . DIRECTORY_SEPARATOR . 'backups';
}

function listStateBackups($backupDir, $safeUserId)
{
    if (!is_dir($backupDir)) return [];
    $pattern = $backupDir . DIRECTORY_SEPARATOR . $safeUserId . '_*.json';
    $files = glob($pattern) ?: [];
    usort($files, function ($a, $b) {
        return (int)@filemtime($b) <=> (int)@filemtime($a);
    });
    return $files;
}

function restoreLatestStateBackup($statesDir, $safeUserId, $stateFile)
{
    $backupDir = stateBackupsDir($statesDir);
    $files = listStateBackups($backupDir, $safeUserId);
    if (!$files) return false;

    $latest = $files[0] ?? null;
    if (!$latest || !is_file($latest)) return false;

    return @copy($latest, $stateFile);
}

function state_data_score($state)
{
    if (!is_array($state)) return 0;
    $score = 0;
    $score += is_array($state['brands'] ?? null) ? count($state['brands']) * 10 : 0;
    $score += is_array($state['campaigns'] ?? null) ? count($state['campaigns']) * 10 : 0;
    $score += is_array($state['scripts'] ?? null) ? count($state['scripts']) : 0;
    $score += is_array($state['prospections'] ?? null) ? count($state['prospections']) : 0;
    return $score;
}

function read_state_payload_file($stateFile)
{
    if (!is_file($stateFile)) return null;
    $payload = json_decode((string)file_get_contents($stateFile), true);
    return is_array($payload) ? $payload : null;
}

function state_payload_from_file($stateFile)
{
    $payload = read_state_payload_file($stateFile);
    $state = is_array($payload) && is_array($payload['state'] ?? null) ? $payload['state'] : null;
    if (!is_array($state)) return null;
    return [
        'state' => $state,
        'updatedAt' => $payload['updatedAt'] ?? null,
        'backend' => 'file',
        'score' => state_data_score($state)
    ];
}

function choose_best_state_payload($remotePayload, $filePayload)
{
    $candidates = [];
    if (is_array($remotePayload) && is_array($remotePayload['state'] ?? null)) {
        $remotePayload['backend'] = $remotePayload['backend'] ?? 'supabase';
        $remotePayload['score'] = state_data_score($remotePayload['state']);
        $candidates[] = $remotePayload;
    }
    if (is_array($filePayload) && is_array($filePayload['state'] ?? null)) {
        $filePayload['score'] = $filePayload['score'] ?? state_data_score($filePayload['state']);
        $candidates[] = $filePayload;
    }
    if (!$candidates) return null;

    usort($candidates, function ($a, $b) {
        $scoreDiff = (int)($b['score'] ?? 0) <=> (int)($a['score'] ?? 0);
        if ($scoreDiff !== 0) return $scoreDiff;
        $timeA = strtotime((string)($a['updatedAt'] ?? '')) ?: 0;
        $timeB = strtotime((string)($b['updatedAt'] ?? '')) ?: 0;
        return $timeB <=> $timeA;
    });

    return $candidates[0];
}

function backupStateFile($statesDir, $safeUserId, $stateFile)
{
    if (!file_exists($stateFile)) return true;

    $backupDir = stateBackupsDir($statesDir);
    if (!ensureDir($backupDir)) return true;

    // Evita backup a cada sync (o front salva bem frequente). Faz no máx 1 por hora por usuário.
    $existing = listStateBackups($backupDir, $safeUserId);
    $latestMtime = $existing ? (int)@filemtime($existing[0]) : 0;
    if ($latestMtime && (time() - $latestMtime) < 3600) {
        return true;
    }

    $timestamp = date('Ymd_His');
    $backupFile = $backupDir . DIRECTORY_SEPARATOR . "{$safeUserId}_{$timestamp}.json";
    @copy($stateFile, $backupFile);

    // Mantém só os 30 backups mais recentes por usuário.
    $existing = listStateBackups($backupDir, $safeUserId);
    if (count($existing) > 30) {
        $sortedAsc = $existing;
        usort($sortedAsc, function ($a, $b) {
            return (int)@filemtime($a) <=> (int)@filemtime($b);
        });
        $toDelete = array_slice($sortedAsc, 0, count($sortedAsc) - 30);
        foreach ($toDelete as $path) {
            @unlink($path);
        }
    }

    return true;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    respond(405, ['error' => 'Método não permitido']);
}

if (users_store_backend() === 'error') {
    respond(500, ['error' => users_store_last_error() ?: 'Banco configurado, mas não está pronto ainda.']);
}

$rawBody = file_get_contents('php://input');
$body = json_decode($rawBody, true);
if (!is_array($body)) {
    respond(400, ['error' => 'JSON inválido']);
}

$action = (string)($body['action'] ?? '');
$token = trim((string)($body['token'] ?? ''));

if (strlen($token) < 10) {
    respond(401, ['error' => 'Sessão inválida. Faz login de novo.']);
}

$tokenHash = hash('sha256', $token);
$now = time();
$user = users_store_find_by_session_token_hash($tokenHash);
if (!$user) {
    respond(401, ['error' => 'Sessão inválida. Faz login de novo.']);
}

$expires = (int)($user['sessionTokenExpires'] ?? 0);
if ($expires && $expires < $now) {
    respond(401, ['error' => 'Sessão expirada. Faz login de novo.']);
}

$userId = (string)($user['id'] ?? '');
if ($userId === '') {
    respond(500, ['error' => 'Conta incompleta. Faz login de novo.']);
}

$safeUserId = safeUserIdForFile($userId);
$stateFile = $statesDir . '/' . $safeUserId . '.json';

if ($action === 'load') {
    $newAccessCount = (int)($user['accessCount'] ?? 0) + 1;
    $ok = users_store_update_by_id($userId, [
        'accessCount' => $newAccessCount,
        'lastAccessAt' => date('c'),
        'lastSeenAt' => date('c')
    ]);

    if (!$ok) {
        respond(500, ['error' => users_store_last_error() ?: 'Não consegui atualizar o usuário agora.']);
    }

    $warning = null;
    $remotePayload = null;
    $stateBackend = states_store_backend();
    if ($stateBackend === 'supabase') {
        $remote = states_store_load_by_user_id($userId);
        if (is_array($remote) && is_array($remote['state'] ?? null)) {
            $remotePayload = [
                'state' => $remote['state'],
                'updatedAt' => $remote['updatedAt'] ?? null,
                'backend' => 'supabase'
            ];
        }
        if ($remote === null) {
            $warning = states_store_last_error() ?: 'Falha ao carregar state no Supabase.';
        }
    } else {
        $warning = states_store_last_error() ?: null;
    }

    if ($remotePayload) {
        $filePayload = state_payload_from_file($stateFile);
        $best = choose_best_state_payload($remotePayload, $filePayload);

        // Se o fallback local venceu, repara o Supabase automaticamente. Assim
        // o proximo acesso (inclusive pelo admin) nao volta a enxergar a copia
        // remota incompleta.
        if (($best['backend'] ?? '') === 'file') {
            $repairUpdatedAt = (string)($best['updatedAt'] ?? date('c'));
            if (states_store_upsert_by_user_id($userId, $best['state'], $repairUpdatedAt)) {
                $best['backend'] = 'supabase';
            } else {
                $warning = states_store_last_error() ?: 'Falha ao reparar o state no Supabase.';
            }
        }

        respond(200, [
            'ok' => true,
            'state' => $best['state'],
            'updatedAt' => $best['updatedAt'] ?? null,
            'backend' => $best['backend'] ?? 'supabase',
            'warning' => $warning
        ]);
    }

    if (!file_exists($stateFile)) {
        // Tentativa de recuperação (se o state sumiu por deploy/FTP, mas ainda existem backups).
        if (!restoreLatestStateBackup($statesDir, $safeUserId, $stateFile)) {
            respond(200, ['ok' => true, 'state' => null, 'updatedAt' => null, 'backend' => 'file', 'warning' => $warning]);
        }
    }

    $json = file_get_contents($stateFile);
    $payload = json_decode($json, true);
    if (!is_array($payload)) {
        // Se o arquivo corrompeu/truncou, tenta restaurar do último backup.
        if (restoreLatestStateBackup($statesDir, $safeUserId, $stateFile)) {
            $json = file_get_contents($stateFile);
            $payload = json_decode($json, true);
        }

        if (!is_array($payload)) {
            respond(200, ['ok' => true, 'state' => null, 'updatedAt' => null, 'backend' => 'file', 'warning' => $warning]);
        }
    }

    // Migração suave: se o state existe no arquivo, sobe pro Supabase na primeira chance.
    if ($stateBackend === 'supabase' && is_array($payload['state'] ?? null)) {
        $fileUpdatedAt = (string)($payload['updatedAt'] ?? date('c'));
        states_store_upsert_by_user_id($userId, $payload['state'], $fileUpdatedAt);
    }

    respond(200, [
        'ok' => true,
        'state' => is_array($payload['state'] ?? null) ? $payload['state'] : null,
        'updatedAt' => $payload['updatedAt'] ?? null,
        'backend' => 'file',
        'warning' => $warning
    ]);
}

if ($action === 'save') {
    $state = $body['state'] ?? null;
    if (!is_array($state)) {
        respond(400, ['error' => 'State inválido']);
    }

    $incomingScore = state_data_score($state);
    $existingRemote = null;
    if (states_store_backend() === 'supabase') {
        $existingRemote = states_store_load_by_user_id($userId);
    }
    $existingBest = choose_best_state_payload($existingRemote, state_payload_from_file($stateFile));
    $existingScore = is_array($existingBest) ? (int)($existingBest['score'] ?? 0) : 0;
    if ($incomingScore === 0 && $existingScore > 0) {
        respond(200, [
            'ok' => true,
            'skipped' => true,
            'reason' => 'empty_state_protected',
            'updatedAt' => $existingBest['updatedAt'] ?? null,
            'backend' => $existingBest['backend'] ?? 'file',
            'warning' => 'Estado vazio ignorado para preservar marcas e campanhas existentes.'
        ]);
    }

    $bytes = strlen(json_encode($state, JSON_UNESCAPED_UNICODE));
    if ($bytes > 1024 * 1024) {
        respond(413, ['error' => 'State muito grande (limite: 1MB).']);
    }

    $updatedAt = date('c');
    $savedBackend = 'file';
    $warning = null;

    // Prioriza Supabase (se estiver pronto). Se der ruim, cai pro arquivo local pra não perder nada.
    if (states_store_backend() === 'supabase') {
        $okSupabase = states_store_upsert_by_user_id($userId, $state, $updatedAt);
        if ($okSupabase) {
            $savedBackend = 'supabase';
        } else {
            $warning = states_store_last_error() ?: 'Falha ao salvar no Supabase. Salvei localmente como backup.';
        }
    }

    if ($savedBackend === 'file') {
        $payload = [
            'userId' => $userId,
            'updatedAt' => $updatedAt,
            'state' => $state
        ];

        // Backup do state anterior (pra evitar perder tudo por overwrite/bug/deploy).
        backupStateFile($statesDir, $safeUserId, $stateFile);

        $ok = @file_put_contents(
            $stateFile,
            json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
            LOCK_EX
        );

        if ($ok === false) {
            respond(500, ['error' => 'Não consegui salvar agora.']);
        }
    }

    $okUser = users_store_update_by_id($userId, [
        'lastSeenAt' => date('c')
    ]);

    if (!$okUser) {
        respond(500, ['error' => users_store_last_error() ?: 'Não consegui atualizar o usuário agora.']);
    }

    respond(200, [
        'ok' => true,
        'updatedAt' => $updatedAt,
        'bytes' => $bytes,
        'backend' => $savedBackend,
        'warning' => $warning
    ]);
}

respond(400, ['error' => 'Ação inválida']);
