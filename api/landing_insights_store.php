<?php

const LANDING_INSIGHTS_STORAGE_FILE = __DIR__ . '/../storage/landing_insights.json';

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

    return [
        'ok' => true,
        'replaced' => $replaced,
        'count' => count($store['events']),
        'updatedAt' => $store['updatedAt'],
    ];
}
