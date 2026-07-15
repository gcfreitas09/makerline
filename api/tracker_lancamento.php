<?php
// api/tracker_lancamento.php
// Metricas enxutas da landing de lancamento: views, conversao para o app e origem.
// Reaproveita os mesmos eventos brutos do landing_insights_events (Supabase), sem tocar
// nos dados/telas da landing antiga (landing.html / pre-cadastros).

ini_set('display_errors', '0');
error_reporting(0);

require_once __DIR__ . '/users_store.php';
require_once __DIR__ . '/landing_insights_access.php';
require_once __DIR__ . '/landing_insights_store.php';
require_once __DIR__ . '/referrals.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

function tracker_lancamento_respond($status, $data = [])
{
    http_response_code((int)$status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function tracker_lancamento_str($value, $fallback = '')
{
    if (!is_scalar($value)) return $fallback;
    $safe = trim((string)$value);
    return $safe !== '' ? $safe : $fallback;
}

function tracker_lancamento_timestamp($value)
{
    $ts = strtotime((string)$value);
    return $ts !== false ? (int)$ts : 0;
}

// Momento em que o .htaccess passou a servir a lancamento na raiz do dominio (antes disso,
// "/" era a landing antiga). Descoberto analisando o proprio historico de eventos: ha um
// salto claro de volume de acessos na raiz exatamente as 2026-07-11 23:00 (Europe/Berlin),
// coincidindo com o primeiro acesso real e explicito a /lancamento.html (23:52). Guardado em
// UTC para nao depender do timezone configurado no servidor.
define('TRACKER_LANCAMENTO_ROOT_CUTOVER_TS', strtotime('2026-07-11T20:30:00+00:00'));

function tracker_lancamento_is_root_path($path)
{
    return (bool)preg_match('#^(/saas-ugc)?(/index\.html)?$#', rtrim($path, '/'));
}

function tracker_lancamento_is_event($event)
{
    $page = strtolower(tracker_lancamento_str($event['page'] ?? '', ''));
    if ($page === 'lancamento') return true;

    $path = strtolower(tracker_lancamento_str($event['page_path'] ?? '', ''));
    if (strpos($path, 'lancamento') !== false) return true;

    // A raiz do dominio ("/", "/index.html") e ambigua: antes da troca de roteamento no
    // .htaccess ela servia a landing antiga, depois passou a servir a lancamento. So conta
    // como lancamento quando o evento e posterior a troca (ver TRACKER_LANCAMENTO_ROOT_CUTOVER_TS).
    if (tracker_lancamento_is_root_path($path)) {
        $timestamp = tracker_lancamento_timestamp($event['created_at'] ?? '');
        return $timestamp >= TRACKER_LANCAMENTO_ROOT_CUTOVER_TS;
    }

    return false;
}

// "Hoje" precisa bater com o dia no calendario do Brasil, nao com o timezone configurado
// no servidor (que pode estar em UTC ou em qualquer outro fuso). Sem isso, "Hoje" podia virar
// o dia errado dependendo de onde a Makerline estivesse hospedada.
function tracker_lancamento_today_start($now)
{
    $tz = new DateTimeZone('America/Sao_Paulo');
    $date = new DateTime('@' . $now);
    $date->setTimezone($tz);
    $date->setTime(0, 0, 0);
    return $date->getTimestamp();
}

function tracker_lancamento_build_range($period)
{
    $now = time();
    $end = $now;
    $days = 30;

    switch ($period) {
        case 'today':
            $start = tracker_lancamento_today_start($now);
            break;
        case '7d':
            $start = $now - (7 * 86400);
            break;
        case '14d':
            $start = $now - (14 * 86400);
            break;
        case 'all':
            $start = 0;
            break;
        case '30d':
        default:
            $start = $now - (30 * 86400);
            break;
    }

    $span = max(1, $end - $start);
    $previousEnd = $start;
    $previousStart = $start > 0 ? max(0, $start - $span) : 0;

    return [
        'start' => $start,
        'end' => $end,
        'previous_start' => $previousStart,
        'previous_end' => $previousEnd,
    ];
}

function tracker_lancamento_origin_key($session)
{
    if ($session['partner_code'] !== '') return 'partner:' . strtolower($session['partner_code']);
    if ($session['referral_code'] !== '') return 'referral:' . strtolower($session['referral_code']);
    // utm_source e channel podem descrever a mesma rede (ex.: utm_source=ig e channel=Instagram):
    // passa os dois pela mesma normalizacao pra cair na mesma chave e nao duplicar na tabela.
    if ($session['utm_source'] !== '') return 'channel:' . tracker_lancamento_canonical_channel($session['utm_source']);
    if ($session['channel'] !== '' && $session['channel'] !== 'Direto') return 'channel:' . tracker_lancamento_canonical_channel($session['channel']);
    return 'direct';
}

// Mapa unico: valor cru (utm_source OU channel) -> slug canonico -> nome legivel.
// Usado tanto pra agrupar (mesma rede = mesma linha) quanto pra exibir o nome.
function tracker_lancamento_channel_aliases()
{
    return [
        'ig' => 'instagram',
        'instagram' => 'instagram',
        'fb' => 'facebook',
        'facebook' => 'facebook',
        'meta' => 'facebook',
        'wpp' => 'whatsapp',
        'whatsapp' => 'whatsapp',
        'tiktok' => 'tiktok',
        'tt' => 'tiktok',
        'google' => 'google',
        'youtube' => 'youtube',
        'yt' => 'youtube',
        'email' => 'email',
        'newsletter' => 'email',
    ];
}

function tracker_lancamento_channel_display_labels()
{
    return [
        'instagram' => 'Instagram',
        'facebook' => 'Facebook',
        'whatsapp' => 'WhatsApp',
        'tiktok' => 'TikTok',
        'google' => 'Google',
        'youtube' => 'YouTube',
        'email' => 'E-mail',
    ];
}

function tracker_lancamento_canonical_channel($value)
{
    $aliases = tracker_lancamento_channel_aliases();
    $safe = strtolower(trim((string)$value));
    return $aliases[$safe] ?? $safe;
}

// Traduz utm_source/channel pra um nome que qualquer pessoa entende, em vez do valor tecnico cru.
function tracker_lancamento_utm_source_label($value)
{
    $slug = tracker_lancamento_canonical_channel($value);
    $displayLabels = tracker_lancamento_channel_display_labels();
    if (isset($displayLabels[$slug])) return $displayLabels[$slug];

    return ucfirst($slug);
}

function tracker_lancamento_origin_label($session)
{
    if ($session['partner_code'] !== '') {
        $partner = referrals_partner_by_code($session['partner_code']);
        if ($partner) {
            return tracker_lancamento_str($partner['name'] ?? '', $session['partner_code']);
        }
        return $session['partner_code'];
    }
    if ($session['referral_code'] !== '') {
        $internalLabel = referrals_internal_tracking_label($session['referral_code']);
        if ($internalLabel) return $internalLabel;

        $partner = referrals_partner_by_code($session['referral_code']);
        if ($partner) {
            return tracker_lancamento_str($partner['name'] ?? '', $session['referral_code']);
        }
        return $session['referral_code'];
    }
    if ($session['utm_source'] !== '') return tracker_lancamento_utm_source_label($session['utm_source']);
    if ($session['channel'] !== '' && $session['channel'] !== 'Direto') return $session['channel'];
    return 'Direto / orgânico';
}

function tracker_lancamento_build_summary($events)
{
    $sessions = [];

    foreach ($events as $event) {
        $sessionId = tracker_lancamento_str($event['session_id'] ?? '', '');
        if ($sessionId === '') continue;

        if (!isset($sessions[$sessionId])) {
            $sessions[$sessionId] = [
                'visitor_id' => tracker_lancamento_str($event['visitor_id'] ?? '', ''),
                'first_seen' => PHP_INT_MAX,
                'has_view' => false,
                'converted' => false,
                'cta_ids' => [],
                'partner_code' => '',
                'referral_code' => '',
                'utm_source' => '',
                'channel' => '',
            ];
        }

        $eventName = tracker_lancamento_str($event['event_name'] ?? '', '');
        $timestamp = tracker_lancamento_timestamp($event['created_at'] ?? '');
        if ($timestamp > 0 && $timestamp < $sessions[$sessionId]['first_seen']) {
            $sessions[$sessionId]['first_seen'] = $timestamp;
        }

        if ($eventName === 'page_view' || $eventName === 'session_start') {
            $sessions[$sessionId]['has_view'] = true;
        }

        if ($eventName === 'cta_click') {
            $sessions[$sessionId]['converted'] = true;
            $ctaId = tracker_lancamento_str($event['cta_id'] ?? '', 'cta');
            $ctaLabel = tracker_lancamento_str($event['cta_label'] ?? ($event['label'] ?? ''), $ctaId);
            if (!in_array($ctaId, $sessions[$sessionId]['cta_ids'], true)) {
                $sessions[$sessionId]['cta_ids'][] = $ctaId;
            }
            $GLOBALS['trackerLancamentoCtaLabels'][$ctaId] = $ctaLabel;
        }

        // Guarda a atribuicao assim que aparecer (o primeiro evento com dado costuma ser o mais confiavel).
        $partnerCode = tracker_lancamento_str($event['partner_code'] ?? '', '');
        if ($partnerCode !== '' && $sessions[$sessionId]['partner_code'] === '') {
            $sessions[$sessionId]['partner_code'] = $partnerCode;
        }
        $referralCode = tracker_lancamento_str($event['referral_code'] ?? '', '');
        if ($referralCode !== '' && $sessions[$sessionId]['referral_code'] === '') {
            $sessions[$sessionId]['referral_code'] = $referralCode;
        }
        $utmSource = tracker_lancamento_str($event['utm_source'] ?? ($event['utm']['source'] ?? ''), '');
        if ($utmSource !== '' && $sessions[$sessionId]['utm_source'] === '') {
            $sessions[$sessionId]['utm_source'] = $utmSource;
        }
        $channel = tracker_lancamento_str($event['channel'] ?? '', '');
        if ($channel !== '' && $sessions[$sessionId]['channel'] === '') {
            $sessions[$sessionId]['channel'] = $channel;
        }
    }

    // So conta como "view" sessoes que de fato tiveram um page_view/session_start real.
    $sessions = array_filter($sessions, function ($session) {
        return $session['has_view'];
    });

    $totalViews = count($sessions);
    $uniqueVisitors = count(array_unique(array_map(function ($session) {
        return $session['visitor_id'] !== '' ? $session['visitor_id'] : uniqid('v_', true);
    }, $sessions)));

    $converted = array_filter($sessions, function ($session) {
        return $session['converted'];
    });
    $convertedCount = count($converted);

    $ctaCounts = [];
    foreach ($converted as $session) {
        foreach ($session['cta_ids'] as $ctaId) {
            $ctaCounts[$ctaId] = ($ctaCounts[$ctaId] ?? 0) + 1;
        }
    }
    arsort($ctaCounts);
    $ctaLabels = is_array($GLOBALS['trackerLancamentoCtaLabels'] ?? null) ? $GLOBALS['trackerLancamentoCtaLabels'] : [];
    $byCta = [];
    foreach ($ctaCounts as $ctaId => $count) {
        $byCta[] = ['ctaId' => $ctaId, 'label' => $ctaLabels[$ctaId] ?? $ctaId, 'clicks' => (int)$count];
    }

    $origins = [];
    foreach ($sessions as $session) {
        $key = tracker_lancamento_origin_key($session);
        if (!isset($origins[$key])) {
            $origins[$key] = [
                'key' => $key,
                'label' => tracker_lancamento_origin_label($session),
                'views' => 0,
                'conversions' => 0,
            ];
        }
        $origins[$key]['views']++;
        if ($session['converted']) $origins[$key]['conversions']++;
    }

    $originList = array_values($origins);
    usort($originList, function ($a, $b) {
        return $b['views'] <=> $a['views'];
    });
    foreach ($originList as &$origin) {
        $origin['conversionRate'] = $origin['views'] > 0
            ? round(($origin['conversions'] / $origin['views']) * 100, 1)
            : 0.0;
    }
    unset($origin);

    return [
        'totalViews' => $totalViews,
        'uniqueVisitors' => $uniqueVisitors,
        'convertedSessions' => $convertedCount,
        'conversionRate' => $totalViews > 0 ? round(($convertedCount / $totalViews) * 100, 1) : 0.0,
        'byCta' => $byCta,
        'origins' => $originList,
    ];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    tracker_lancamento_respond(405, ['ok' => false, 'error' => 'Metodo nao permitido']);
}

if (users_store_backend() === 'error') {
    tracker_lancamento_respond(500, ['ok' => false, 'error' => users_store_last_error() ?: 'Banco configurado, mas nao esta pronto ainda.']);
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    tracker_lancamento_respond(400, ['ok' => false, 'error' => 'JSON invalido']);
}

$token = trim((string)($body['token'] ?? ''));
$auth = landing_private_authenticate_token($token);
if (empty($auth['ok'])) {
    tracker_lancamento_respond((int)($auth['status'] ?? 401), [
        'ok' => false,
        'error' => $auth['error'] ?? 'Sessao privada invalida.',
    ]);
}

$period = trim((string)($body['period'] ?? '30d'));
$range = tracker_lancamento_build_range($period);

$store = landing_insights_load_store();
$rawEvents = is_array($store['events'] ?? null) ? array_values($store['events']) : [];

$currentEvents = [];
$previousEvents = [];

foreach ($rawEvents as $event) {
    if (!is_array($event)) continue;
    if (!empty($event['is_test']) || !empty($event['is_bot'])) continue;
    if (!tracker_lancamento_is_event($event)) continue;

    $timestamp = tracker_lancamento_timestamp($event['created_at'] ?? '');
    if ($timestamp >= $range['start'] && $timestamp <= $range['end']) {
        $currentEvents[] = $event;
    } elseif ($timestamp >= $range['previous_start'] && $timestamp < $range['previous_end']) {
        $previousEvents[] = $event;
    }
}

$current = tracker_lancamento_build_summary($currentEvents);
$previous = tracker_lancamento_build_summary($previousEvents);

tracker_lancamento_respond(200, [
    'ok' => true,
    'viewer' => [
        'email' => (string)($auth['email'] ?? ''),
        'name' => (string)($auth['user']['name'] ?? ''),
    ],
    'meta' => [
        'generatedAt' => date('c'),
        'updatedAt' => (string)($store['updatedAt'] ?? ''),
        'period' => $period,
        'source' => 'lancamento.html',
    ],
    'views' => [
        'total' => $current['totalViews'],
        'uniqueVisitors' => $current['uniqueVisitors'],
        'previousTotal' => $previous['totalViews'],
    ],
    'conversion' => [
        'convertedSessions' => $current['convertedSessions'],
        'rate' => $current['conversionRate'],
        'previousRate' => $previous['conversionRate'],
        'byCta' => $current['byCta'],
    ],
    'origins' => $current['origins'],
]);
