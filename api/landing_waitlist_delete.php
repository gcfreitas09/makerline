<?php
require_once __DIR__ . '/landing_insights_access.php';
require_once __DIR__ . '/waitlist_store.php';

const LANDING_WAITLIST_LEGACY_SNAPSHOT_FILE = __DIR__ . '/../storage/landing_insights_legacy_snapshot.json';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

function landing_waitlist_delete_respond($status, $data = [])
{
    http_response_code((int)$status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function landing_waitlist_delete_decrement(&$row, $field = 'leads')
{
    if (!is_array($row) || !isset($row[$field]) || !is_numeric($row[$field])) return;
    $row[$field] = max(0, (int)$row[$field] - 1);
}

function landing_waitlist_delete_legacy_by_id($leadId)
{
    $file = LANDING_WAITLIST_LEGACY_SNAPSHOT_FILE;
    if (!is_file($file)) {
        return ['ok' => false, 'status' => 404, 'error' => 'Pre-cadastro nao encontrado.'];
    }

    $handle = fopen($file, 'c+');
    if (!$handle) {
        return ['ok' => false, 'status' => 500, 'error' => 'Nao consegui abrir o historico de pre-cadastros.'];
    }

    if (!flock($handle, LOCK_EX)) {
        fclose($handle);
        return ['ok' => false, 'status' => 500, 'error' => 'Nao consegui bloquear o historico para exclusao.'];
    }

    rewind($handle);
    $raw = stream_get_contents($handle);
    $document = json_decode((string)$raw, true);
    if (!is_array($document)) {
        flock($handle, LOCK_UN);
        fclose($handle);
        return ['ok' => false, 'status' => 500, 'error' => 'O historico de pre-cadastros esta invalido.'];
    }

    if (isset($document['snapshots']) && is_array($document['snapshots'])) {
        $snapshots =& $document['snapshots'];
    } elseif (array_keys($document) === range(0, count($document) - 1)) {
        $snapshots =& $document;
    } else {
        $snapshots = [&$document];
    }

    $deleted = null;
    foreach ($snapshots as &$snapshot) {
        if (!is_array($snapshot) || !isset($snapshot['leads']) || !is_array($snapshot['leads'])) continue;

        foreach ($snapshot['leads'] as $index => $lead) {
            if (!is_array($lead) || trim((string)($lead['id'] ?? '')) !== $leadId) continue;

            $deleted = $lead;
            array_splice($snapshot['leads'], $index, 1);

            $remainingLeads = array_values(array_filter($snapshot['leads'], function ($item) {
                return is_array($item) && empty($item['is_test']);
            }));
            if (isset($snapshot['summary']) && is_array($snapshot['summary'])) {
                $snapshot['summary']['pre_registrations'] = count($remainingLeads);
            }

            $referralCode = trim((string)($lead['referral_code'] ?? ''));
            $partnerCode = trim((string)($lead['partner_code'] ?? ''));
            if (isset($snapshot['sources']) && is_array($snapshot['sources'])) {
                foreach ($snapshot['sources'] as &$row) {
                    $matchesReferral = $referralCode !== '' && trim((string)($row['referral_code'] ?? '')) === $referralCode;
                    $matchesPartner = $partnerCode !== '' && trim((string)($row['partner_code'] ?? '')) === $partnerCode;
                    if ($matchesReferral || $matchesPartner) landing_waitlist_delete_decrement($row);
                }
                unset($row);
            }

            $deviceLabel = trim((string)($lead['device_label'] ?? ''));
            if (isset($snapshot['devices']) && is_array($snapshot['devices'])) {
                foreach ($snapshot['devices'] as &$row) {
                    if ($deviceLabel !== '' && strcasecmp(trim((string)($row['label'] ?? '')), $deviceLabel) === 0) {
                        landing_waitlist_delete_decrement($row);
                    }
                }
                unset($row);
            }

            $day = substr(trim((string)($lead['created_at'] ?? '')), 0, 10);
            if (isset($snapshot['series']) && is_array($snapshot['series'])) {
                foreach ($snapshot['series'] as &$row) {
                    if ($day !== '' && trim((string)($row['date'] ?? '')) === $day) {
                        landing_waitlist_delete_decrement($row);
                    }
                }
                unset($row);
            }
            break 2;
        }
    }
    unset($snapshot);

    if (!$deleted) {
        flock($handle, LOCK_UN);
        fclose($handle);
        return ['ok' => false, 'status' => 404, 'error' => 'Pre-cadastro nao encontrado.'];
    }

    $backupDir = dirname($file) . '/backups';
    if (!is_dir($backupDir) && !mkdir($backupDir, 0775, true) && !is_dir($backupDir)) {
        flock($handle, LOCK_UN);
        fclose($handle);
        return ['ok' => false, 'status' => 500, 'error' => 'Nao consegui criar o backup do historico.'];
    }

    $backupFile = $backupDir . '/landing_insights_legacy_snapshot_' . date('Ymd_His') . '.json';
    if (file_put_contents($backupFile, $raw, LOCK_EX) === false) {
        flock($handle, LOCK_UN);
        fclose($handle);
        return ['ok' => false, 'status' => 500, 'error' => 'Nao consegui criar o backup antes da exclusao.'];
    }

    $encoded = json_encode($document, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($encoded === false) {
        flock($handle, LOCK_UN);
        fclose($handle);
        return ['ok' => false, 'status' => 500, 'error' => 'Nao consegui preparar o historico atualizado.'];
    }

    rewind($handle);
    if (!ftruncate($handle, 0) || fwrite($handle, $encoded . PHP_EOL) === false || !fflush($handle)) {
        flock($handle, LOCK_UN);
        fclose($handle);
        return ['ok' => false, 'status' => 500, 'error' => 'Nao consegui salvar a exclusao no historico.'];
    }

    flock($handle, LOCK_UN);
    fclose($handle);

    return [
        'ok' => true,
        'deleted' => $deleted,
        'deletedId' => $leadId,
        'remainingCount' => count($remainingLeads),
        'source' => 'legacy',
    ];
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    landing_waitlist_delete_respond(405, ['ok' => false, 'error' => 'Metodo nao permitido.']);
}

$raw = file_get_contents('php://input');
$body = json_decode((string)$raw, true);
if (!is_array($body)) {
    landing_waitlist_delete_respond(400, ['ok' => false, 'error' => 'JSON invalido.']);
}

$auth = landing_private_authenticate_token($body['token'] ?? '');
if (($auth['ok'] ?? false) !== true) {
    landing_waitlist_delete_respond((int)($auth['status'] ?? 401), [
        'ok' => false,
        'error' => (string)($auth['error'] ?? 'Sessao privada invalida ou expirada.'),
    ]);
}

$leadId = trim((string)($body['leadId'] ?? ''));
if ($leadId === '') {
    landing_waitlist_delete_respond(400, ['ok' => false, 'error' => 'Informe o lead que deve ser excluido.']);
}

$result = waitlist_store_delete_by_id($leadId);
if (($result['ok'] ?? false) !== true && (int)($result['status'] ?? 0) === 404) {
    $result = landing_waitlist_delete_legacy_by_id($leadId);
}
if (($result['ok'] ?? false) !== true) {
    landing_waitlist_delete_respond((int)($result['status'] ?? 500), [
        'ok' => false,
        'error' => (string)($result['error'] ?? 'Nao consegui excluir o pre-cadastro agora.'),
    ]);
}

$deleted = is_array($result['deleted'] ?? null) ? $result['deleted'] : [];
landing_waitlist_delete_respond(200, [
    'ok' => true,
    'deletedId' => (string)($result['deletedId'] ?? $leadId),
    'deletedLead' => [
        'id' => (string)($result['deletedId'] ?? $leadId),
        'name' => (string)($deleted['name'] ?? ''),
        'instagram' => (string)($deleted['instagram'] ?? ''),
    ],
    'remainingCount' => (int)($result['remainingCount'] ?? 0),
    'source' => (string)($result['source'] ?? 'waitlist'),
]);
