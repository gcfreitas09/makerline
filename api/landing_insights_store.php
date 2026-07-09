<?php

require_once __DIR__ . '/supabase_client.php';

const LANDING_INSIGHTS_STORAGE_FILE = __DIR__ . '/../storage/landing_insights.json';
const LANDING_INSIGHTS_REMOTE_PAGE_SIZE = 1000;

$GLOBALS['LANDING_INSIGHTS_REMOTE_LAST_ERROR'] = null;

function landing_insights_remote_last_error()
{
    return $GLOBALS['LANDING_INSIGHTS_REMOTE_LAST_ERROR'];
}

function landing_insights_remote_set_error($message)
{
    $GLOBALS['LANDING_INSIGHTS_REMOTE_LAST_ERROR'] = trim((string)$message);
}

function landing_insights_remote_table()
{
    if (!function_exists('supabase_config')) return '';
    $config = supabase_config();
    if (!$config || empty($config['enabled'])) return '';

    $table = trim((string)($config['table_landing_insights'] ?? ''));
    return $table !== '' ? $table : 'landing_insights_events';
}

function landing_insights_remote_event_id($event)
{
    $id = trim((string)($event['id'] ?? ($event['eventId'] ?? '')));
    if ($id !== '') return $id;

    $seed = implode('|', [
        (string)($event['event_name'] ?? ($event['eventType'] ?? '')),
        (string)($event['created_at'] ?? ($event['eventAt'] ?? '')),
        (string)($event['session_id'] ?? ($event['sessionId'] ?? '')),
        microtime(true),
    ]);
    return 'evt_' . substr(hash('sha256', $seed), 0, 24);
}

function landing_insights_remote_is_test($event)
{
    $value = $event['is_test'] ?? ($event['isTest'] ?? false);
    if (is_bool($value)) return $value;
    if (is_numeric($value)) return (int)$value === 1;
    $safe = strtolower(trim((string)$value));
    return in_array($safe, ['1', 'true', 'yes', 'sim', 'on'], true);
}

function landing_insights_remote_payload($event)
{
    $id = landing_insights_remote_event_id($event);
    $event['id'] = $id;

    return [
        'id' => $id,
        'event_name' => trim((string)($event['event_name'] ?? ($event['eventType'] ?? ''))),
        'visitor_id' => trim((string)($event['visitor_id'] ?? ($event['visitorId'] ?? ''))) ?: null,
        'session_id' => trim((string)($event['session_id'] ?? ($event['sessionId'] ?? ''))) ?: null,
        'is_test' => landing_insights_remote_is_test($event),
        'created_at' => trim((string)($event['created_at'] ?? ($event['eventAt'] ?? ''))) ?: date('c'),
        'payload' => $event,
    ];
}

function landing_insights_remote_upsert_event($event)
{
    $table = landing_insights_remote_table();
    if ($table === '') return true;
    if (!function_exists('supabase_client_request')) return true;

    $payload = landing_insights_remote_payload($event);
    $response = supabase_client_request(
        'POST',
        $table,
        ['on_conflict' => 'id'],
        $payload,
        ['Prefer' => 'resolution=merge-duplicates,return=minimal']
    );

    if (($response['ok'] ?? false) === true) {
        return true;
    }

    landing_insights_remote_set_error((string)($response['error'] ?? 'Nao consegui sincronizar o evento no Supabase.'));
    return false;
}

function landing_insights_remote_row_to_event($row)
{
    if (!is_array($row)) return null;
    $payload = is_array($row['payload'] ?? null) ? $row['payload'] : [];

    $payload['id'] = (string)($row['id'] ?? ($payload['id'] ?? ''));
    $payload['event_name'] = (string)($row['event_name'] ?? ($payload['event_name'] ?? ''));
    $payload['created_at'] = (string)($row['created_at'] ?? ($payload['created_at'] ?? ''));
    $payload['visitor_id'] = (string)($row['visitor_id'] ?? ($payload['visitor_id'] ?? ''));
    $payload['session_id'] = (string)($row['session_id'] ?? ($payload['session_id'] ?? ''));
    $payload['is_test'] = (bool)($row['is_test'] ?? ($payload['is_test'] ?? false));

    return $payload;
}

