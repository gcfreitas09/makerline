<?php
ini_set('display_errors', '0');
error_reporting(0);

require_once __DIR__ . '/waitlist_store.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

function waitlist_respond($status, $data = [])
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    waitlist_respond(405, ['ok' => false, 'error' => 'Método não permitido']);
}

if (!waitlist_store_ensure_storage(MAKERLINE_WAITLIST_FILE)) {
    waitlist_respond(500, ['ok' => false, 'error' => 'Não consegui preparar a lista de espera no servidor.']);
}

$rawBody = file_get_contents('php://input');
$body = json_decode((string)$rawBody, true);
if (!is_array($body)) {
    waitlist_respond(400, ['ok' => false, 'error' => 'JSON inválido']);
}

$name = trim((string)($body['name'] ?? ''));
$phone = trim((string)($body['phone'] ?? ''));
$instagramHandle = waitlist_store_normalize_instagram($body['instagram'] ?? '');
$phoneDigits = waitlist_store_normalize_phone($phone);
$tracking = waitlist_store_normalize_tracking($body['tracking'] ?? null) ?: [];

if (mb_strlen($name) < 2) {
    waitlist_respond(400, ['ok' => false, 'error' => 'Informe seu nome completo.']);
}

if ($instagramHandle === '') {
    waitlist_respond(400, ['ok' => false, 'error' => 'Informe seu Instagram para identificar seu pré-cadastro.']);
}

if (!waitlist_store_is_valid_instagram($instagramHandle)) {
    waitlist_respond(400, ['ok' => false, 'error' => 'Informe um Instagram válido.']);
}

if (strlen($phoneDigits) < 10 || strlen($phoneDigits) > 13) {
    waitlist_respond(400, ['ok' => false, 'error' => 'Informe um número de WhatsApp válido com DDD.']);
}

$entries = waitlist_store_load_all();

$now = date('c');
$existingIndex = null;

$existingIndex = waitlist_store_find_existing_index($entries, $instagramHandle, $phoneDigits);
$resolvedPartner = waitlist_store_resolve_partner($tracking['referralCode'] ?? '');

$originLabel = 'Landing direta';
if (($resolvedPartner['partnerName'] ?? '') !== '') {
    $originLabel = 'Indicação / ' . (string)$resolvedPartner['partnerName'];
} elseif (($tracking['utm']['source'] ?? '') !== '') {
    $originLabel = (string)$tracking['utm']['source'];
    if (($tracking['utm']['medium'] ?? '') !== '') {
        $originLabel .= ' / ' . (string)$tracking['utm']['medium'];
    }
} elseif (($tracking['referrerHost'] ?? '') !== '') {
    $originLabel = (string)$tracking['referrerHost'];
}

$record = [
    'name' => $name,
    'phone' => $phone,
    'phoneDigits' => $phoneDigits,
    'instagram' => waitlist_store_format_instagram($instagramHandle),
    'instagramHandle' => $instagramHandle,
    'instagramUsername' => $instagramHandle,
    'instagramUrl' => waitlist_store_instagram_url($instagramHandle),
    'leadStatus' => waitlist_store_normalize_lead_status($body['leadStatus'] ?? ''),
    'isTest' => waitlist_store_boolean($tracking['isTest'] ?? false),
    'dataSource' => 'novo_tracker',
    'source' => 'landing',
    'originType' => 'landing',
    'originLabel' => $originLabel,
    'referralCode' => (string)($resolvedPartner['referralCode'] ?? '') ?: null,
    'partnerCode' => (string)($resolvedPartner['partnerCode'] ?? '') ?: null,
    'partnerName' => (string)($resolvedPartner['partnerName'] ?? '') ?: null,
    'partnerInstagram' => (string)($resolvedPartner['partnerInstagram'] ?? '') ?: null,
    'partnerInstagramUrl' => (string)($resolvedPartner['partnerInstagramUrl'] ?? '') ?: null,
    'partnerTrialDays' => (int)($resolvedPartner['trialDays'] ?? 0) ?: null,
    'status' => 'pending_launch',
    'launchNotificationChannel' => 'whatsapp',
    'launchNotificationStatus' => 'pending',
    'updatedAt' => $now,
    'lastCapturedAt' => $now,
    'signupCount' => 1,
    'visitorId' => (string)($tracking['visitorId'] ?? ''),
    'sessionId' => (string)($tracking['sessionId'] ?? ''),
    'channel' => (string)($tracking['channel'] ?? ''),
    'deviceType' => (string)($tracking['deviceType'] ?? ''),
    'browser' => (string)($tracking['browser'] ?? ''),
    'os' => (string)($tracking['os'] ?? ''),
    'hostname' => (string)($tracking['hostname'] ?? ''),
    'environment' => (string)($tracking['environment'] ?? ''),
    'referrerHost' => (string)($tracking['referrerHost'] ?? ''),
    'referrer' => (string)($tracking['referrer'] ?? ''),
    'utmSource' => (string)($tracking['utm']['source'] ?? ''),
    'utmMedium' => (string)($tracking['utm']['medium'] ?? ''),
    'utmCampaign' => (string)($tracking['utm']['campaign'] ?? ''),
    'utmContent' => (string)($tracking['utm']['content'] ?? ''),
    'utmTerm' => (string)($tracking['utm']['term'] ?? ''),
    'lastCtaId' => (string)($tracking['lastCtaId'] ?? ''),
    'lastCtaLabel' => (string)($tracking['lastCtaLabel'] ?? ''),
    'lastSectionId' => (string)($tracking['lastSectionId'] ?? ''),
    'screenWidth' => (int)($tracking['screenWidth'] ?? 0),
    'screenHeight' => (int)($tracking['screenHeight'] ?? 0),
    'viewportWidth' => (int)($tracking['viewportWidth'] ?? 0),
    'viewportHeight' => (int)($tracking['viewportHeight'] ?? 0),
    'engagementSeconds' => (int)($tracking['engagementSeconds'] ?? 0),
    'maxScrollDepth' => (int)($tracking['maxScrollDepth'] ?? 0),
    'seenSections' => is_array($tracking['seenSections'] ?? null) ? $tracking['seenSections'] : [],
    'trackingFirst' => $tracking,
    'trackingLast' => $tracking,
];

