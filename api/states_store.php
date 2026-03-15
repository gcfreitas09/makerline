<?php
// api/states_store.php
// Persistencia do "state" do usuario (campanhas/roteiros/progresso).

require_once __DIR__ . '/supabase_client.php';

const UGC_USER_STATES_TABLE_FALLBACK = 'ugc_user_states';

$GLOBALS['UGC_USER_STATES_STORE_LAST_ERROR'] = null;

function states_store_last_error()
{
    return $GLOBALS['UGC_USER_STATES_STORE_LAST_ERROR'];
}

function states_store_set_error($message)
{
    $GLOBALS['UGC_USER_STATES_STORE_LAST_ERROR'] = (string)$message;
}

function states_store_supabase_table()
{
    $cfg = supabase_config();
    $table = is_array($cfg) ? (string)($cfg['table_states'] ?? '') : '';
    $table = trim($table);
    return $table !== '' ? $table : UGC_USER_STATES_TABLE_FALLBACK;
}

function states_store_supabase_eq($value)
{
    return 'eq.' . (string)$value;
}

function states_store_supabase_ready()
{
    static $checked = false;
    static $ready = false;

    if ($checked) return $ready;
    $checked = true;

    $cfg = supabase_config();
    if (!$cfg || empty($cfg['enabled'])) {
        $ready = false;
        return $ready;
    }

    $table = states_store_supabase_table();
    $res = supabase_client_request('GET', $table, ['select' => 'user_id', 'limit' => 1], null);
    if (is_array($res) && !empty($res['ok'])) {
        $ready = true;
        return $ready;
    }

    $status = (int)($res['status'] ?? 0);
    $err = (string)($res['error'] ?? '');
    if ($status === 404) {
        states_store_set_error('Supabase: falta criar a tabela de states. Roda o SQL em sql/ugc_user_states.supabase.sql.');
    } elseif ($status === 401 || $status === 403) {
        states_store_set_error('Supabase: sem permissao pra acessar a tabela de states. Confere a key no storage/supabase.json.');
    } else {
        states_store_set_error($err ?: 'Falha ao acessar Supabase (states).');
    }

    $ready = false;
    return $ready;
}

function states_store_backend()
{
    $cfg = supabase_config();
    if (is_array($cfg) && !empty($cfg['enabled'])) {
        if (states_store_supabase_ready()) return 'supabase';
        return 'file';
    }
    return 'file';
}

function states_store_load_by_user_id($userId)
{
    $userId = trim((string)$userId);
    if ($userId === '') return null;

    if (states_store_backend() !== 'supabase') {
        return null;
    }

    $table = states_store_supabase_table();
    $res = supabase_client_request(
        'GET',
        $table,
        ['select' => 'state,updated_at', 'user_id' => states_store_supabase_eq($userId), 'limit' => 1],
        null
    );

    if (!is_array($res) || empty($res['ok'])) {
        states_store_set_error((string)($res['error'] ?? 'Falha ao carregar state no Supabase.'));
        return null;
    }

    $rows = is_array($res['data'] ?? null) ? $res['data'] : [];
    if (count($rows) < 1) {
        return ['state' => null, 'updatedAt' => null];
    }

    $row = is_array($rows[0] ?? null) ? $rows[0] : [];
    $rawState = $row['state'] ?? null;

    if (is_string($rawState) && trim($rawState) !== '') {
        $decoded = json_decode($rawState, true);
        if (is_array($decoded)) $rawState = $decoded;
    }

    return [
        'state' => is_array($rawState) ? $rawState : null,
        'updatedAt' => (string)($row['updated_at'] ?? null)
    ];
}

function states_store_upsert_by_user_id($userId, $state, $updatedAt)
{
    $userId = trim((string)$userId);
    if ($userId === '') return false;
    if (!is_array($state)) return false;

    if (states_store_backend() !== 'supabase') {
        return false;
    }

    $table = states_store_supabase_table();
    $payload = [
        'user_id' => $userId,
        'updated_at' => (string)$updatedAt,
        'state' => $state
    ];

    $res = supabase_client_request(
        'POST',
        $table,
        ['on_conflict' => 'user_id'],
        $payload,
        ['Prefer' => 'resolution=merge-duplicates,return=minimal']
    );

    if (!is_array($res) || empty($res['ok'])) {
        states_store_set_error((string)($res['error'] ?? 'Falha ao salvar state no Supabase.'));
        return false;
    }

    return true;
}

function states_store_delete_by_user_id($userId)
{
    $userId = trim((string)$userId);
    if ($userId === '') return false;

    if (states_store_backend() !== 'supabase') {
        return false;
    }

    $table = states_store_supabase_table();
    $res = supabase_client_request('DELETE', $table, ['user_id' => states_store_supabase_eq($userId)], null, ['Prefer' => 'return=minimal']);
    if (!is_array($res) || empty($res['ok'])) {
        states_store_set_error((string)($res['error'] ?? 'Falha ao excluir state no Supabase.'));
        return false;
    }
    return true;
}