function landing_insights_remote_load_all()
{
    $table = landing_insights_remote_table();
    if ($table === '') return null;
    if (!function_exists('supabase_client_request')) return null;

    $events = [];
    $offset = 0;
    $pageSize = LANDING_INSIGHTS_REMOTE_PAGE_SIZE;

    while (true) {
        $response = supabase_client_request(
            'GET',
            $table,
            [
                'select' => '*',
                'order' => 'created_at.asc',
                'limit' => (string)$pageSize,
                'offset' => (string)$offset,
            ],
            null
        );

        if (($response['ok'] ?? false) !== true) {
            landing_insights_remote_set_error((string)($response['error'] ?? 'Nao consegui carregar os eventos do Supabase.'));
            return $offset === 0 ? null : $events;
        }

        $rows = is_array($response['data'] ?? null) ? $response['data'] : [];
        foreach ($rows as $row) {
            $event = landing_insights_remote_row_to_event($row);
            if ($event) $events[] = $event;
        }

        if (count($rows) < $pageSize) break;
        $offset += $pageSize;
    }

    return $events;
}

function landing_insights_iso_now()
{
    return date('c');
}

function landing_insights_default_store()
{
    return [
        'updatedAt' => null,
        'events' => [],
    ];
}

function landing_insights_ensure_storage_file($file = LANDING_INSIGHTS_STORAGE_FILE)
{
    if (is_file($file)) {
        return true;
    }

    $dir = dirname($file);
    if (!is_dir($dir) && !@mkdir($dir, 0777, true) && !is_dir($dir)) {
        return false;
    }

    $created = @file_put_contents(
        $file,
        json_encode(landing_insights_default_store(), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
        LOCK_EX
    );

    return $created !== false;
}

function landing_insights_decode_store($raw)
{
    $decoded = json_decode((string)$raw, true);
    if (!is_array($decoded)) {
        return landing_insights_default_store();
    }

    $events = is_array($decoded['events'] ?? null) ? array_values($decoded['events']) : [];

    return [
        'updatedAt' => (string)($decoded['updatedAt'] ?? ''),
        'events' => $events,
    ];
}

function landing_insights_load_store($file = LANDING_INSIGHTS_STORAGE_FILE)
{
    $remoteEvents = landing_insights_remote_load_all();
    if (is_array($remoteEvents)) {
        return [
            'updatedAt' => landing_insights_iso_now(),
            'events' => $remoteEvents,
        ];
    }

    if (!landing_insights_ensure_storage_file($file)) {
        return landing_insights_default_store();
    }

    $raw = @file_get_contents($file);
    if ($raw === false) {
        return landing_insights_default_store();
    }

    return landing_insights_decode_store($raw);
}

function landing_insights_save_store($store, $file = LANDING_INSIGHTS_STORAGE_FILE)
{
    if (!landing_insights_ensure_storage_file($file)) {
        return false;
    }

    $store['updatedAt'] = landing_insights_iso_now();
    $json = json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($json)) {
        return false;
    }

    return @file_put_contents($file, $json, LOCK_EX) !== false;
}

function landing_insights_upsert_event($event, $file = LANDING_INSIGHTS_STORAGE_FILE)
{
    if (!landing_insights_ensure_storage_file($file)) {
        return ['ok' => false, 'error' => 'Nao consegui preparar o arquivo de insights.'];
    }

    $fp = @fopen($file, 'c+');
    if (!$fp) {
        return ['ok' => false, 'error' => 'Nao consegui abrir o arquivo de insights.'];
    }

    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        return ['ok' => false, 'error' => 'Nao consegui bloquear o arquivo de insights.'];
    }

    $raw = stream_get_contents($fp);
    $store = landing_insights_decode_store($raw ?: '');
    $events = is_array($store['events']) ? $store['events'] : [];

    $eventId = trim((string)($event['id'] ?? ($event['eventId'] ?? '')));
    $replaced = false;

    if ($eventId !== '') {
        foreach ($events as $index => $existing) {
            if (!is_array($existing)) {
                continue;
            }
            $existingId = trim((string)($existing['id'] ?? ($existing['eventId'] ?? '')));
            if ($existingId !== $eventId) {
                continue;
            }
            $events[$index] = $event;
            $replaced = true;
            break;
        }
    }

    if (!$replaced) {
        $events[] = $event;
    }

    $store['events'] = array_values($events);
    $store['updatedAt'] = landing_insights_iso_now();

    $json = json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($json)) {
        flock($fp, LOCK_UN);
        fclose($fp);
        return ['ok' => false, 'error' => 'Nao consegui serializar os insights.'];
    }

    rewind($fp);
    ftruncate($fp, 0);
    $saved = fwrite($fp, $json);
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);

    if ($saved === false) {
        return ['ok' => false, 'error' => 'Nao consegui salvar os insights.'];
    }

    $remoteOk = landing_insights_remote_upsert_event($event);

    return [
        'ok' => true,
        'replaced' => $replaced,
        'count' => count($store['events']),
        'updatedAt' => $store['updatedAt'],
        'remoteOk' => $remoteOk,
        'remoteError' => $remoteOk ? null : landing_insights_remote_last_error(),
    ];
}