$alreadyExists = $existingIndex !== null;
if ($alreadyExists) {
    $existingEntry = is_array($entries[$existingIndex]) ? $entries[$existingIndex] : [];
    $existingTrackingFirst = is_array($existingEntry['trackingFirst'] ?? null) ? $existingEntry['trackingFirst'] : null;
    $existingTrackingLast = is_array($existingEntry['trackingLast'] ?? null) ? $existingEntry['trackingLast'] : null;

    $record['createdAt'] = (string)($existingEntry['createdAt'] ?? $now);
    $record['firstCapturedAt'] = (string)($existingEntry['firstCapturedAt'] ?? $record['createdAt']);
    $record['lastCapturedAt'] = $now;
    $record['signupCount'] = max(1, (int)($existingEntry['signupCount'] ?? 1)) + 1;
    $record['trackingFirst'] = $existingTrackingFirst ?: $tracking;
    $record['trackingLast'] = $tracking ?: $existingTrackingLast;

    if (($record['visitorId'] ?? '') === '') {
        $record['visitorId'] = (string)($existingEntry['visitorId'] ?? '');
    }
    if (($record['sessionId'] ?? '') === '') {
        $record['sessionId'] = (string)($existingEntry['sessionId'] ?? '');
    }
    if (($record['deviceType'] ?? '') === '') {
        $record['deviceType'] = (string)($existingEntry['deviceType'] ?? '');
    }
    if (($record['channel'] ?? '') === '') {
        $record['channel'] = (string)($existingEntry['channel'] ?? '');
    }
    if (($record['browser'] ?? '') === '') {
        $record['browser'] = (string)($existingEntry['browser'] ?? '');
    }
    if (($record['os'] ?? '') === '') {
        $record['os'] = (string)($existingEntry['os'] ?? '');
    }
    if (($record['hostname'] ?? '') === '') {
        $record['hostname'] = (string)($existingEntry['hostname'] ?? '');
    }
    if (($record['environment'] ?? '') === '') {
        $record['environment'] = (string)($existingEntry['environment'] ?? '');
    }
    if (($record['referrerHost'] ?? '') === '') {
        $record['referrerHost'] = (string)($existingEntry['referrerHost'] ?? '');
    }
    if (($record['referrer'] ?? '') === '') {
        $record['referrer'] = (string)($existingEntry['referrer'] ?? '');
    }
    if (($record['utmSource'] ?? '') === '') {
        $record['utmSource'] = (string)($existingEntry['utmSource'] ?? '');
    }
    if (($record['utmMedium'] ?? '') === '') {
        $record['utmMedium'] = (string)($existingEntry['utmMedium'] ?? '');
    }
    if (($record['utmCampaign'] ?? '') === '') {
        $record['utmCampaign'] = (string)($existingEntry['utmCampaign'] ?? '');
    }
    if (($record['utmContent'] ?? '') === '') {
        $record['utmContent'] = (string)($existingEntry['utmContent'] ?? '');
    }
    if (($record['utmTerm'] ?? '') === '') {
        $record['utmTerm'] = (string)($existingEntry['utmTerm'] ?? '');
    }
    if (($record['lastCtaId'] ?? '') === '') {
        $record['lastCtaId'] = (string)($existingEntry['lastCtaId'] ?? '');
    }
    if (($record['lastCtaLabel'] ?? '') === '') {
        $record['lastCtaLabel'] = (string)($existingEntry['lastCtaLabel'] ?? '');
    }
    if (($record['lastSectionId'] ?? '') === '') {
        $record['lastSectionId'] = (string)($existingEntry['lastSectionId'] ?? '');
    }
    if ((int)($record['screenWidth'] ?? 0) <= 0) {
        $record['screenWidth'] = (int)($existingEntry['screenWidth'] ?? 0);
    }
    if ((int)($record['screenHeight'] ?? 0) <= 0) {
        $record['screenHeight'] = (int)($existingEntry['screenHeight'] ?? 0);
    }
    if ((int)($record['viewportWidth'] ?? 0) <= 0) {
        $record['viewportWidth'] = (int)($existingEntry['viewportWidth'] ?? 0);
    }
    if ((int)($record['viewportHeight'] ?? 0) <= 0) {
        $record['viewportHeight'] = (int)($existingEntry['viewportHeight'] ?? 0);
    }
    if (($record['instagramHandle'] ?? '') === '' && trim((string)($existingEntry['instagramHandle'] ?? '')) !== '') {
        $record['instagramHandle'] = (string)$existingEntry['instagramHandle'];
    }
    if (($record['instagramUsername'] ?? '') === '' && trim((string)($existingEntry['instagramUsername'] ?? '')) !== '') {
        $record['instagramUsername'] = (string)$existingEntry['instagramUsername'];
    }
    if (($record['instagram'] ?? '') === '' && trim((string)($existingEntry['instagram'] ?? '')) !== '') {
        $record['instagram'] = (string)$existingEntry['instagram'];
    }
    if (($record['instagramUrl'] ?? '') === '' && trim((string)($existingEntry['instagramUrl'] ?? '')) !== '') {
        $record['instagramUrl'] = (string)$existingEntry['instagramUrl'];
    }
    if ((int)($record['engagementSeconds'] ?? 0) <= 0) {
        $record['engagementSeconds'] = (int)($existingEntry['engagementSeconds'] ?? 0);
    }
    if ((int)($record['maxScrollDepth'] ?? 0) <= 0) {
        $record['maxScrollDepth'] = (int)($existingEntry['maxScrollDepth'] ?? 0);
    }
    if (!(is_array($tracking['seenSections'] ?? null) && $tracking['seenSections'])) {
        $record['seenSections'] = is_array($existingEntry['seenSections'] ?? null) ? $existingEntry['seenSections'] : [];
    }
    if (($record['leadStatus'] ?? '') === MAKERLINE_LEAD_STATUS_DEFAULT && trim((string)($existingEntry['leadStatus'] ?? '')) !== '') {
        $record['leadStatus'] = waitlist_store_normalize_lead_status($existingEntry['leadStatus']);
    }
    if (!waitlist_store_boolean($record['isTest'] ?? false) && waitlist_store_boolean($existingEntry['isTest'] ?? false)) {
        $record['isTest'] = true;
    }

    $record['id'] = waitlist_store_entry_id($existingEntry, $existingIndex);
    $record = array_merge($existingEntry, $record);
} else {
    $record['createdAt'] = $now;
    $record['firstCapturedAt'] = $now;
    $record['id'] = waitlist_store_entry_id($record, count($entries));
}

