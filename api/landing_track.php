<?php
ini_set('display_errors', '0');
error_reporting(0);

require_once __DIR__ . '/landing_insights_store.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

function landing_track_respond($status, $data = [])
{
    http_response_code((int)$status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function landing_track_string($value, $max = 255)
{
    $text = trim((string)$value);
    if ($text === '') return '';
    return mb_substr($text, 0, $max);
}

function landing_track_integer($value, $min = 0, $max = 1000000)
{
    $number = (int)$value;
    if ($number < $min) return $min;
    if ($number > $max) return $max;
    return $number;
}

function landing_track_boolean($value)
{
    if (is_bool($value)) return $value;
    if (is_numeric($value)) return (int)$value === 1;

    $safe = strtolower(trim((string)$value));
    if ($safe === '') return false;
    return in_array($safe, ['1', 'true', 'yes', 'sim', 'on'], true);
}

function landing_track_list($value, $maxItems = 24, $maxLength = 80)
{
    if (!is_array($value)) return [];
    $items = [];
    foreach ($value as $item) {
        $safe = landing_track_string($item, $maxLength);
        if ($safe === '') continue;
        $items[$safe] = true;
        if (count($items) >= $maxItems) break;
    }
    return array_keys($items);
}

function landing_track_pick($body, $keys, $max = 255)
{
    foreach ((array)$keys as $key) {
        if (!is_array($body) || !array_key_exists($key, $body)) continue;
        $safe = landing_track_string($body[$key], $max);
        if ($safe !== '') return $safe;
    }
    return '';
}

function landing_track_pick_int($body, $keys, $min = 0, $max = 1000000)
{
    foreach ((array)$keys as $key) {
        if (!is_array($body) || !array_key_exists($key, $body)) continue;
        return landing_track_integer($body[$key], $min, $max);
    }
    return 0;
}

function landing_track_pick_bool($body, $keys)
{
    foreach ((array)$keys as $key) {
        if (!is_array($body) || !array_key_exists($key, $body)) continue;
        return landing_track_boolean($body[$key]);
    }
    return false;
}

function landing_track_utm($value)
{
    $utm = is_array($value) ? $value : [];
    return [
        'source' => landing_track_pick($utm, ['source', 'utm_source'], 120),
        'medium' => landing_track_pick($utm, ['medium', 'utm_medium'], 120),
        'campaign' => landing_track_pick($utm, ['campaign', 'utm_campaign'], 160),
        'content' => landing_track_pick($utm, ['content', 'utm_content'], 160),
        'term' => landing_track_pick($utm, ['term', 'utm_term'], 160),
    ];
}

function landing_track_hostname($pageUrl)
{
    if ($pageUrl === '') return '';
    try {
        $parts = parse_url($pageUrl);
        return landing_track_string($parts['host'] ?? '', 160);
    } catch (Throwable $error) {
        return '';
    }
}

function landing_track_environment($body, $hostname)
{
    $explicit = strtolower(landing_track_pick($body, ['environment'], 40));
    if ($explicit !== '') return $explicit;

    $safeHost = strtolower(trim((string)$hostname));
    if ($safeHost === '' || $safeHost === 'localhost' || $safeHost === '127.0.0.1') return 'development';
    if (strpos($safeHost, 'staging') !== false || strpos($safeHost, 'dev.') !== false) return 'staging';
    return 'production';
}

function landing_track_device_type($body)
{
    $device = strtolower(landing_track_pick($body, ['device_type', 'deviceType'], 32));
    if (in_array($device, ['mobile', 'desktop', 'tablet'], true)) {
        return $device;
    }
    return '';
}

function landing_track_user_agent()
{
    return landing_track_string($_SERVER['HTTP_USER_AGENT'] ?? '', 500);
}

function landing_track_browser($body, $userAgent)
{
    $explicit = landing_track_pick($body, ['browser'], 80);
    if ($explicit !== '') return $explicit;

    $ua = strtolower($userAgent);
    if ($ua === '') return '';
    if (strpos($ua, 'edg/') !== false) return 'Edge';
    if (strpos($ua, 'opr/') !== false || strpos($ua, 'opera') !== false) return 'Opera';
    if (strpos($ua, 'chrome/') !== false && strpos($ua, 'chromium') === false) return 'Chrome';
    if (strpos($ua, 'firefox/') !== false) return 'Firefox';
    if (strpos($ua, 'safari/') !== false && strpos($ua, 'chrome/') === false) return 'Safari';
    return 'Outro';
}

function landing_track_os($body, $userAgent)
{
    $explicit = landing_track_pick($body, ['os'], 80);
    if ($explicit !== '') return $explicit;

    $ua = strtolower($userAgent);
    if ($ua === '') return '';
    if (strpos($ua, 'windows') !== false) return 'Windows';
    if (strpos($ua, 'android') !== false) return 'Android';
    if (strpos($ua, 'iphone') !== false || strpos($ua, 'ipad') !== false || strpos($ua, 'ios') !== false) return 'iOS';
    if (strpos($ua, 'mac os x') !== false || strpos($ua, 'macintosh') !== false) return 'macOS';
    if (strpos($ua, 'linux') !== false) return 'Linux';
    return 'Outro';
}

function landing_track_is_bot($userAgent)
{
    $ua = strtolower(trim((string)$userAgent));
    if ($ua === '') return false;
    return preg_match('/bot|crawl|spider|preview|facebookexternalhit|slackbot|whatsapp|telegrambot|discordbot|linkedinbot|headless/i', $ua) === 1;
}

function landing_track_channel($utm, $referrerHost, $referralCode)
{
    $source = strtolower(trim((string)($utm['source'] ?? '')));
    $medium = strtolower(trim((string)($utm['medium'] ?? '')));
    $referrer = strtolower(trim((string)$referrerHost));
    $referral = trim((string)$referralCode);

    $haystack = implode(' ', array_filter([$source, $medium, $referrer]));
    if ($referral !== '') return 'Indicacao';
    if ($haystack === '') return 'Direto';
    if (strpos($haystack, 'instagram') !== false || strpos($haystack, 'insta') !== false) return 'Instagram';
    if (strpos($haystack, 'tiktok') !== false || strpos($haystack, 'tt') !== false) return 'TikTok';
    if (strpos($haystack, 'whatsapp') !== false || strpos($haystack, 'wa.me') !== false) return 'WhatsApp';
    if (strpos($haystack, 'google') !== false) return 'Google';
    if (strpos($haystack, 'facebook') !== false || strpos($haystack, 'meta') !== false) return 'Facebook';
    if (strpos($haystack, 'youtube') !== false) return 'YouTube';
    return 'Outro';
}

function landing_track_is_test($body, $hostname, $environment, $pageUrl, $referrer)
{
    if (landing_track_pick_bool($body, ['is_test', 'isTest'])) {
        return true;
    }

    $joined = strtolower(trim($hostname . ' ' . $environment . ' ' . $pageUrl . ' ' . $referrer));
    if ($joined === '') return false;

    return strpos($joined, 'localhost') !== false
        || strpos($joined, '127.0.0.1') !== false
        || strpos($joined, 'file://') !== false
        || strpos($joined, 'staging') !== false
        || strpos($joined, 'development') !== false
        || strpos($joined, 'dev.') !== false;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    landing_track_respond(405, ['ok' => false, 'error' => 'Metodo nao permitido']);
}

$rawBody = file_get_contents('php://input');
$body = json_decode((string)$rawBody, true);
if (!is_array($body)) {
    landing_track_respond(400, ['ok' => false, 'error' => 'JSON invalido']);
}

$eventName = landing_track_pick($body, ['event_name', 'eventType'], 80);
$sessionId = landing_track_pick($body, ['session_id', 'sessionId'], 80);
$visitorId = landing_track_pick($body, ['visitor_id', 'visitorId'], 80);
$pageInstanceId = landing_track_pick($body, ['page_instance_id', 'pageInstanceId'], 80);

if ($eventName === '') {
    landing_track_respond(400, ['ok' => false, 'error' => 'event_name obrigatorio']);
}

if ($sessionId === '' || $visitorId === '') {
    landing_track_respond(400, ['ok' => false, 'error' => 'session_id e visitor_id sao obrigatorios']);
}

$createdAt = landing_track_pick($body, ['created_at', 'eventAt'], 40);
if ($createdAt === '' || strtotime($createdAt) === false) {
    $createdAt = landing_insights_iso_now();
}

$pageUrl = landing_track_pick($body, ['page_url', 'entryUrl'], 500);
$referrer = landing_track_pick($body, ['referrer'], 500);
$referrerHost = landing_track_pick($body, ['referrer_host', 'referrerHost'], 160);
$utm = landing_track_utm($body['utm'] ?? null);
$hostname = landing_track_pick($body, ['hostname'], 160);
if ($hostname === '') {
    $hostname = landing_track_hostname($pageUrl);
}

$environment = landing_track_environment($body, $hostname);
$userAgent = landing_track_user_agent();
$browser = landing_track_browser($body, $userAgent);
$os = landing_track_os($body, $userAgent);
$referralCode = landing_track_pick($body, ['referral_code', 'referralCode'], 80);
$partnerCode = landing_track_pick($body, ['partner_code', 'partnerCode'], 80);
$channel = landing_track_pick($body, ['channel'], 80);
if ($channel === '') {
    $channel = landing_track_channel($utm, $referrerHost, $referralCode);
}

$isBot = landing_track_is_bot($userAgent);
$isTest = landing_track_is_test($body, $hostname, $environment, $pageUrl, $referrer);
$eventId = landing_track_pick($body, ['id', 'eventId'], 120);
if ($eventId === '') {
    $eventId = 'evt_' . substr(hash('sha256', $eventName . '|' . $sessionId . '|' . $createdAt . '|' . microtime(true)), 0, 24);
}

$event = [
    'id' => $eventId,
    'eventId' => $eventId,
    'event_name' => $eventName,
    'eventType' => $eventName,
    'created_at' => $createdAt,
    'eventAt' => $createdAt,
    'visitor_id' => $visitorId,
    'visitorId' => $visitorId,
    'session_id' => $sessionId,
    'sessionId' => $sessionId,
    'page_instance_id' => $pageInstanceId,
    'pageInstanceId' => $pageInstanceId,
    'page' => landing_track_pick($body, ['page'], 80) ?: 'landing',
    'page_url' => $pageUrl,
    'entryUrl' => $pageUrl,
    'page_path' => landing_track_pick($body, ['page_path', 'path'], 255),
    'path' => landing_track_pick($body, ['page_path', 'path'], 255),
    'section_id' => landing_track_pick($body, ['section_id', 'sectionId'], 80),
    'sectionId' => landing_track_pick($body, ['section_id', 'sectionId'], 80),
    'cta_id' => landing_track_pick($body, ['cta_id', 'ctaId'], 80),
    'ctaId' => landing_track_pick($body, ['cta_id', 'ctaId'], 80),
    'cta_label' => landing_track_pick($body, ['cta_label', 'label'], 180),
    'label' => landing_track_pick($body, ['cta_label', 'label'], 180),
    'form_id' => landing_track_pick($body, ['form_id', 'formId'], 80),
    'form_field' => landing_track_pick($body, ['form_field', 'formField'], 80),
    'href' => landing_track_pick($body, ['href'], 500),
    'reason' => landing_track_pick($body, ['reason'], 120),
    'status' => landing_track_pick($body, ['status'], 80),
    'message' => landing_track_pick($body, ['message'], 220),
    'referrer' => $referrer,
    'referrer_host' => $referrerHost,
    'referrerHost' => $referrerHost,
    'referral_code' => $referralCode,
    'referralCode' => $referralCode,
    'partner_code' => $partnerCode,
    'partnerCode' => $partnerCode,
    'channel' => $channel,
    'device_type' => landing_track_device_type($body),
    'deviceType' => landing_track_device_type($body),
    'browser' => $browser,
    'os' => $os,
    'screen_width' => landing_track_pick_int($body, ['screen_width', 'screenWidth', 'viewportWidth'], 0, 10000),
    'screen_height' => landing_track_pick_int($body, ['screen_height', 'screenHeight', 'viewportHeight'], 0, 10000),
    'screenWidth' => landing_track_pick_int($body, ['screen_width', 'screenWidth', 'viewportWidth'], 0, 10000),
    'screenHeight' => landing_track_pick_int($body, ['screen_height', 'screenHeight', 'viewportHeight'], 0, 10000),
    'viewport_width' => landing_track_pick_int($body, ['viewport_width', 'viewportWidth'], 0, 10000),
    'viewport_height' => landing_track_pick_int($body, ['viewport_height', 'viewportHeight'], 0, 10000),
    'viewportWidth' => landing_track_pick_int($body, ['viewport_width', 'viewportWidth'], 0, 10000),
    'viewportHeight' => landing_track_pick_int($body, ['viewport_height', 'viewportHeight'], 0, 10000),
    'scroll_percent' => landing_track_pick_int($body, ['scroll_percent', 'scrollDepth'], 0, 100),
    'scrollDepth' => landing_track_pick_int($body, ['scroll_percent', 'scrollDepth'], 0, 100),
    'time_on_page' => landing_track_pick_int($body, ['time_on_page', 'engagementSeconds'], 0, 86400),
    'engagementSeconds' => landing_track_pick_int($body, ['time_on_page', 'engagementSeconds'], 0, 86400),
    'session_started_at' => landing_track_pick($body, ['session_started_at', 'sessionStartedAt'], 40),
    'sessionStartedAt' => landing_track_pick($body, ['session_started_at', 'sessionStartedAt'], 40),
    'page_loaded_at' => landing_track_pick($body, ['page_loaded_at', 'pageLoadedAt'], 40),
    'pageLoadedAt' => landing_track_pick($body, ['page_loaded_at', 'pageLoadedAt'], 40),
    'last_cta_label' => landing_track_pick($body, ['last_cta_label', 'lastCtaLabel'], 180),
    'lastCtaLabel' => landing_track_pick($body, ['last_cta_label', 'lastCtaLabel'], 180),
    'seen_sections' => landing_track_list($body['seen_sections'] ?? ($body['seenSections'] ?? []), 24, 80),
    'seenSections' => landing_track_list($body['seen_sections'] ?? ($body['seenSections'] ?? []), 24, 80),
    'cta_history' => landing_track_list($body['cta_history'] ?? ($body['ctaHistory'] ?? []), 12, 180),
    'ctaHistory' => landing_track_list($body['cta_history'] ?? ($body['ctaHistory'] ?? []), 12, 180),
    'hostname' => $hostname,
    'environment' => $environment,
    'is_test' => $isTest,
    'isTest' => $isTest,
    'is_bot' => $isBot,
    'utm' => $utm,
    'utm_source' => $utm['source'],
    'utm_medium' => $utm['medium'],
    'utm_campaign' => $utm['campaign'],
    'meta' => [
        'formId' => landing_track_pick($body, ['form_id', 'formId'], 80),
        'formField' => landing_track_pick($body, ['form_field', 'formField'], 80),
        'status' => landing_track_pick($body, ['status'], 80),
        'message' => landing_track_pick($body, ['message'], 220),
        'reason' => landing_track_pick($body, ['reason'], 120),
        'href' => landing_track_pick($body, ['href'], 500),
    ],
];

$result = landing_insights_upsert_event($event);
if (empty($result['ok'])) {
    landing_track_respond(500, ['ok' => false, 'error' => $result['error'] ?? 'Nao consegui salvar o evento']);
}

landing_track_respond(200, [
    'ok' => true,
    'stored' => [
        'event_name' => $event['event_name'],
        'id' => $event['id'],
        'is_test' => $event['is_test'],
    ],
]);