if (!waitlist_store_save_entry($record)) {
    waitlist_respond(500, [
        'ok' => false,
        'error' => waitlist_store_last_error() ?: 'Não consegui salvar sua inscrição agora.',
    ]);
}

$message = $alreadyExists
    ? 'Seu pré-cadastro já estava na lista. Atualizamos seus dados e vamos avisar no WhatsApp quando o Makerline liberar.'
    : 'Pronto. Seu pré-cadastro foi registrado e vamos avisar no WhatsApp quando o Makerline liberar.';

waitlist_respond(200, [
    'ok' => true,
    'alreadyExists' => $alreadyExists,
    'message' => $message,
    'partner' => ($resolvedPartner['referralCode'] ?? '') !== ''
        ? [
            'referralCode' => (string)$resolvedPartner['referralCode'],
            'partnerCode' => (string)($resolvedPartner['partnerCode'] ?? ''),
            'partnerName' => (string)($resolvedPartner['partnerName'] ?? ''),
            'partnerInstagram' => (string)($resolvedPartner['partnerInstagram'] ?? ''),
            'partnerInstagramUrl' => (string)($resolvedPartner['partnerInstagramUrl'] ?? ''),
            'partnerTrialDays' => (int)($resolvedPartner['trialDays'] ?? 0),
        ]
        : null,
]);
