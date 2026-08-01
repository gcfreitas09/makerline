<?php
ini_set('display_errors', '0');
error_reporting(0);

require_once __DIR__ . '/users_store.php';
require_once __DIR__ . '/landing_insights_store.php';
require_once __DIR__ . '/landing_insights_access.php';
require_once __DIR__ . '/referrals.php';
require_once __DIR__ . '/waitlist_store.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

const LANDING_INSIGHTS_WAITLIST_FILE = __DIR__ . '/../storage/waitlist.json';
const LANDING_INSIGHTS_LEGACY_SNAPSHOT_FILE = __DIR__ . '/../storage/landing_insights_legacy_snapshot.json';
const LANDING_SECTIONS_ORDER = ['hero', 'problem', 'features', 'how-it-works', 'before-after', 'target-audience', 'social-proof', 'final-form', 'faq', 'footer'];
const NEW_LANDING_LAUNCH_DATE = '2026-06-06T00:00:00-03:00';

function landing_insights_respond($status, $data = [])
{
    http_response_code((int)$status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function landing_insights_timestamp($value)
{
    if (!$value) return 0;
    $ts = strtotime((string)$value);
    return $ts !== false ? (int)$ts : 0;
}

function landing_insights_iso($timestamp)
{
    return date('c', (int)$timestamp);
}

function landing_insights_day_key($value)
{
    $ts = landing_insights_timestamp($value);
    return $ts > 0 ? gmdate('Y-m-d', $ts) : '';
}

function landing_insights_percent($numerator, $denominator, $precision = 1)
{
    $safeDenominator = (float)$denominator;
    if ($safeDenominator <= 0) return 0;
    return round((((float)$numerator) / $safeDenominator) * 100, $precision);
}

function landing_insights_string($value, $fallback = '')
{
    $safe = trim((string)$value);
    return $safe !== '' ? $safe : $fallback;
}

function landing_insights_bool($value)
{
    if (is_bool($value)) return $value;
    if (is_numeric($value)) return (int)$value === 1;
    $safe = strtolower(trim((string)$value));
    if ($safe === '') return false;
    return in_array($safe, ['1', 'true', 'yes', 'sim', 'on'], true);
}

function landing_insights_load_legacy_snapshots()
{
    if (!is_file(LANDING_INSIGHTS_LEGACY_SNAPSHOT_FILE)) return [];

    $decoded = json_decode((string)file_get_contents(LANDING_INSIGHTS_LEGACY_SNAPSHOT_FILE), true);
    if (!is_array($decoded)) return [];

    if (isset($decoded['snapshots']) && is_array($decoded['snapshots'])) {
        return array_values(array_filter($decoded['snapshots'], 'is_array'));
    }

    $isList = array_keys($decoded) === range(0, count($decoded) - 1);
    if ($isList) {
        return array_values(array_filter($decoded, 'is_array'));
    }

    if (isset($decoded['summary']) || isset($decoded['captured_at']) || isset($decoded['source'])) {
        return [$decoded];
    }

    return [];
}

function landing_insights_legacy_snapshot_source_key($snapshot)
{
    $source = landing_insights_string($snapshot['source'] ?? ($snapshot['data_source'] ?? ''), '');
    return $source !== '' ? $source : 'tracker_online';
}

function landing_insights_range_contains_snapshot($range, $snapshot)
{
    $startedAt = landing_insights_timestamp($snapshot['traffic_started_at'] ?? '');
    $capturedAt = landing_insights_timestamp($snapshot['captured_at'] ?? '');
    if ($startedAt <= 0 || $capturedAt <= 0) return false;

    return (int)$range['start'] <= $startedAt && (int)$range['end'] >= $capturedAt;
}

function landing_insights_upsert_max(&$rows, $key, $value, $legacyRow)
{
    foreach ($rows as &$row) {
        if (strtolower(trim((string)($row[$key] ?? ''))) !== strtolower(trim((string)$value))) continue;
        foreach ($legacyRow as $field => $legacyValue) {
            if (is_numeric($legacyValue) && isset($row[$field]) && is_numeric($row[$field])) {
                $row[$field] = max((float)$row[$field], (float)$legacyValue);
            } elseif (!isset($row[$field]) || $row[$field] === '') {
                $row[$field] = $legacyValue;
            }
        }
        unset($row);
        return;
    }
    unset($row);
    $rows[] = $legacyRow;
}

function landing_insights_partner_identity_key($partnerCode, $partnerName = '')
{
    $code = strtolower(trim((string)$partnerCode));
    if ($code !== '') return 'code:' . $code;

    $name = strtolower(trim((string)$partnerName));
    if ($name !== '') return 'name:' . $name;

    return 'organico';
}

function landing_insights_recalculate_lead_rollups(&$analytics)
{
    $leadRows = is_array($analytics['leads'] ?? null) ? array_values($analytics['leads']) : [];
    $leadCount = count($leadRows);
    $visitors = max(1, (int)($analytics['summary']['unique_visitors'] ?? 0));
    $clicks = max(1, (int)($analytics['summary']['cta_clicks'] ?? 0));

    $analytics['summary']['leads'] = $leadCount;
    $analytics['cards']['leads'] = $leadCount;
    $analytics['summary']['visitor_to_lead'] = landing_insights_percent($leadCount, $visitors, 2);
    $analytics['summary']['click_to_lead'] = landing_insights_percent($leadCount, $clicks, 1);
    $analytics['cards']['visitor_to_lead'] = $analytics['summary']['visitor_to_lead'];
    $analytics['cards']['click_to_lead'] = $analytics['summary']['click_to_lead'];

    $submitAttempts = max((int)($analytics['form']['submit_attempts'] ?? 0), $leadCount);
    $formStarted = (int)($analytics['form']['started'] ?? 0);
    $formViewers = max(1, (int)($analytics['form']['viewers'] ?? 0));
    $analytics['form']['submit_attempts'] = $submitAttempts;
    $analytics['form']['leads'] = $leadCount;
    $analytics['form']['start_rate'] = landing_insights_percent($formStarted, $formViewers, 1);
    $analytics['form']['completion_rate'] = landing_insights_percent($leadCount, max(1, $formStarted), 1);
    $analytics['summary']['form_start_rate'] = $analytics['form']['start_rate'];
    $analytics['summary']['form_completion_rate'] = $analytics['form']['completion_rate'];
    $analytics['cards']['form_start_rate'] = $analytics['summary']['form_start_rate'];
    $analytics['cards']['form_completion_rate'] = $analytics['summary']['form_completion_rate'];

    if (isset($analytics['funnel']['steps']) && is_array($analytics['funnel']['steps'])) {
        foreach ($analytics['funnel']['steps'] as &$step) {
            if (($step['id'] ?? '') === 'form_submit' || ($step['id'] ?? '') === 'lead') {
                $step['count'] = $leadCount;
            }
        }
        unset($step);
        landing_insights_rebuild_funnel($analytics);
    }

    $analytics['funnel']['mini_cards'] = [
        ['id' => 'hero_to_cta', 'label' => 'Taxa hero -> CTA', 'value' => (float)($analytics['summary']['hero_to_cta_rate'] ?? 0)],
        ['id' => 'cta_to_form', 'label' => 'Taxa CTA -> formulario iniciado', 'value' => landing_insights_percent((int)($analytics['form']['started'] ?? 0), max(1, (int)($analytics['summary']['cta_clicks'] ?? 0)), 1)],
        ['id' => 'form_to_lead', 'label' => 'Taxa formulario iniciado -> lead', 'value' => (float)($analytics['form']['completion_rate'] ?? 0)],
        ['id' => 'visitor_to_lead', 'label' => 'Taxa visitante -> lead', 'value' => (float)($analytics['summary']['visitor_to_lead'] ?? 0)],
    ];

    $partnerIndexes = [];
    foreach ((array)($analytics['partners'] ?? []) as $index => $row) {
        $identity = landing_insights_partner_identity_key($row['partner_code'] ?? '', $row['partner_name'] ?? '');
        $partnerIndexes[$identity] = $index;
        $analytics['partners'][$index]['leads'] = 0;
        $analytics['partners'][$index]['last_lead_at'] = '';
    }

    $channelIndexes = [];
    foreach ((array)($analytics['acquisition']['channels'] ?? []) as $index => $row) {
        $channel = trim((string)($row['channel'] ?? ''));
        if ($channel === '') continue;
        $channelIndexes[strtolower($channel)] = $index;
        $analytics['acquisition']['channels'][$index]['leads'] = 0;
    }

    $deviceIndexes = [];
    foreach ((array)($analytics['devices'] ?? []) as $index => $row) {
        $device = trim((string)($row['device'] ?? ''));
        if ($device === '') continue;
        $deviceIndexes[strtolower($device)] = $index;
        $analytics['devices'][$index]['leads'] = 0;
    }

    $seriesLeadCounts = [];
    foreach ($leadRows as $leadRow) {
        $partnerIdentity = landing_insights_partner_identity_key($leadRow['partner_code'] ?? '', $leadRow['partner_name'] ?? '');
        if (isset($partnerIndexes[$partnerIdentity])) {
            $partnerIndex = $partnerIndexes[$partnerIdentity];
            $analytics['partners'][$partnerIndex]['leads']++;
            $createdAt = trim((string)($leadRow['created_at'] ?? ''));
            if (
                $createdAt !== ''
                && (
                    trim((string)($analytics['partners'][$partnerIndex]['last_lead_at'] ?? '')) === ''
                    || landing_insights_timestamp($createdAt) > landing_insights_timestamp($analytics['partners'][$partnerIndex]['last_lead_at'])
                )
            ) {
                $analytics['partners'][$partnerIndex]['last_lead_at'] = $createdAt;
            }
        }

        $channelKey = strtolower(trim((string)($leadRow['channel'] ?? 'Direto')));
        if ($channelKey !== '' && isset($channelIndexes[$channelKey])) {
            $analytics['acquisition']['channels'][$channelIndexes[$channelKey]]['leads']++;
        }

        $deviceKey = strtolower(trim((string)($leadRow['device_label'] ?? 'Nao identificado')));
        if ($deviceKey !== '' && isset($deviceIndexes[$deviceKey])) {
            $analytics['devices'][$deviceIndexes[$deviceKey]]['leads']++;
        }

        $dayKey = landing_insights_day_key($leadRow['created_at'] ?? '');
        if ($dayKey !== '') {
            $seriesLeadCounts[$dayKey] = ($seriesLeadCounts[$dayKey] ?? 0) + 1;
        }
    }

    foreach ((array)($analytics['partners'] ?? []) as $index => $row) {
        $views = max(1, (int)($row['views'] ?? 0));
        $analytics['partners'][$index]['conversion'] = landing_insights_percent((int)($row['leads'] ?? 0), $views, 1);
    }

    foreach ((array)($analytics['acquisition']['channels'] ?? []) as $index => $row) {
        $visitorsCount = max(1, (int)($row['visitors'] ?? 0));
        $analytics['acquisition']['channels'][$index]['conversion'] = landing_insights_percent((int)($row['leads'] ?? 0), $visitorsCount, 1);
    }

    foreach ((array)($analytics['devices'] ?? []) as $index => $row) {
        $visitorsCount = max(1, (int)($row['visitors'] ?? 0));
        $analytics['devices'][$index]['conversion'] = landing_insights_percent((int)($row['leads'] ?? 0), $visitorsCount, 1);
    }

    foreach ((array)($analytics['series'] ?? []) as $index => $row) {
        $dayKey = trim((string)($row['date'] ?? ''));
        $analytics['series'][$index]['leads'] = (int)($seriesLeadCounts[$dayKey] ?? 0);
    }
}

function landing_insights_rebuild_funnel(&$analytics)
{
    $steps = &$analytics['funnel']['steps'];
    $total = max(1, (int)($analytics['summary']['unique_visitors'] ?? 0));
    $biggestDrop = ['id' => '', 'label' => '', 'drop_count' => 0, 'drop_percent' => 0];

    foreach ($steps as $index => &$step) {
        $previous = $index > 0 ? (int)$steps[$index - 1]['count'] : (int)$step['count'];
        $current = (int)$step['count'];
        $step['percent_previous'] = $index === 0 ? 100 : landing_insights_percent($current, max(1, $previous), 1);
        $step['percent_total'] = landing_insights_percent($current, $total, 1);
        $step['drop_count'] = max(0, $previous - $current);
        $step['drop_percent'] = $index === 0 ? 0 : landing_insights_percent($step['drop_count'], max(1, $previous), 1);
        if ($step['drop_count'] > $biggestDrop['drop_count']) {
            $biggestDrop = [
                'id' => $step['id'],
                'label' => $step['label'],
                'drop_count' => $step['drop_count'],
                'drop_percent' => $step['drop_percent'],
            ];
        }
    }
    unset($step);
    $analytics['funnel']['biggest_drop'] = $biggestDrop;
}

function landing_insights_apply_legacy_snapshot($analytics, $snapshot, $range)
{
    if (!$snapshot || !landing_insights_range_contains_snapshot($range, $snapshot)) return $analytics;

    $summary = is_array($snapshot['summary'] ?? null) ? $snapshot['summary'] : [];
    $snapshotSourceKey = landing_insights_legacy_snapshot_source_key($snapshot);
    $legacyLeads = [];
    foreach ((array)($snapshot['leads'] ?? []) as $legacyLead) {
        $timestamp = landing_insights_timestamp($legacyLead['created_at'] ?? '');
        if ($timestamp <= 0 || !landing_insights_is_in_range($timestamp, $range)) continue;
        if (landing_insights_bool($legacyLead['is_test'] ?? false)) continue;
        $legacyLeads[] = $legacyLead;
    }
    $legacyLeadCount = count($legacyLeads);
    $baseline = [
        'unique_visitors' => (int)($summary['visitors'] ?? 0),
        'page_views' => (int)($summary['landing_page_views'] ?? 0),
        'sessions' => (int)($summary['sessions'] ?? 0),
        'cta_clicks' => (int)($summary['cta_sessions'] ?? 0),
        'leads' => $legacyLeadCount,
        'avg_time_on_page' => (int)($summary['average_engagement_seconds'] ?? 0),
        'avg_scroll_percent' => (float)($summary['average_scroll_depth'] ?? 0),
    ];
    foreach ($baseline as $key => $value) {
        $analytics['summary'][$key] = max((float)($analytics['summary'][$key] ?? 0), (float)$value);
        $analytics['cards'][$key] = $analytics['summary'][$key];
    }

    $visitors = max(1, (int)$analytics['summary']['unique_visitors']);
    $clicks = max(1, (int)$analytics['summary']['cta_clicks']);
    $leads = (int)$analytics['summary']['leads'];
    $analytics['summary']['visitor_to_lead'] = landing_insights_percent($leads, $visitors, 2);
    $analytics['summary']['click_to_lead'] = landing_insights_percent($leads, $clicks, 1);
    $analytics['cards']['visitor_to_lead'] = $analytics['summary']['visitor_to_lead'];
    $analytics['cards']['click_to_lead'] = $analytics['summary']['click_to_lead'];
    $analytics['summary']['hero_to_cta_rate'] = landing_insights_percent(
        (int)($summary['cta_sessions'] ?? 0),
        max(1, (int)($summary['visitors'] ?? 0)),
        1
    );

    $funnelMinimums = [
        'visited' => (int)($summary['visitors'] ?? 0),
        'hero' => (int)($summary['visitors'] ?? 0),
        'cta' => (int)($summary['cta_sessions'] ?? 0),
        'form_start' => (int)($summary['form_start_sessions'] ?? 0),
        'form_submit' => $legacyLeadCount,
        'lead' => $legacyLeadCount,
    ];
    foreach ($analytics['funnel']['steps'] as &$step) {
        if (isset($funnelMinimums[$step['id']])) {
            $step['count'] = max((int)$step['count'], $funnelMinimums[$step['id']]);
        }
    }
    unset($step);
    landing_insights_rebuild_funnel($analytics);

    $legacyFormViewers = 0;
    foreach ((array)($snapshot['sections'] ?? []) as $legacySection) {
        if (($legacySection['id'] ?? '') === 'final-form') {
            $legacyFormViewers = (int)($legacySection['sessions'] ?? 0);
            break;
        }
    }
    $analytics['form']['viewers'] = max((int)$analytics['form']['viewers'], $legacyFormViewers);
    $analytics['form']['started'] = max((int)$analytics['form']['started'], (int)($summary['form_start_sessions'] ?? 0));
    $analytics['form']['submit_attempts'] = max((int)$analytics['form']['submit_attempts'], $legacyLeadCount);
    $analytics['form']['leads'] = max((int)$analytics['form']['leads'], $legacyLeadCount);
    $analytics['form']['start_rate'] = landing_insights_percent(
        $analytics['form']['started'],
        max(1, $analytics['form']['viewers']),
        1
    );
    $analytics['form']['completion_rate'] = landing_insights_percent(
        $analytics['form']['leads'],
        max(1, $analytics['form']['started']),
        1
    );
    $analytics['summary']['form_start_rate'] = $analytics['form']['start_rate'];
    $analytics['summary']['form_completion_rate'] = $analytics['form']['completion_rate'];
    $analytics['cards']['hero_to_cta_rate'] = $analytics['summary']['hero_to_cta_rate'];
    $analytics['cards']['form_start_rate'] = $analytics['summary']['form_start_rate'];
    $analytics['cards']['form_completion_rate'] = $analytics['summary']['form_completion_rate'];

    $miniCardValues = [
        'hero_to_cta' => $analytics['summary']['hero_to_cta_rate'],
        'cta_to_form' => landing_insights_percent($analytics['form']['started'], max(1, (int)$analytics['summary']['cta_clicks']), 1),
        'form_to_lead' => $analytics['form']['completion_rate'],
        'visitor_to_lead' => $analytics['summary']['visitor_to_lead'],
    ];
    foreach ($analytics['funnel']['mini_cards'] as &$miniCard) {
        if (isset($miniCardValues[$miniCard['id']])) {
            $miniCard['value'] = $miniCardValues[$miniCard['id']];
        }
    }
    unset($miniCard);

    foreach ((array)($snapshot['sections'] ?? []) as $legacySection) {
        $id = (string)($legacySection['id'] ?? '');
        foreach ($analytics['sections'] as &$section) {
            if (($section['id'] ?? '') !== $id) continue;
            $section['visitors'] = max((int)$section['visitors'], (int)($legacySection['sessions'] ?? 0));
            $section['visitors_percent'] = landing_insights_percent($section['visitors'], $visitors, 1);
            $analytics['section_lookup'][$id] = $section;
            break;
        }
        unset($section);
    }

    foreach ((array)($snapshot['ctas'] ?? []) as $legacyCta) {
        $id = (string)($legacyCta['id'] ?? '');
        foreach ($analytics['ctas'] as &$cta) {
            if (($cta['id'] ?? '') !== $id) continue;
            $cta['clicks'] = max((int)$cta['clicks'], (int)($legacyCta['clicks'] ?? 0));
            $cta['visitors_percent'] = landing_insights_percent(
                max((int)($legacyCta['sessions'] ?? 0), (int)round(($cta['visitors_percent'] / 100) * $visitors)),
                $visitors,
                1
            );
            $analytics['cta_lookup'][$id] = $cta;
            break;
        }
        unset($cta);
    }

    foreach ((array)($snapshot['sources'] ?? []) as $source) {
        $label = (string)($source['label'] ?? '');
        $channel = str_starts_with($label, 'Parceiro:') ? 'Parceiros' : $label;
        landing_insights_upsert_max($analytics['acquisition']['channels'], 'channel', $channel, [
            'channel' => $channel,
            'visitors' => (int)($source['sessions'] ?? 0),
            'sessions' => (int)($source['sessions'] ?? 0),
            'cta_clicks' => 0,
            'leads' => (int)($source['leads'] ?? 0),
            'conversion' => 0,
        ]);

        if (!empty($source['partner_code'])) {
            $partnerDetails = landing_insights_resolve_partner_details(
                (string)($source['referral_code'] ?? ''),
                $source['partner_code'],
                $source['partner_name'] ?? ''
            );
            landing_insights_upsert_max($analytics['partners'], 'partner_code', $source['partner_code'], [
                'partner_code' => $partnerDetails['partner_code'] !== '' ? $partnerDetails['partner_code'] : (string)$source['partner_code'],
                'partner_name' => $partnerDetails['partner_name'] !== '' ? $partnerDetails['partner_name'] : (string)($source['partner_name'] ?? ''),
                'partner_instagram' => $partnerDetails['partner_instagram'],
                'partner_instagram_url' => $partnerDetails['partner_instagram_url'],
                'referral_code' => $partnerDetails['referral_code'],
                'trial_days' => (int)$partnerDetails['partner_trial_days'],
                'signup_url' => $partnerDetails['signup_url'],
                'views' => (int)($source['sessions'] ?? 0),
                'sessions' => (int)($source['sessions'] ?? 0),
                'unique_visitors' => (int)($source['sessions'] ?? 0),
                'leads' => (int)($source['leads'] ?? 0),
                'conversion' => 0,
                'last_lead_at' => '',
                'data_source' => 'tracker_online',
            ]);
        }
    }

    foreach ((array)($snapshot['devices'] ?? []) as $device) {
        landing_insights_upsert_max($analytics['devices'], 'device', $device['label'] ?? '', [
            'device' => $device['label'] ?? 'Nao identificado',
            'visitors' => (int)($device['sessions'] ?? 0),
            'sessions' => (int)($device['sessions'] ?? 0),
            'cta_clicks' => 0,
            'form_starts' => 0,
            'leads' => (int)($device['leads'] ?? 0),
            'conversion' => 0,
            'avg_time_seconds' => 0,
            'avg_scroll_percent' => 0,
        ]);
    }

    foreach ($legacyLeads as $legacyLead) {
        $createdAt = (string)($legacyLead['created_at'] ?? '');
        $timestamp = landing_insights_timestamp($createdAt);
        $id = (string)($legacyLead['id'] ?? '');
        $alreadyExists = false;
        foreach ($analytics['leads'] as $lead) {
            if (($lead['id'] ?? '') === $id) {
                $alreadyExists = true;
                break;
            }
        }
        if ($alreadyExists) continue;
        $partnerDetails = landing_insights_resolve_partner_details(
            (string)($legacyLead['referral_code'] ?? ''),
            (string)($legacyLead['partner_code'] ?? ''),
            (string)($legacyLead['partner_name'] ?? '')
        );
        $channel = landing_insights_string(
            $legacyLead['channel'] ?? '',
            landing_insights_channel_label(
                '',
                '',
                '',
                $partnerDetails['referral_code'],
                $partnerDetails['partner_code'],
                $partnerDetails['partner_name']
            )
        );
        if ($channel === '') $channel = 'Direto';
        $sourceLabel = landing_insights_string(
            $legacyLead['source_label'] ?? '',
            'Historico do tracker online'
        );
        $leadStatus = (string)($legacyLead['lead_status'] ?? ($legacyLead['status'] ?? 'new'));
        $analytics['leads'][] = [
            'id' => $id,
            'created_at' => $createdAt,
            'name' => landing_insights_string($legacyLead['name'] ?? '', 'Lead historico sem contato salvo'),
            'phone' => (string)($legacyLead['phone'] ?? ''),
            'instagram' => '',
            'instagram_username' => '',
            'instagram_url' => '',
            'email' => (string)($legacyLead['email'] ?? ''),
            'channel' => $channel,
            'source_label' => $sourceLabel,
            'partner_name' => $partnerDetails['partner_name'],
            'partner_code' => $partnerDetails['partner_code'],
            'referral_code' => $partnerDetails['referral_code'],
            'partner_instagram' => $partnerDetails['partner_instagram'],
            'partner_instagram_url' => $partnerDetails['partner_instagram_url'],
            'partner_trial_days' => (int)$partnerDetails['partner_trial_days'],
            'partner_signup_url' => $partnerDetails['signup_url'],
            'utm_source' => (string)($legacyLead['utm_source'] ?? ''),
            'utm_medium' => (string)($legacyLead['utm_medium'] ?? ''),
            'campaign' => (string)($legacyLead['campaign'] ?? ''),
            'cta_id' => (string)($legacyLead['cta_id'] ?? ''),
            'cta_label' => landing_insights_string($legacyLead['cta_label'] ?? '', 'Sem CTA'),
            'section_id' => (string)($legacyLead['section_id'] ?? ''),
            'section_label' => (string)($legacyLead['section_label'] ?? ''),
            'status' => $leadStatus,
            'status_label' => landing_insights_lead_status_label($leadStatus),
            'visitor_id' => (string)($legacyLead['visitor_id'] ?? ''),
            'session_id' => (string)($legacyLead['session_id'] ?? ''),
            'device_label' => landing_insights_string($legacyLead['device_label'] ?? '', 'Nao identificado'),
            'data_source' => landing_insights_string($legacyLead['data_source'] ?? '', $snapshotSourceKey),
            'is_partial' => array_key_exists('is_partial', $legacyLead) ? landing_insights_bool($legacyLead['is_partial']) : true,
        ];
    }

    foreach ($analytics['partners'] as &$partnerRow) {
        $partnerRow['conversion'] = landing_insights_percent((int)($partnerRow['leads'] ?? 0), max(1, (int)($partnerRow['views'] ?? 0)), 1);
        if (empty($partnerRow['data_source'])) {
            $partnerRow['data_source'] = $snapshotSourceKey;
        }
    }
    unset($partnerRow);
    usort($analytics['partners'], function ($a, $b) {
        return ((int)($b['views'] ?? 0) <=> (int)($a['views'] ?? 0));
    });

    foreach ($analytics['acquisition']['channels'] as &$channelRow) {
        $channelRow['conversion'] = landing_insights_percent((int)($channelRow['leads'] ?? 0), max(1, (int)($channelRow['visitors'] ?? 0)), 1);
    }
    unset($channelRow);
    usort($analytics['acquisition']['channels'], function ($a, $b) {
        return ((int)($b['visitors'] ?? 0) <=> (int)($a['visitors'] ?? 0));
    });

    foreach ($analytics['devices'] as &$deviceRow) {
        $deviceRow['conversion'] = landing_insights_percent((int)($deviceRow['leads'] ?? 0), max(1, (int)($deviceRow['visitors'] ?? 0)), 1);
    }
    unset($deviceRow);
    usort($analytics['devices'], function ($a, $b) {
        return ((int)($b['visitors'] ?? 0) <=> (int)($a['visitors'] ?? 0));
    });

    foreach ($analytics['leads'] as $leadRow) {
        $partnerCode = trim((string)($leadRow['partner_code'] ?? ''));
        if ($partnerCode === '' || trim((string)($leadRow['created_at'] ?? '')) === '') continue;
        foreach ($analytics['partners'] as &$partnerRow) {
            if (trim((string)($partnerRow['partner_code'] ?? '')) !== $partnerCode) continue;
            if (trim((string)($leadRow['referral_code'] ?? '')) !== '') $partnerRow['referral_code'] = (string)$leadRow['referral_code'];
            if (!empty($leadRow['partner_instagram'])) $partnerRow['partner_instagram'] = (string)$leadRow['partner_instagram'];
            if (!empty($leadRow['partner_instagram_url'])) $partnerRow['partner_instagram_url'] = (string)$leadRow['partner_instagram_url'];
            if (!empty($leadRow['partner_signup_url'])) $partnerRow['signup_url'] = (string)$leadRow['partner_signup_url'];
            if ((int)($leadRow['partner_trial_days'] ?? 0) > 0) $partnerRow['trial_days'] = (int)$leadRow['partner_trial_days'];
            if (
                trim((string)($partnerRow['last_lead_at'] ?? '')) === ''
                || landing_insights_timestamp($leadRow['created_at']) > landing_insights_timestamp($partnerRow['last_lead_at'])
            ) {
                $partnerRow['last_lead_at'] = $leadRow['created_at'];
            }
            break;
        }
        unset($partnerRow);
    }

    $seriesIndex = [];
    foreach ((array)($analytics['series'] ?? []) as $index => $row) {
        $dayKey = (string)($row['date'] ?? '');
        if ($dayKey === '') continue;
        $seriesIndex[$dayKey] = $index;
    }
    foreach ((array)($snapshot['series'] ?? []) as $legacyPoint) {
        $dayKey = landing_insights_string($legacyPoint['date'] ?? '', '');
        if ($dayKey === '') continue;
        $visitors = max((int)($legacyPoint['visitors'] ?? 0), (int)($legacyPoint['sessions'] ?? 0));
        $leadsForDay = (int)($legacyPoint['leads'] ?? 0);
        if (isset($seriesIndex[$dayKey])) {
            $index = $seriesIndex[$dayKey];
            $analytics['series'][$index]['visitors'] = max((int)($analytics['series'][$index]['visitors'] ?? 0), $visitors);
            $analytics['series'][$index]['leads'] = max((int)($analytics['series'][$index]['leads'] ?? 0), $leadsForDay);
            continue;
        }

        $analytics['series'][] = [
            'date' => $dayKey,
            'label' => gmdate('d/m', strtotime($dayKey . ' 00:00:00 UTC')),
            'visitors' => $visitors,
            'leads' => $leadsForDay,
        ];
    }
    usort($analytics['series'], function ($a, $b) {
        return strcmp((string)($a['date'] ?? ''), (string)($b['date'] ?? ''));
    });

    usort($analytics['leads'], function ($a, $b) {
        return landing_insights_timestamp($b['created_at'] ?? '') <=> landing_insights_timestamp($a['created_at'] ?? '');
    });

    landing_insights_recalculate_lead_rollups($analytics);

    return $analytics;
}

function landing_insights_label_map_sections()
{
    return [
        'hero' => 'Hero',
        'problem' => 'Problema',
        'features' => 'Funcionalidades',
        'how-it-works' => 'Como funciona',
        'before-after' => 'Antes vs Depois',
        'target-audience' => 'Para quem e',
        'social-proof' => 'Prova social',
        'final-form' => 'Formulario final',
        'faq' => 'FAQ',
        'footer' => 'Footer',
    ];
}

function landing_insights_label_map_ctas()
{
    return [
        'header_cta' => ['label' => 'CTA do menu', 'location' => 'Header'],
        'hero_primary_cta' => ['label' => 'CTA principal da hero', 'location' => 'Hero'],
        'hero_secondary_features' => ['label' => 'Link Ver funcionalidades', 'location' => 'Hero'],
        'final_form_submit' => ['label' => 'Botao do formulario final', 'location' => 'Formulario final'],
        'footer_cta' => ['label' => 'CTA do footer', 'location' => 'Footer'],
    ];
}

function landing_insights_lead_status_label($status)
{
    $map = [
        'new' => 'Novo',
        'contacted' => 'Contatado',
        'qualified' => 'Qualificado',
        'discarded' => 'Descartado',
        'client' => 'Cliente',
    ];

    $safe = strtolower(trim((string)$status));
    return $map[$safe] ?? 'Novo';
}

function landing_insights_device_label($value)
{
    $safe = strtolower(trim((string)$value));
    if ($safe === 'mobile') return 'Mobile';
    if ($safe === 'tablet') return 'Tablet';
    if ($safe === 'desktop') return 'Desktop';
    return 'Nao identificado';
}

function landing_insights_normalize_section_id($sectionId)
{
    $safe = strtolower(trim((string)$sectionId));
    $map = [
        'problema' => 'problem',
        'funcionalidades' => 'features',
        'parceiros' => 'social-proof',
        'como-funciona' => 'how-it-works',
        'como_funciona' => 'how-it-works',
        'antes-vs-depois' => 'before-after',
        'antes_depois' => 'before-after',
        'antes-vs' => 'before-after',
        'faq' => 'faq',
        'duvidas' => 'faq',
        'cta-final' => 'final-form',
        'target_audience' => 'target-audience',
        'social_proof' => 'social-proof',
        'final_form' => 'final-form',
    ];

    return $map[$safe] ?? $safe;
}

function landing_insights_section_label($sectionId)
{
    $safe = landing_insights_normalize_section_id($sectionId);
    $map = landing_insights_label_map_sections();
    return $map[$safe] ?? ($safe !== '' ? $safe : 'Sem secao');
}

function landing_insights_normalize_cta_id($ctaId, $label = '')
{
    $safeId = strtolower(trim((string)$ctaId));
    if ($safeId !== '') return $safeId;

    $safeLabel = strtolower(trim((string)$label));
    if ($safeLabel === '') return '';
    if (strpos($safeLabel, 'header') !== false || strpos($safeLabel, 'menu') !== false) return 'header_cta';
    if (strpos($safeLabel, 'footer') !== false) return 'footer_cta';
    if (strpos($safeLabel, 'ver funcionalidades') !== false) return 'hero_secondary_features';
    if (strpos($safeLabel, 'formulario') !== false || strpos($safeLabel, 'garantir') !== false) return 'final_form_submit';
    if (strpos($safeLabel, 'hero') !== false || strpos($safeLabel, 'acesso antecipado') !== false) return 'hero_primary_cta';
    return '';
}

function landing_insights_cta_meta($ctaId, $label = '')
{
    $safeId = landing_insights_normalize_cta_id($ctaId, $label);
    $map = landing_insights_label_map_ctas();
    if (isset($map[$safeId])) {
        return array_merge(['id' => $safeId], $map[$safeId]);
    }

    return [
        'id' => $safeId,
        'label' => trim((string)$label) !== '' ? (string)$label : 'CTA desconhecido',
        'location' => 'Outro',
    ];
}

function landing_insights_partner_label($referralCode, $partnerCode = '', $partnerName = '')
{
    $safeName = trim((string)$partnerName);
    if ($safeName !== '') {
        return 'Indicacao';
    }

    $partner = null;
    $safeReferralCode = trim((string)$referralCode);
    $safePartnerCode = trim((string)$partnerCode);

    if ($safeReferralCode !== '') {
        $partner = referrals_partner_by_code($safeReferralCode);
    }
    if (!$partner && $safePartnerCode !== '') {
        $partner = referrals_partner_by_code($safePartnerCode);
    }

    return $partner ? 'Indicacao' : '';
}

function landing_insights_channel_label($channel, $utmSource, $referrerHost, $referralCode, $partnerCode, $partnerName)
{
    $safe = trim((string)$channel);
    if ($safe !== '') return $safe;
    if (landing_insights_partner_label($referralCode, $partnerCode, $partnerName) !== '') return 'Indicacao';

    $source = strtolower(trim((string)$utmSource));
    $referrer = strtolower(trim((string)$referrerHost));
    $haystack = $source . ' ' . $referrer;

    if ($haystack === ' ') return 'Direto';
    if (strpos($haystack, 'instagram') !== false || strpos($haystack, 'insta') !== false) return 'Instagram';
    if (strpos($haystack, 'tiktok') !== false) return 'TikTok';
    if (strpos($haystack, 'whatsapp') !== false || strpos($haystack, 'wa.me') !== false) return 'WhatsApp';
    if (strpos($haystack, 'google') !== false) return 'Google';
    if (strpos($haystack, 'facebook') !== false || strpos($haystack, 'meta') !== false) return 'Facebook';
    if (trim($haystack) === '') return 'Direto';
    return 'Outro';
}

function landing_insights_source_label($channel, $utmSource, $utmMedium, $referrerHost, $referralCode, $partnerCode, $partnerName)
{
    if (landing_insights_partner_label($referralCode, $partnerCode, $partnerName) !== '') {
        return 'Indicacao';
    }

    $safeSource = trim((string)$utmSource);
    $safeMedium = trim((string)$utmMedium);
    if ($safeSource !== '' && $safeMedium !== '') {
        return $safeSource . ' / ' . $safeMedium;
    }
    if ($safeSource !== '') {
        return $safeSource;
    }

    $safeChannel = trim((string)$channel);
    if ($safeChannel !== '') {
        return $safeChannel;
    }

    $safeReferrer = trim((string)$referrerHost);
    if ($safeReferrer !== '') {
        return $safeReferrer;
    }

    return 'Direto';
}

function landing_insights_detect_data_source($timestamp, $explicit = '')
{
    $safeExplicit = strtolower(trim((string)$explicit));
    if ($safeExplicit !== '') {
        return $safeExplicit;
    }

    $launchTimestamp = landing_insights_timestamp(NEW_LANDING_LAUNCH_DATE);
    if ((int)$timestamp > 0 && $launchTimestamp > 0 && (int)$timestamp < $launchTimestamp) {
        return 'landing_antiga';
    }

    return 'novo_tracker';
}

function landing_insights_resolve_partner_details($referralCode, $partnerCode = '', $partnerName = '')
{
    $safeName = trim((string)$partnerName);
    $partner = null;

    if (trim((string)$referralCode) !== '') {
        $partner = referrals_partner_by_code($referralCode);
    }
    if (!$partner && trim((string)$partnerCode) !== '') {
        $partner = referrals_partner_by_code($partnerCode);
    }

    if ($partner) {
        $payload = referrals_public_partner_payload($partner);
        return [
            'partner_code' => (string)($payload['partnerCode'] ?? ''),
            'referral_code' => (string)($payload['referralCode'] ?? ''),
            'partner_name' => (string)($payload['name'] ?? ''),
            'partner_instagram' => (string)($payload['instagram'] ?? ''),
            'partner_instagram_url' => (string)($payload['instagramUrl'] ?? ''),
            'partner_trial_days' => (int)($payload['trialDays'] ?? 0),
            'signup_url' => (string)($payload['signupUrl'] ?? ''),
        ];
    }

    return [
        'partner_code' => trim((string)$partnerCode),
        'referral_code' => trim((string)$referralCode),
        'partner_name' => $safeName,
        'partner_instagram' => '',
        'partner_instagram_url' => '',
        'partner_trial_days' => 0,
        'signup_url' => '',
    ];
}

function landing_insights_normalize_event($event)
{
    if (!is_array($event)) return null;

    $eventName = landing_insights_string($event['event_name'] ?? ($event['eventType'] ?? ''), '');
    $createdAt = landing_insights_string($event['created_at'] ?? ($event['eventAt'] ?? ''), '');
    $visitorId = landing_insights_string($event['visitor_id'] ?? ($event['visitorId'] ?? ''), '');
    $sessionId = landing_insights_string($event['session_id'] ?? ($event['sessionId'] ?? ''), '');
    $utm = is_array($event['utm'] ?? null) ? $event['utm'] : [];

    if ($eventName === '' || $createdAt === '' || $visitorId === '' || $sessionId === '') {
        return null;
    }

    $ctaLabel = landing_insights_string($event['cta_label'] ?? ($event['label'] ?? ''), '');
    $ctaId = landing_insights_normalize_cta_id($event['cta_id'] ?? ($event['ctaId'] ?? ''), $ctaLabel);
    $sectionId = landing_insights_normalize_section_id($event['section_id'] ?? ($event['sectionId'] ?? ''));
    $referralCode = landing_insights_string($event['referral_code'] ?? ($event['referralCode'] ?? ''), '');
    $partnerCode = landing_insights_string($event['partner_code'] ?? ($event['partnerCode'] ?? ''), '');
    $referrerHost = landing_insights_string($event['referrer_host'] ?? ($event['referrerHost'] ?? ''), '');
    $utmSource = landing_insights_string($utm['source'] ?? ($event['utm_source'] ?? ''), '');
    $utmMedium = landing_insights_string($utm['medium'] ?? ($event['utm_medium'] ?? ''), '');
    $utmCampaign = landing_insights_string($utm['campaign'] ?? ($event['utm_campaign'] ?? ''), '');
    $utmContent = landing_insights_string($utm['content'] ?? '', '');
    $utmTerm = landing_insights_string($utm['term'] ?? '', '');
    $channel = landing_insights_channel_label(
        landing_insights_string($event['channel'] ?? '', ''),
        $utmSource,
        $referrerHost,
        $referralCode,
        $partnerCode,
        ''
    );

    $timestamp = landing_insights_timestamp($createdAt);

    return [
        'id' => landing_insights_string($event['id'] ?? ($event['eventId'] ?? ''), ''),
        'event_name' => $eventName,
        'created_at' => $createdAt,
        'timestamp' => $timestamp,
        'visitor_id' => $visitorId,
        'session_id' => $sessionId,
        'page_instance_id' => landing_insights_string($event['page_instance_id'] ?? ($event['pageInstanceId'] ?? ''), ''),
        'page_url' => landing_insights_string($event['page_url'] ?? ($event['entryUrl'] ?? ''), ''),
        'page_path' => landing_insights_string($event['page_path'] ?? ($event['path'] ?? ''), ''),
        'section_id' => $sectionId,
        'cta_id' => $ctaId,
        'cta_label' => $ctaLabel,
        'form_id' => landing_insights_string($event['form_id'] ?? ($event['meta']['formId'] ?? ''), ''),
        'form_field' => landing_insights_string($event['form_field'] ?? ($event['meta']['formField'] ?? ''), ''),
        'href' => landing_insights_string($event['href'] ?? '', ''),
        'reason' => landing_insights_string($event['reason'] ?? ($event['meta']['reason'] ?? ''), ''),
        'status' => landing_insights_string($event['status'] ?? ($event['meta']['status'] ?? ''), ''),
        'message' => landing_insights_string($event['message'] ?? ($event['meta']['message'] ?? ''), ''),
        'referrer' => landing_insights_string($event['referrer'] ?? '', ''),
        'referrer_host' => $referrerHost,
        'referral_code' => $referralCode,
        'partner_code' => $partnerCode,
        'channel' => $channel,
        'device_type' => landing_insights_string($event['device_type'] ?? ($event['deviceType'] ?? ''), ''),
        'browser' => landing_insights_string($event['browser'] ?? '', ''),
        'os' => landing_insights_string($event['os'] ?? '', ''),
        'screen_width' => (int)($event['screen_width'] ?? ($event['screenWidth'] ?? ($event['viewportWidth'] ?? 0))),
        'screen_height' => (int)($event['screen_height'] ?? ($event['screenHeight'] ?? ($event['viewportHeight'] ?? 0))),
        'scroll_percent' => (int)($event['scroll_percent'] ?? ($event['scrollDepth'] ?? 0)),
        'time_on_page' => (int)($event['time_on_page'] ?? ($event['engagementSeconds'] ?? 0)),
        'hostname' => landing_insights_string($event['hostname'] ?? '', ''),
        'environment' => landing_insights_string($event['environment'] ?? '', ''),
        'is_test' => landing_insights_bool($event['is_test'] ?? ($event['isTest'] ?? false)),
        'is_bot' => landing_insights_bool($event['is_bot'] ?? false),
        'data_source' => landing_insights_detect_data_source($timestamp, $event['data_source'] ?? ($event['dataSource'] ?? '')),
        'utm_source' => $utmSource,
        'utm_medium' => $utmMedium,
        'utm_campaign' => $utmCampaign,
        'utm_content' => $utmContent,
        'utm_term' => $utmTerm,
    ];
}

function landing_insights_load_json($file)
{
    if (!is_file($file)) return [];
    $raw = @file_get_contents($file);
    if ($raw === false) return [];
    $decoded = json_decode((string)$raw, true);
    return is_array($decoded) ? $decoded : [];
}

function landing_insights_load_waitlist_entries()
{
    return waitlist_store_load_all();
}

function landing_insights_resolve_tracking($entry)
{
    $tracking = waitlist_store_normalize_tracking($entry['trackingLast'] ?? null)
        ?: waitlist_store_normalize_tracking($entry['trackingFirst'] ?? null)
        ?: [];

    return [
        'visitor_id' => landing_insights_string($tracking['visitorId'] ?? ($entry['visitorId'] ?? ''), ''),
        'session_id' => landing_insights_string($tracking['sessionId'] ?? ($entry['sessionId'] ?? ''), ''),
        'page_url' => landing_insights_string($tracking['entryUrl'] ?? ($entry['entryUrl'] ?? ''), ''),
        'page_path' => landing_insights_string($tracking['landingPath'] ?? ($entry['landingPath'] ?? ''), ''),
        'section_id' => landing_insights_normalize_section_id($tracking['lastSectionId'] ?? ($entry['lastSectionId'] ?? '')),
        'cta_id' => landing_insights_normalize_cta_id($tracking['lastCtaId'] ?? ($entry['lastCtaId'] ?? ''), $tracking['lastCtaLabel'] ?? ($entry['lastCtaLabel'] ?? '')),
        'cta_label' => landing_insights_string($tracking['lastCtaLabel'] ?? ($entry['lastCtaLabel'] ?? ''), ''),
        'referrer' => landing_insights_string($tracking['referrer'] ?? ($entry['referrer'] ?? ''), ''),
        'referrer_host' => landing_insights_string($tracking['referrerHost'] ?? ($entry['referrerHost'] ?? ''), ''),
        'referral_code' => landing_insights_string($tracking['referralCode'] ?? ($entry['referralCode'] ?? ''), ''),
        'partner_code' => landing_insights_string($tracking['partnerCode'] ?? ($entry['partnerCode'] ?? ''), ''),
        'partner_name' => landing_insights_string($entry['partnerName'] ?? '', ''),
        'channel' => landing_insights_string($tracking['channel'] ?? ($entry['channel'] ?? ''), ''),
        'device_type' => landing_insights_string($tracking['deviceType'] ?? ($entry['deviceType'] ?? ''), ''),
        'browser' => landing_insights_string($tracking['browser'] ?? ($entry['browser'] ?? ''), ''),
        'os' => landing_insights_string($tracking['os'] ?? ($entry['os'] ?? ''), ''),
        'screen_width' => (int)($tracking['screenWidth'] ?? ($entry['screenWidth'] ?? 0)),
        'screen_height' => (int)($tracking['screenHeight'] ?? ($entry['screenHeight'] ?? 0)),
        'scroll_percent' => (int)($tracking['maxScrollDepth'] ?? ($entry['maxScrollDepth'] ?? 0)),
        'time_on_page' => (int)($tracking['engagementSeconds'] ?? ($entry['engagementSeconds'] ?? 0)),
        'hostname' => landing_insights_string($tracking['hostname'] ?? ($entry['hostname'] ?? ''), ''),
        'environment' => landing_insights_string($tracking['environment'] ?? ($entry['environment'] ?? ''), ''),
        'is_test' => landing_insights_bool($tracking['isTest'] ?? ($entry['isTest'] ?? false)),
        'utm_source' => landing_insights_string($tracking['utm']['source'] ?? ($entry['utmSource'] ?? ''), ''),
        'utm_medium' => landing_insights_string($tracking['utm']['medium'] ?? ($entry['utmMedium'] ?? ''), ''),
        'utm_campaign' => landing_insights_string($tracking['utm']['campaign'] ?? ($entry['utmCampaign'] ?? ''), ''),
        'utm_content' => landing_insights_string($tracking['utm']['content'] ?? ($entry['utmContent'] ?? ''), ''),
        'utm_term' => landing_insights_string($tracking['utm']['term'] ?? ($entry['utmTerm'] ?? ''), ''),
        'seen_sections' => is_array($tracking['seenSections'] ?? null) ? array_values(array_map('landing_insights_normalize_section_id', $tracking['seenSections'])) : [],
    ];
}

function landing_insights_normalize_lead($entry)
{
    if (!is_array($entry)) return null;

    $createdAt = landing_insights_string($entry['createdAt'] ?? '', '');
    if ($createdAt === '') return null;

    $tracking = landing_insights_resolve_tracking($entry);
    $channel = landing_insights_channel_label(
        $tracking['channel'],
        $tracking['utm_source'],
        $tracking['referrer_host'],
        $tracking['referral_code'],
        $tracking['partner_code'],
        $tracking['partner_name']
    );
    $partnerDetails = landing_insights_resolve_partner_details(
        $tracking['referral_code'],
        $tracking['partner_code'],
        $tracking['partner_name']
    );

    $timestamp = landing_insights_timestamp($createdAt);

    return [
        'id' => waitlist_store_entry_id($entry),
        'created_at' => $createdAt,
        'timestamp' => $timestamp,
        'name' => landing_insights_string($entry['name'] ?? '', 'Sem nome'),
        'phone' => landing_insights_string($entry['phone'] ?? '', ''),
        'instagram' => waitlist_store_format_instagram($entry['instagramHandle'] ?? ($entry['instagramUsername'] ?? ($entry['instagram'] ?? ''))),
        'instagram_username' => waitlist_store_normalize_instagram($entry['instagramUsername'] ?? ($entry['instagramHandle'] ?? ($entry['instagram'] ?? ''))),
        'instagram_url' => landing_insights_string($entry['instagramUrl'] ?? waitlist_store_instagram_url($entry['instagramUsername'] ?? ($entry['instagramHandle'] ?? ($entry['instagram'] ?? ''))), ''),
        'lead_status' => waitlist_store_normalize_lead_status($entry['leadStatus'] ?? ''),
        'visitor_id' => $tracking['visitor_id'] !== '' ? $tracking['visitor_id'] : ('waitlist-' . waitlist_store_entry_id($entry)),
        'session_id' => $tracking['session_id'] !== '' ? $tracking['session_id'] : ('waitlist-' . waitlist_store_entry_id($entry)),
        'channel' => $channel,
        'source_label' => landing_insights_source_label(
            $channel,
            $tracking['utm_source'],
            $tracking['utm_medium'],
            $tracking['referrer_host'],
            $tracking['referral_code'],
            $tracking['partner_code'],
            $tracking['partner_name']
        ),
        'campaign' => $tracking['utm_campaign'] !== '' ? $tracking['utm_campaign'] : 'Sem campanha',
        'utm_source' => $tracking['utm_source'],
        'utm_medium' => $tracking['utm_medium'],
        'utm_campaign' => $tracking['utm_campaign'],
        'referrer' => $tracking['referrer'],
        'referrer_host' => $tracking['referrer_host'] !== '' ? $tracking['referrer_host'] : 'Direto',
        'cta_id' => $tracking['cta_id'],
        'cta_meta' => landing_insights_cta_meta($tracking['cta_id'], $tracking['cta_label']),
        'cta_label' => $tracking['cta_label'],
        'section_id' => $tracking['section_id'],
        'section_label' => landing_insights_section_label($tracking['section_id']),
        'device_type' => $tracking['device_type'],
        'device_label' => landing_insights_device_label($tracking['device_type']),
        'browser' => $tracking['browser'],
        'os' => $tracking['os'],
        'page_url' => $tracking['page_url'],
        'page_path' => $tracking['page_path'],
        'screen_width' => $tracking['screen_width'],
        'screen_height' => $tracking['screen_height'],
        'scroll_percent' => $tracking['scroll_percent'],
        'time_on_page' => $tracking['time_on_page'],
        'hostname' => $tracking['hostname'],
        'environment' => $tracking['environment'],
        'is_test' => landing_insights_bool($entry['isTest'] ?? $tracking['is_test']),
        'signup_count' => max(1, (int)($entry['signupCount'] ?? 1)),
        'referral_code' => $partnerDetails['referral_code'],
        'partner_code' => $partnerDetails['partner_code'],
        'partner_name' => $partnerDetails['partner_name'],
        'partner_instagram' => $partnerDetails['partner_instagram'],
        'partner_instagram_url' => $partnerDetails['partner_instagram_url'],
        'partner_trial_days' => (int)$partnerDetails['partner_trial_days'],
        'partner_signup_url' => $partnerDetails['signup_url'],
        'data_source' => landing_insights_detect_data_source($timestamp, $entry['dataSource'] ?? ''),
        'seen_sections' => $tracking['seen_sections'],
    ];
}

function landing_insights_build_legacy_leads($events, $existingLeads)
{
    if (!is_array($events) || !is_array($existingLeads)) return [];

    $leadKeys = [];
    foreach ($existingLeads as $lead) {
        if (!is_array($lead)) continue;
        $sessionId = trim((string)($lead['session_id'] ?? ''));
        $visitorId = trim((string)($lead['visitor_id'] ?? ''));
        if ($sessionId !== '') {
            $leadKeys['session:' . $sessionId] = true;
        }
        if ($visitorId !== '') {
            $leadKeys['visitor:' . $visitorId] = true;
        }
    }

    $legacyLeads = [];
    foreach ($events as $event) {
        if (!is_array($event)) continue;
        if (($event['event_name'] ?? '') !== 'lead_created') continue;
        if (($event['data_source'] ?? '') !== 'landing_antiga') continue;

        $sessionId = trim((string)($event['session_id'] ?? ''));
        $visitorId = trim((string)($event['visitor_id'] ?? ''));
        if (($sessionId !== '' && isset($leadKeys['session:' . $sessionId])) || ($visitorId !== '' && isset($leadKeys['visitor:' . $visitorId]))) {
            continue;
        }

        $partnerDetails = landing_insights_resolve_partner_details(
            $event['referral_code'] ?? '',
            $event['partner_code'] ?? ''
        );
        $channel = landing_insights_channel_label(
            $event['channel'] ?? '',
            $event['utm_source'] ?? '',
            $event['referrer_host'] ?? '',
            $partnerDetails['referral_code'],
            $partnerDetails['partner_code'],
            $partnerDetails['partner_name']
        );

        $legacyLeads[] = [
            'id' => 'legacy-' . trim((string)($event['id'] ?? uniqid('', true))),
            'created_at' => (string)($event['created_at'] ?? ''),
            'timestamp' => (int)($event['timestamp'] ?? 0),
            'name' => 'Lead historico sem contato salvo',
            'phone' => '',
            'instagram' => '',
            'instagram_username' => '',
            'instagram_url' => '',
            'lead_status' => 'new',
            'visitor_id' => $visitorId !== '' ? $visitorId : ('legacy-visitor-' . trim((string)($event['id'] ?? ''))),
            'session_id' => $sessionId !== '' ? $sessionId : ('legacy-session-' . trim((string)($event['id'] ?? ''))),
            'channel' => $channel,
            'source_label' => landing_insights_source_label(
                $channel,
                $event['utm_source'] ?? '',
                $event['utm_medium'] ?? '',
                $event['referrer_host'] ?? '',
                $partnerDetails['referral_code'],
                $partnerDetails['partner_code'],
                $partnerDetails['partner_name']
            ),
            'campaign' => trim((string)($event['utm_campaign'] ?? '')) !== '' ? (string)$event['utm_campaign'] : 'Sem campanha',
            'utm_source' => (string)($event['utm_source'] ?? ''),
            'utm_medium' => (string)($event['utm_medium'] ?? ''),
            'utm_campaign' => (string)($event['utm_campaign'] ?? ''),
            'referrer' => (string)($event['referrer'] ?? ''),
            'referrer_host' => trim((string)($event['referrer_host'] ?? '')) !== '' ? (string)$event['referrer_host'] : 'Direto',
            'cta_id' => (string)($event['cta_id'] ?? ''),
            'cta_meta' => landing_insights_cta_meta($event['cta_id'] ?? '', $event['cta_label'] ?? ''),
            'cta_label' => (string)($event['cta_label'] ?? ''),
            'section_id' => (string)($event['section_id'] ?? ''),
            'section_label' => landing_insights_section_label($event['section_id'] ?? ''),
            'device_type' => (string)($event['device_type'] ?? ''),
            'device_label' => landing_insights_device_label($event['device_type'] ?? ''),
            'browser' => (string)($event['browser'] ?? ''),
            'os' => (string)($event['os'] ?? ''),
            'page_url' => (string)($event['page_url'] ?? ''),
            'page_path' => (string)($event['page_path'] ?? ''),
            'screen_width' => (int)($event['screen_width'] ?? 0),
            'screen_height' => (int)($event['screen_height'] ?? 0),
            'scroll_percent' => (int)($event['scroll_percent'] ?? 0),
            'time_on_page' => (int)($event['time_on_page'] ?? 0),
            'hostname' => (string)($event['hostname'] ?? ''),
            'environment' => (string)($event['environment'] ?? ''),
            'is_test' => landing_insights_bool($event['is_test'] ?? false),
            'signup_count' => 1,
            'referral_code' => $partnerDetails['referral_code'],
            'partner_code' => $partnerDetails['partner_code'],
            'partner_name' => $partnerDetails['partner_name'],
            'partner_instagram' => $partnerDetails['partner_instagram'],
            'partner_instagram_url' => $partnerDetails['partner_instagram_url'],
            'partner_trial_days' => (int)$partnerDetails['partner_trial_days'],
            'partner_signup_url' => $partnerDetails['signup_url'],
            'data_source' => 'landing_antiga',
            'seen_sections' => [],
            'is_partial' => true,
        ];

        if ($sessionId !== '') {
            $leadKeys['session:' . $sessionId] = true;
        }
        if ($visitorId !== '') {
            $leadKeys['visitor:' . $visitorId] = true;
        }
    }

    return $legacyLeads;
}

function landing_insights_is_in_range($timestamp, $range)
{
    return $timestamp >= (int)$range['start'] && $timestamp <= (int)$range['end'];
}

function landing_insights_build_range($period, $dateFrom = '', $dateTo = '')
{
    $periodKey = strtolower(trim((string)$period));
    $now = time();
    $todayStart = strtotime('today');
    $todayEnd = strtotime('tomorrow') - 1;

    switch ($periodKey) {
        case 'today':
            $start = $todayStart;
            $end = $todayEnd;
            $label = 'Hoje';
            break;
        case '14d':
        case '14dias':
        case '14':
            $start = strtotime('-13 days', $todayStart);
            $end = $todayEnd;
            $label = '14 dias';
            break;
        case '30d':
        case '30dias':
        case '30':
            $start = strtotime('-29 days', $todayStart);
            $end = $todayEnd;
            $label = '30 dias';
            break;
        case 'all':
        case 'tudo':
        case 'historico':
            $start = strtotime('2026-05-01 00:00:00');
            $end = $todayEnd;
            $label = 'Todo historico';
            $periodKey = 'all';
            break;
        case 'custom':
            $start = strtotime($dateFrom . ' 00:00:00');
            $end = strtotime($dateTo . ' 23:59:59');
            if ($start === false || $end === false || $end < $start) {
                $start = strtotime('-29 days', $todayStart);
                $end = $todayEnd;
                $label = '30 dias';
                $periodKey = '30d';
            } else {
                $label = 'Personalizado';
            }
            break;
        case '7d':
        case '7dias':
        case '7':
        default:
            $start = strtotime('-6 days', $todayStart);
            $end = $todayEnd;
            $label = '7 dias';
            $periodKey = '7d';
            break;
    }

    $duration = max(1, ($end - $start) + 1);
    $previousStart = $start - $duration;
    $previousEnd = $start - 1;

    return [
        'key' => $periodKey,
        'label' => $label,
        'start' => $start,
        'end' => $end,
        'start_iso' => landing_insights_iso($start),
        'end_iso' => landing_insights_iso($end),
        'previous_start' => $previousStart,
        'previous_end' => $previousEnd,
        'previous_start_iso' => landing_insights_iso($previousStart),
        'previous_end_iso' => landing_insights_iso($previousEnd),
        'last_updated' => landing_insights_iso($now),
    ];
}

function landing_insights_empty_session($sessionId, $visitorId)
{
    return [
        'session_id' => $sessionId,
        'visitor_id' => $visitorId,
        'first_seen_at' => '',
        'last_seen_at' => '',
        'page_url' => '',
        'page_path' => '',
        'source_label' => 'Direto',
        'channel' => 'Direto',
        'referrer_host' => '',
        'device_type' => '',
        'browser' => '',
        'os' => '',
        'utm_source' => '',
        'utm_medium' => '',
        'utm_campaign' => '',
        'referral_code' => '',
        'partner_code' => '',
        'partner_name' => '',
        'partner_instagram' => '',
        'partner_instagram_url' => '',
        'partner_trial_days' => 0,
        'partner_signup_url' => '',
        'page_views' => 0,
        'page_view_instances' => [],
        'hero_seen' => false,
        'sections' => [],
        'section_scroll' => [],
        'cta_events' => [],
        'cta_clicks_total' => 0,
        'form_viewed' => false,
        'form_started' => false,
        'submit_attempted' => false,
        'submit_succeeded' => false,
        'form_errors' => [],
        'field_focuses' => [],
        'lead_count' => 0,
        'lead_timestamps' => [],
        'lead_ids' => [],
        'lead_names' => [],
        'lead_statuses' => [],
        'lead_origin_cta_id' => '',
        'lead_origin_section_id' => '',
        'max_scroll_percent' => 0,
        'time_on_page' => 0,
        'screen_width' => 0,
        'screen_height' => 0,
    ];
}

function landing_insights_apply_session_event(&$session, $event)
{
    $timestamp = (int)$event['timestamp'];
    if ($session['first_seen_at'] === '' || $timestamp < landing_insights_timestamp($session['first_seen_at'])) {
        $session['first_seen_at'] = $event['created_at'];
    }
    if ($session['last_seen_at'] === '' || $timestamp > landing_insights_timestamp($session['last_seen_at'])) {
        $session['last_seen_at'] = $event['created_at'];
    }

    if ($session['page_url'] === '' && $event['page_url'] !== '') $session['page_url'] = $event['page_url'];
    if ($session['page_path'] === '' && $event['page_path'] !== '') $session['page_path'] = $event['page_path'];
    if ($session['channel'] === 'Direto' && $event['channel'] !== '') $session['channel'] = $event['channel'];
    if ($session['source_label'] === 'Direto') {
        $session['source_label'] = landing_insights_source_label(
            $event['channel'],
            $event['utm_source'],
            $event['utm_medium'],
            $event['referrer_host'],
            $event['referral_code'],
            $event['partner_code'],
            ''
        );
    }
    if ($session['referrer_host'] === '' && $event['referrer_host'] !== '') $session['referrer_host'] = $event['referrer_host'];
    if ($session['device_type'] === '' && $event['device_type'] !== '') $session['device_type'] = $event['device_type'];
    if ($session['browser'] === '' && $event['browser'] !== '') $session['browser'] = $event['browser'];
    if ($session['os'] === '' && $event['os'] !== '') $session['os'] = $event['os'];
    if ($session['utm_source'] === '' && $event['utm_source'] !== '') $session['utm_source'] = $event['utm_source'];
    if ($session['utm_medium'] === '' && $event['utm_medium'] !== '') $session['utm_medium'] = $event['utm_medium'];
    if ($session['utm_campaign'] === '' && $event['utm_campaign'] !== '') $session['utm_campaign'] = $event['utm_campaign'];
    if ($session['referral_code'] === '' && $event['referral_code'] !== '') $session['referral_code'] = $event['referral_code'];
    if ($session['partner_code'] === '' && $event['partner_code'] !== '') $session['partner_code'] = $event['partner_code'];
    if ((int)$session['screen_width'] <= 0 && (int)$event['screen_width'] > 0) $session['screen_width'] = (int)$event['screen_width'];
    if ((int)$session['screen_height'] <= 0 && (int)$event['screen_height'] > 0) $session['screen_height'] = (int)$event['screen_height'];

    $session['max_scroll_percent'] = max((int)$session['max_scroll_percent'], (int)$event['scroll_percent']);
    $session['time_on_page'] = max((int)$session['time_on_page'], (int)$event['time_on_page']);

    if ($event['event_name'] === 'page_view') {
        $pageInstanceId = trim((string)($event['page_instance_id'] ?? ''));
        if ($pageInstanceId !== '') {
            if (!isset($session['page_view_instances'][$pageInstanceId])) {
                $session['page_view_instances'][$pageInstanceId] = true;
                $session['page_views']++;
            }
        } elseif ((int)$session['page_views'] === 0) {
            $session['page_views'] = 1;
        }
    }

    if ($event['event_name'] === 'section_view' && $event['section_id'] !== '') {
        if (!isset($session['sections'][$event['section_id']])) {
            $session['sections'][$event['section_id']] = $event['created_at'];
        }
        if (!isset($session['section_scroll'][$event['section_id']])) {
            $session['section_scroll'][$event['section_id']] = [];
        }
        $session['section_scroll'][$event['section_id']][] = (int)$event['scroll_percent'];
        if ($event['section_id'] === 'hero') {
            $session['hero_seen'] = true;
        }
    }

    if ($event['event_name'] === 'cta_click') {
        $session['cta_events'][] = [
            'timestamp' => $timestamp,
            'cta_id' => $event['cta_id'],
            'cta_label' => $event['cta_label'],
            'section_id' => $event['section_id'],
        ];
        $session['cta_clicks_total']++;
    }

    if ($event['event_name'] === 'form_view') {
        $session['form_viewed'] = true;
    }

    if ($event['event_name'] === 'form_start') {
        $session['form_started'] = true;
    }

    if ($event['event_name'] === 'form_field_focus' && $event['form_field'] !== '') {
        if (!isset($session['field_focuses'][$event['form_field']])) {
            $session['field_focuses'][$event['form_field']] = $event['created_at'];
        }
    }

    if ($event['event_name'] === 'form_submit_attempt') {
        $session['submit_attempted'] = true;
    }

    if ($event['event_name'] === 'form_submit_success') {
        $session['submit_succeeded'] = true;
    }

    if ($event['event_name'] === 'form_error') {
        $session['form_errors'][] = [
            'timestamp' => $timestamp,
            'message' => $event['message'],
            'field' => $event['form_field'],
        ];
    }
}

function landing_insights_merge_lead_into_session(&$session, $lead)
{
    if ($session['first_seen_at'] === '' || $lead['timestamp'] < landing_insights_timestamp($session['first_seen_at'])) {
        $session['first_seen_at'] = $lead['created_at'];
    }
    if ($session['last_seen_at'] === '' || $lead['timestamp'] > landing_insights_timestamp($session['last_seen_at'])) {
        $session['last_seen_at'] = $lead['created_at'];
    }

    if ($session['page_url'] === '' && $lead['page_url'] !== '') $session['page_url'] = $lead['page_url'];
    if ($session['page_path'] === '' && $lead['page_path'] !== '') $session['page_path'] = $lead['page_path'];
    if ($session['source_label'] === 'Direto') $session['source_label'] = $lead['source_label'];
    if ($session['channel'] === 'Direto') $session['channel'] = $lead['channel'];
    if ($session['referrer_host'] === '' && $lead['referrer_host'] !== '') $session['referrer_host'] = $lead['referrer_host'];
    if ($session['device_type'] === '' && $lead['device_type'] !== '') $session['device_type'] = $lead['device_type'];
    if ($session['browser'] === '' && $lead['browser'] !== '') $session['browser'] = $lead['browser'];
    if ($session['os'] === '' && $lead['os'] !== '') $session['os'] = $lead['os'];
    if ($session['utm_source'] === '' && $lead['utm_source'] !== '') $session['utm_source'] = $lead['utm_source'];
    if ($session['utm_medium'] === '' && $lead['utm_medium'] !== '') $session['utm_medium'] = $lead['utm_medium'];
    if ($session['utm_campaign'] === '' && $lead['utm_campaign'] !== '') $session['utm_campaign'] = $lead['utm_campaign'];
    if ($session['referral_code'] === '' && $lead['referral_code'] !== '') $session['referral_code'] = $lead['referral_code'];
    if ($session['partner_code'] === '' && $lead['partner_code'] !== '') $session['partner_code'] = $lead['partner_code'];
    if ($session['partner_name'] === '' && $lead['partner_name'] !== '') $session['partner_name'] = $lead['partner_name'];
    if ($session['partner_instagram'] === '' && $lead['partner_instagram'] !== '') $session['partner_instagram'] = $lead['partner_instagram'];
    if ($session['partner_instagram_url'] === '' && $lead['partner_instagram_url'] !== '') $session['partner_instagram_url'] = $lead['partner_instagram_url'];
    if ((int)$session['partner_trial_days'] <= 0 && (int)$lead['partner_trial_days'] > 0) $session['partner_trial_days'] = (int)$lead['partner_trial_days'];
    if ($session['partner_signup_url'] === '' && !empty($lead['partner_signup_url'])) $session['partner_signup_url'] = $lead['partner_signup_url'];
    if ((int)$session['screen_width'] <= 0 && (int)$lead['screen_width'] > 0) $session['screen_width'] = (int)$lead['screen_width'];
    if ((int)$session['screen_height'] <= 0 && (int)$lead['screen_height'] > 0) $session['screen_height'] = (int)$lead['screen_height'];

    $session['form_viewed'] = true;
    $session['form_started'] = true;
    $session['submit_attempted'] = true;
    $session['submit_succeeded'] = true;
    $session['lead_count']++;
    $session['lead_timestamps'][] = $lead['timestamp'];
    $session['lead_ids'][] = $lead['id'];
    $session['lead_names'][] = $lead['name'];
    $session['lead_statuses'][] = $lead['lead_status'];
    $session['lead_origin_cta_id'] = $lead['cta_id'];
    $session['lead_origin_section_id'] = $lead['section_id'];
    $session['max_scroll_percent'] = max((int)$session['max_scroll_percent'], (int)$lead['scroll_percent']);
    $session['time_on_page'] = max((int)$session['time_on_page'], (int)$lead['time_on_page']);

    foreach ((array)$lead['seen_sections'] as $sectionId) {
        $safeSection = landing_insights_normalize_section_id($sectionId);
        if ($safeSection === '') continue;
        if (!isset($session['sections'][$safeSection])) {
            $session['sections'][$safeSection] = $lead['created_at'];
        }
        if (!isset($session['section_scroll'][$safeSection])) {
            $session['section_scroll'][$safeSection] = [];
        }
        $session['section_scroll'][$safeSection][] = (int)$lead['scroll_percent'];
        if ($safeSection === 'hero') {
            $session['hero_seen'] = true;
        }
    }
}

function landing_insights_unique_count($values)
{
    $map = [];
    foreach ((array)$values as $value) {
        $safe = trim((string)$value);
        if ($safe === '') continue;
        $map[$safe] = true;
    }
    return count($map);
}

function landing_insights_metric_status($metricId, $value)
{
    global $currentAnalyticsSampleVisitors;
    $sampleVisitors = (int)($currentAnalyticsSampleVisitors ?? 0);
    if ($sampleVisitors < 30) {
        return 'Coletando dados';
    }

    switch ($metricId) {
        case 'visitor_to_lead':
            if ($value >= 8) return 'Bom';
            if ($value >= 3) return 'Atencao';
            return 'Critico';
        case 'click_to_lead':
            if ($value > 30) return 'Bom';
            if ($value >= 15) return 'Atencao';
            return 'Critico';
        case 'cta_clicks':
            $heroRate = (float)($GLOBALS['currentAnalyticsHeroToCtaRate'] ?? 0);
            if ($heroRate > 20) return 'Bom';
            if ($heroRate >= 10) return 'Atencao';
            return 'Critico';
        case 'leads':
            if ($value > 0) return 'Coletando dados';
            return 'Atencao';
        default:
            return 'Bom';
    }
}

function landing_insights_delta($current, $previous)
{
    $currentValue = (float)$current;
    $previousValue = (float)$previous;
    if ($previousValue <= 0) {
        return null;
    }

    return round((($currentValue - $previousValue) / $previousValue) * 100, 1);
}

function landing_insights_build_cards($current, $previous)
{
    $definitions = [
        'unique_visitors' => ['label' => 'Visitantes unicos', 'description' => 'Pessoas deduplicadas no periodo'],
        'page_views' => ['label' => 'Views da landing', 'description' => 'Visualizacoes deduplicadas por entrada real'],
        'sessions' => ['label' => 'Sessoes', 'description' => 'Entradas e retornos dentro do periodo'],
        'cta_clicks' => ['label' => 'Cliques em CTA', 'description' => 'Cliques totais nos CTAs da landing'],
        'leads' => ['label' => 'Leads capturados', 'description' => 'Leads salvos na lista de acesso'],
        'visitor_to_lead' => ['label' => 'Conversao visitante -> lead', 'description' => 'Leads sobre visitantes unicos'],
        'click_to_lead' => ['label' => 'Conversao clique -> lead', 'description' => 'Leads sobre cliques em CTA'],
    ];

    $cards = [];
    foreach ($definitions as $key => $meta) {
        $value = $current[$key] ?? 0;
        $delta = landing_insights_delta($value, $previous[$key] ?? 0);
        $cards[] = [
            'id' => $key,
            'label' => $meta['label'],
            'description' => $meta['description'],
            'value' => $value,
            'delta' => $delta,
            'status' => landing_insights_metric_status($key, $value),
        ];
    }

    return $cards;
}

function landing_insights_build_diagnostics($analytics)
{
    $items = [];
    $actions = [];
    $uniqueVisitors = (int)($analytics['summary']['unique_visitors'] ?? 0);
    $heroToCta = (float)($analytics['summary']['hero_to_cta_rate'] ?? 0);
    $clickToLead = (float)($analytics['summary']['click_to_lead'] ?? 0);
    $problemReach = (float)($analytics['section_lookup']['problem']['visitors_percent'] ?? 0);
    $featuresReach = (float)($analytics['section_lookup']['features']['visitors_percent'] ?? 0);
    $featuresClicks = (int)($analytics['section_lookup']['features']['clicks_after'] ?? 0);
    $mobileShare = (float)($analytics['device_summary']['mobile_share'] ?? 0);
    $mobileConversion = (float)($analytics['device_summary']['mobile_conversion'] ?? 0);
    $desktopConversion = (float)($analytics['device_summary']['desktop_conversion'] ?? 0);
    $finalFormReach = (float)($analytics['section_lookup']['final-form']['visitors_percent'] ?? 0);
    $finalFormConversion = (float)($analytics['cta_lookup']['final_form_submit']['post_click_conversion'] ?? 0);
    $secondaryClicks = (int)($analytics['cta_lookup']['hero_secondary_features']['clicks'] ?? 0);
    $secondaryLeads = (int)($analytics['cta_lookup']['hero_secondary_features']['leads_after_click'] ?? 0);

    if ($uniqueVisitors < 30) {
        return [
            'items' => [[
                'status' => 'Coletando dados',
                'problem' => 'Dados ainda insuficientes',
                'cause' => 'O periodo selecionado tem poucos visitantes para avaliar conversao com seguranca.',
                'action' => 'Use links com UTM, divulgue a landing e colete pelo menos 30 visitantes unicos.',
                'confidence' => 'Baixa',
            ]],
            'next_actions' => [
                ['priority' => 'Alta', 'title' => 'Gerar trafego rastreavel', 'description' => 'Use links com UTM para Instagram, WhatsApp e parceiros.'],
                ['priority' => 'Media', 'title' => 'Testar fluxo de cadastro', 'description' => 'Preencha o formulario e confirme se o lead aparece no tracker.'],
                ['priority' => 'Baixa', 'title' => 'Aguardar mais volume', 'description' => 'Evite alterar a copy com base em 1 ou 2 visitantes.'],
            ],
        ];
    }

    $confidence = $uniqueVisitors >= 100 ? 'Alta' : 'Media';

    if ($heroToCta < 10) {
        $items[] = [
            'status' => 'Critico',
            'problem' => 'Poucos visitantes estao clicando no CTA principal.',
            'cause' => 'A hero pode nao estar comunicando a dor com forca suficiente.',
            'action' => 'Testar uma headline mais direta sobre prazos, pagamentos e campanhas espalhadas.',
            'confidence' => $confidence,
        ];
        $actions[] = ['priority' => 'Alta', 'title' => 'Reforcar hero e CTA principal', 'description' => 'Aumente clareza de dor, contraste do CTA e forca da promessa acima da dobra.'];
    }

    if ($heroToCta >= 10 && $clickToLead < 20) {
        $items[] = [
            'status' => 'Atencao',
            'problem' => 'O CTA gera interesse, mas o formulario esta travando conversao.',
            'cause' => 'Friccao no formulario, validacao ou baixa confianca no momento final.',
            'action' => 'Revisar validacao, feedback de erro e explicacao curta do campo Instagram.',
            'confidence' => $confidence,
        ];
        $actions[] = ['priority' => 'Alta', 'title' => 'Reduzir friccao no formulario', 'description' => 'Revise validacoes, feedback de erro e microcopy do cadastro final.'];
    }

    if ($problemReach > 0 && $problemReach < 60) {
        $items[] = [
            'status' => 'Critico',
            'problem' => 'Muita gente abandona antes da secao de problema.',
            'cause' => 'A primeira dobra nao esta segurando atencao suficiente.',
            'action' => 'Melhorar promessa, densidade de dor e contraste do CTA na hero.',
            'confidence' => $confidence,
        ];
        $actions[] = ['priority' => 'Alta', 'title' => 'Segurar mais atencao na primeira dobra', 'description' => 'Ajuste headline, subtitulo e CTA para aumentar scroll ate a secao de problema.'];
    }

    if ($featuresReach >= 35 && $featuresClicks <= 2) {
        $items[] = [
            'status' => 'Atencao',
            'problem' => 'As funcionalidades estao sendo vistas, mas nao estao gerando acao.',
            'cause' => 'Os textos ainda podem estar mais focados em feature do que em resultado.',
            'action' => 'Reforcar ganhos praticos: receber pagamentos, evitar atraso e organizar campanhas.',
            'confidence' => $confidence,
        ];
        $actions[] = ['priority' => 'Media', 'title' => 'Reescrever beneficios das funcionalidades', 'description' => 'Troque linguagem de feature por resultado operacional tangivel.'];
    }

    if ($mobileShare >= 60 && $desktopConversion > 0 && $mobileConversion < ($desktopConversion * 0.7)) {
        $items[] = [
            'status' => 'Atencao',
            'problem' => 'A conversao mobile esta abaixo do esperado.',
            'cause' => 'Layout mobile, CTA ou formulario podem estar com friccao.',
            'action' => 'Revisar espacamento, tamanho dos botoes e clareza do formulario no mobile.',
            'confidence' => $confidence,
        ];
        $actions[] = ['priority' => 'Media', 'title' => 'Priorizar otimizacao mobile', 'description' => 'O maior volume vem do mobile e a conversao esta abaixo do desktop.'];
    }

    if ($secondaryClicks >= 4 && $secondaryLeads === 0) {
        $items[] = [
            'status' => 'Atencao',
            'problem' => 'O CTA secundario esta gerando clique, mas pouco lead.',
            'cause' => 'O link Ver funcionalidades pode estar desviando atencao do CTA principal.',
            'action' => 'Manter o CTA secundario discreto e priorizar a acao primaria da hero.',
            'confidence' => $confidence,
        ];
        $actions[] = ['priority' => 'Baixa', 'title' => 'Reduzir competicao do CTA secundario', 'description' => 'Mantenha o link de apoio discreto para nao roubar o clique principal.'];
    }

    if ($finalFormReach < 15 && $finalFormConversion >= 40) {
        $items[] = [
            'status' => 'Atencao',
            'problem' => 'Pouca gente chega ao formulario final, apesar de ele converter bem.',
            'cause' => 'A pagina pode estar longa demais ou perdendo forca antes do fim.',
            'action' => 'Levar mais trafego qualificado ate o final com CTA intermediario e narrativa mais curta.',
            'confidence' => $confidence,
        ];
        $actions[] = ['priority' => 'Media', 'title' => 'Levar mais pessoas ate o formulario final', 'description' => 'A pagina converte no fim, mas o alcance do bloco final ainda esta baixo.'];
    }

    if (!$items) {
        $items[] = [
            'status' => 'Bom',
            'problem' => 'Nao ha gargalo dominante no periodo selecionado.',
            'cause' => 'O funil esta relativamente equilibrado para o volume atual.',
            'action' => 'Continue coletando dados e rode testes de copy ou CTA com impacto controlado.',
            'confidence' => $confidence,
        ];
        $actions[] = ['priority' => 'Baixa', 'title' => 'Manter instrumentacao limpa', 'description' => 'Continue acumulando dados antes de mexer em varios elementos ao mesmo tempo.'];
    }

    $prioritizedActions = [];
    foreach ($actions as $action) {
        if (!is_array($action)) continue;
        $safeKey = trim((string)($action['priority'] ?? '')) . '|' . trim((string)($action['title'] ?? ''));
        if ($safeKey === '|') continue;
        if (isset($prioritizedActions[$safeKey])) continue;
        $prioritizedActions[$safeKey] = $action;
        if (count($prioritizedActions) >= 3) break;
    }

    return [
        'items' => $items,
        'next_actions' => array_values($prioritizedActions),
    ];
}

function landing_insights_build_analytics($events, $leads, $range, $allFilteredEvents)
{
    usort($events, function ($a, $b) {
        return ($a['timestamp'] ?? 0) <=> ($b['timestamp'] ?? 0);
    });
    usort($leads, function ($a, $b) {
        return ($a['timestamp'] ?? 0) <=> ($b['timestamp'] ?? 0);
    });

    $sessions = [];
    foreach ($events as $event) {
        $sessionId = $event['session_id'];
        if (!isset($sessions[$sessionId])) {
            $sessions[$sessionId] = landing_insights_empty_session($sessionId, $event['visitor_id']);
        }
        landing_insights_apply_session_event($sessions[$sessionId], $event);
    }

    foreach ($leads as $lead) {
        $sessionId = $lead['session_id'];
        if (!isset($sessions[$sessionId])) {
            $sessions[$sessionId] = landing_insights_empty_session($sessionId, $lead['visitor_id']);
        }
        landing_insights_merge_lead_into_session($sessions[$sessionId], $lead);
    }

    $sessionList = array_values($sessions);
    $visitorIds = [];
    foreach ($sessionList as $session) {
        $visitorIds[] = $session['visitor_id'];
    }

    $uniqueVisitors = landing_insights_unique_count($visitorIds);
    $sessionCount = count($sessionList);
    $ctaClickCount = 0;
    $heroVisitors = [];
    $ctaVisitors = [];
    $formStartVisitors = [];
    $formSubmitVisitors = [];
    $leadVisitors = [];
    $formViewVisitors = [];
    $submitErrorCount = 0;

    $sectionRows = [];
    foreach (LANDING_SECTIONS_ORDER as $sectionId) {
        $sectionRows[$sectionId] = [
            'id' => $sectionId,
            'label' => landing_insights_section_label($sectionId),
            'visitors' => 0,
            'visitors_percent' => 0,
            'avg_time_seconds' => 0,
            'avg_scroll_percent' => 0,
            'clicks_after' => 0,
            'leads_influenced' => 0,
            'advance_rate' => null,
            'advance_count' => 0,
            'drop_percent' => 0,
        ];
    }

    $sectionAgg = [];
    $ctaAgg = [];
    $channelAgg = [];
    $utmAgg = [];
    $referrerAgg = [];
    $deviceAgg = [];
    $partnerAgg = [];
    $fieldAgg = [
        'name' => ['reached' => 0, 'abandoned' => 0],
        'whatsapp' => ['reached' => 0, 'abandoned' => 0],
        'instagram' => ['reached' => 0, 'abandoned' => 0],
        'submit' => ['reached' => 0, 'abandoned' => 0],
    ];

    foreach ($sessionList as $session) {
        $visitorId = $session['visitor_id'];
        $hasLead = (int)$session['lead_count'] > 0;
        $hasFormStart = !empty($session['form_started']);
        $hasSubmitAttempt = !empty($session['submit_attempted']);
        $hasFormView = !empty($session['form_viewed']) || isset($session['sections']['final-form']);
        $ctaClickCount += (int)$session['cta_clicks_total'];
        $submitErrorCount += count($session['form_errors']);

        if (!empty($session['hero_seen']) || !empty($session['page_views'])) $heroVisitors[$visitorId] = true;
        if ((int)$session['cta_clicks_total'] > 0) $ctaVisitors[$visitorId] = true;
        if ($hasFormStart) $formStartVisitors[$visitorId] = true;
        if ($hasSubmitAttempt) $formSubmitVisitors[$visitorId] = true;
        if ($hasLead) $leadVisitors[$visitorId] = true;
        if ($hasFormView) $formViewVisitors[$visitorId] = true;

        $channel = $session['channel'] !== '' ? $session['channel'] : 'Direto';
        $sourceLabel = $session['source_label'] !== '' ? $session['source_label'] : 'Direto';
        $referrer = $session['referrer_host'] !== '' ? $session['referrer_host'] : 'Direto';
        $deviceLabel = landing_insights_device_label($session['device_type']);
        $deviceKey = strtolower($deviceLabel);
        $utmKey = implode('|', [
            $session['utm_source'] ?: 'sem_source',
            $session['utm_medium'] ?: 'sem_medium',
            $session['utm_campaign'] ?: 'sem_campaign',
        ]);

        if (!isset($channelAgg[$channel])) {
            $channelAgg[$channel] = ['channel' => $channel, 'visitors' => [], 'sessions' => 0, 'cta_clicks' => 0, 'leads' => 0];
        }
        $channelAgg[$channel]['visitors'][$visitorId] = true;
        $channelAgg[$channel]['sessions']++;
        $channelAgg[$channel]['cta_clicks'] += (int)$session['cta_clicks_total'];
        if ($hasLead) $channelAgg[$channel]['leads'] += (int)$session['lead_count'];

        if (!isset($referrerAgg[$referrer])) {
            $referrerAgg[$referrer] = ['origin' => $referrer, 'visitors' => [], 'leads' => 0];
        }
        $referrerAgg[$referrer]['visitors'][$visitorId] = true;
        if ($hasLead) $referrerAgg[$referrer]['leads'] += (int)$session['lead_count'];

        if (!isset($utmAgg[$utmKey])) {
            $utmAgg[$utmKey] = [
                'utm_source' => $session['utm_source'] !== '' ? $session['utm_source'] : 'Sem source',
                'utm_medium' => $session['utm_medium'] !== '' ? $session['utm_medium'] : 'Sem medium',
                'utm_campaign' => $session['utm_campaign'] !== '' ? $session['utm_campaign'] : 'Sem campaign',
                'visitors' => [],
                'clicks' => 0,
                'leads' => 0,
            ];
        }
        $utmAgg[$utmKey]['visitors'][$visitorId] = true;
        $utmAgg[$utmKey]['clicks'] += (int)$session['cta_clicks_total'];
        if ($hasLead) $utmAgg[$utmKey]['leads'] += (int)$session['lead_count'];

        if (!isset($deviceAgg[$deviceKey])) {
            $deviceAgg[$deviceKey] = [
                'device' => $deviceLabel,
                'visitors' => [],
                'sessions' => 0,
                'cta_clicks' => 0,
                'form_starts' => 0,
                'leads' => 0,
                'time_total' => 0,
                'scroll_total' => 0,
            ];
        }
        $deviceAgg[$deviceKey]['visitors'][$visitorId] = true;
        $deviceAgg[$deviceKey]['sessions']++;
        $deviceAgg[$deviceKey]['cta_clicks'] += (int)$session['cta_clicks_total'];
        if ($hasFormStart) $deviceAgg[$deviceKey]['form_starts']++;
        if ($hasLead) $deviceAgg[$deviceKey]['leads'] += (int)$session['lead_count'];
        $deviceAgg[$deviceKey]['time_total'] += (int)$session['time_on_page'];
        $deviceAgg[$deviceKey]['scroll_total'] += (int)$session['max_scroll_percent'];

        $partnerDetails = landing_insights_resolve_partner_details(
            $session['referral_code'],
            $session['partner_code'],
            $session['partner_name']
        );
        $partnerKey = trim((string)$partnerDetails['partner_code']);
        if ($partnerKey === '' && trim((string)$partnerDetails['partner_name']) !== '') {
            $partnerKey = strtolower(trim((string)$partnerDetails['partner_name']));
        }
        if ($partnerKey === '') {
            $partnerKey = 'organico';
        }
        if (!isset($partnerAgg[$partnerKey])) {
            $partnerAgg[$partnerKey] = [
                'partner_code' => $partnerDetails['partner_code'],
                'partner_name' => $partnerDetails['partner_name'] !== '' ? $partnerDetails['partner_name'] : 'Sem parceiro / Organico',
                'partner_instagram' => $partnerDetails['partner_instagram'],
                'partner_instagram_url' => $partnerDetails['partner_instagram_url'],
                'referral_code' => $partnerDetails['referral_code'],
                'trial_days' => (int)$partnerDetails['partner_trial_days'],
                'signup_url' => $partnerDetails['signup_url'],
                'views' => 0,
                'sessions' => 0,
                'unique_visitors' => [],
                'leads' => 0,
                'last_lead_at' => '',
            ];
        }
        $partnerAgg[$partnerKey]['views'] += max(1, (int)$session['page_views']);
        $partnerAgg[$partnerKey]['sessions']++;
        $partnerAgg[$partnerKey]['unique_visitors'][$visitorId] = true;
        if ($hasLead) {
            $partnerAgg[$partnerKey]['leads'] += (int)$session['lead_count'];
            $lastLeadTimestamp = !empty($session['lead_timestamps']) ? max($session['lead_timestamps']) : landing_insights_timestamp($session['last_seen_at']);
            $lastLeadAt = $lastLeadTimestamp > 0 ? landing_insights_iso($lastLeadTimestamp) : '';
            if ($lastLeadAt !== '' && ($partnerAgg[$partnerKey]['last_lead_at'] === '' || landing_insights_timestamp($lastLeadAt) > landing_insights_timestamp($partnerAgg[$partnerKey]['last_lead_at']))) {
                $partnerAgg[$partnerKey]['last_lead_at'] = $lastLeadAt;
            }
        }

        $orderedSections = [];
        foreach ((array)$session['sections'] as $sectionId => $timestampIso) {
            $orderedSections[] = [
                'id' => $sectionId,
                'timestamp' => landing_insights_timestamp($timestampIso),
            ];
        }
        usort($orderedSections, function ($a, $b) {
            return ($a['timestamp'] ?? 0) <=> ($b['timestamp'] ?? 0);
        });

        if (!$orderedSections && !empty($session['page_views'])) {
            $orderedSections[] = ['id' => 'hero', 'timestamp' => landing_insights_timestamp($session['first_seen_at'])];
        }

        $leadReferenceTs = !empty($session['lead_timestamps']) ? min($session['lead_timestamps']) : landing_insights_timestamp($session['last_seen_at']);
        foreach ($orderedSections as $index => $sectionData) {
            $sectionId = $sectionData['id'];
            if (!isset($sectionAgg[$sectionId])) {
                $sectionAgg[$sectionId] = [
                    'visitors' => [],
                    'time_total' => 0,
                    'time_count' => 0,
                    'scroll_total' => 0,
                    'scroll_count' => 0,
                    'clicks_after' => 0,
                    'leads_influenced' => 0,
                    'advance_from_here' => 0,
                    'advance_base' => 0,
                ];
            }

            $sectionAgg[$sectionId]['visitors'][$visitorId] = true;
            $sectionAgg[$sectionId]['advance_base']++;

            $nextSectionTs = isset($orderedSections[$index + 1]) ? (int)$orderedSections[$index + 1]['timestamp'] : landing_insights_timestamp($session['last_seen_at']);
            $duration = max(0, $nextSectionTs - (int)$sectionData['timestamp']);
            if ($duration > 0) {
                $sectionAgg[$sectionId]['time_total'] += $duration;
                $sectionAgg[$sectionId]['time_count']++;
            }

            $sectionScrollValues = is_array($session['section_scroll'][$sectionId] ?? null) ? $session['section_scroll'][$sectionId] : [];
            if ($sectionScrollValues) {
                $sectionAgg[$sectionId]['scroll_total'] += array_sum($sectionScrollValues) / count($sectionScrollValues);
                $sectionAgg[$sectionId]['scroll_count']++;
            }

            foreach ((array)$session['cta_events'] as $ctaEvent) {
                if ((int)$ctaEvent['timestamp'] >= (int)$sectionData['timestamp']) {
                    $sectionAgg[$sectionId]['clicks_after']++;
                }
            }

            if ($hasLead && (int)$sectionData['timestamp'] <= $leadReferenceTs) {
                $sectionAgg[$sectionId]['leads_influenced'] += (int)$session['lead_count'];
            }

            if (isset($orderedSections[$index + 1])) {
                $sectionAgg[$sectionId]['advance_from_here']++;
            }
        }

        foreach ((array)$session['cta_events'] as $ctaEvent) {
            $meta = landing_insights_cta_meta($ctaEvent['cta_id'], $ctaEvent['cta_label']);
            $ctaKey = $meta['id'] !== '' ? $meta['id'] : strtolower($meta['label']);
            if (!isset($ctaAgg[$ctaKey])) {
                $ctaAgg[$ctaKey] = [
                    'id' => $meta['id'],
                    'label' => $meta['label'],
                    'location' => $meta['location'],
                    'clicks' => 0,
                    'visitors' => [],
                    'form_starts_after_click' => 0,
                    'leads_after_click' => 0,
                ];
            }

            $ctaAgg[$ctaKey]['clicks']++;
            $ctaAgg[$ctaKey]['visitors'][$visitorId] = true;

            $ctaTs = (int)$ctaEvent['timestamp'];
            $formStartTs = landing_insights_timestamp($session['field_focuses']['name'] ?? '') ?: landing_insights_timestamp($session['first_seen_at']);
            if ($hasFormStart && $formStartTs >= $ctaTs) {
                $ctaAgg[$ctaKey]['form_starts_after_click']++;
            }
            if ($hasLead && $leadReferenceTs >= $ctaTs) {
                $ctaAgg[$ctaKey]['leads_after_click'] += (int)$session['lead_count'];
            }
        }

        $fieldOrder = ['name' => 1, 'whatsapp' => 2, 'instagram' => 3];
        $furthest = 0;
        foreach ($fieldOrder as $field => $index) {
            if (isset($session['field_focuses'][$field])) {
                $furthest = max($furthest, $index);
            }
        }
        if ($hasSubmitAttempt) $furthest = max($furthest, 4);
        if ($hasLead) $furthest = max($furthest, 5);

        if ($hasFormView || $hasFormStart || $hasSubmitAttempt || $hasLead) {
            $fieldAgg['name']['reached']++;
        }
        if ($furthest >= 2) {
            $fieldAgg['whatsapp']['reached']++;
        }
        if ($furthest >= 3) {
            $fieldAgg['instagram']['reached']++;
        }
        if ($furthest >= 4) {
            $fieldAgg['submit']['reached']++;
        }

        if (!$hasLead) {
            if ($furthest <= 1 && ($hasFormView || $hasFormStart)) $fieldAgg['name']['abandoned']++;
            if ($furthest === 2) $fieldAgg['whatsapp']['abandoned']++;
            if ($furthest === 3) $fieldAgg['instagram']['abandoned']++;
            if ($furthest >= 4) $fieldAgg['submit']['abandoned']++;
        }
    }

    $visitorsTotal = max(1, $uniqueVisitors);
    foreach ($sectionRows as $sectionId => &$row) {
        $agg = $sectionAgg[$sectionId] ?? null;
        if (!$agg) continue;

        $visitorCount = landing_insights_unique_count(array_keys($agg['visitors']));
        $row['visitors'] = $visitorCount;
        $row['visitors_percent'] = landing_insights_percent($visitorCount, $visitorsTotal, 1);
        $row['avg_time_seconds'] = $agg['time_count'] > 0 ? round($agg['time_total'] / $agg['time_count']) : 0;
        $row['avg_scroll_percent'] = $agg['scroll_count'] > 0 ? round($agg['scroll_total'] / $agg['scroll_count'], 1) : 0;
        $row['clicks_after'] = (int)$agg['clicks_after'];
        $row['leads_influenced'] = (int)$agg['leads_influenced'];
        $row['advance_count'] = (int)$agg['advance_from_here'];
        $row['advance_rate'] = $agg['advance_base'] > 0 ? landing_insights_percent($agg['advance_from_here'], $agg['advance_base'], 1) : null;
        $row['drop_percent'] = round(100 - (float)($row['advance_rate'] ?? 0), 1);
    }
    unset($row);

    $ctaRows = [];
    foreach (landing_insights_label_map_ctas() as $ctaId => $meta) {
        $agg = $ctaAgg[$ctaId] ?? ['clicks' => 0, 'visitors' => [], 'form_starts_after_click' => 0, 'leads_after_click' => 0];
        $visitorClicks = landing_insights_unique_count(array_keys($agg['visitors']));
        $clicks = (int)($agg['clicks'] ?? 0);
        $leadsAfter = (int)($agg['leads_after_click'] ?? 0);
        $postClickConversion = $clicks > 0 ? landing_insights_percent($leadsAfter, $clicks, 1) : 0;

        $status = 'Critico';
        if ($postClickConversion >= 25) {
            $status = 'Bom';
        } elseif ($postClickConversion >= 10 || $clicks > 0) {
            $status = 'Atencao';
        }

        $ctaRows[] = [
            'id' => $ctaId,
            'label' => $meta['label'],
            'location' => $meta['location'],
            'clicks' => $clicks,
            'visitors_percent' => landing_insights_percent($visitorClicks, $visitorsTotal, 1),
            'forms_started_after_click' => (int)($agg['form_starts_after_click'] ?? 0),
            'leads_after_click' => $leadsAfter,
            'post_click_conversion' => $postClickConversion,
            'status' => $status,
        ];
    }

    $formViewCount = count($formViewVisitors);
    $formStartCount = count($formStartVisitors);
    $formSubmitCount = count($formSubmitVisitors);
    $leadVisitorCount = count($leadVisitors);

    $formFieldRows = [];
    foreach (['name' => 'Nome', 'whatsapp' => 'WhatsApp', 'instagram' => 'Instagram', 'submit' => 'Envio'] as $fieldId => $label) {
        $reached = (int)$fieldAgg[$fieldId]['reached'];
        $abandoned = (int)$fieldAgg[$fieldId]['abandoned'];
        $formFieldRows[] = [
            'id' => $fieldId,
            'label' => $label,
            'reached' => $reached,
            'abandoned' => $abandoned,
            'abandon_rate' => $reached > 0 ? landing_insights_percent($abandoned, $reached, 1) : 0,
        ];
    }

    $channels = [];
    foreach ($channelAgg as $row) {
        $visitorCount = landing_insights_unique_count(array_keys($row['visitors']));
        $channels[] = [
            'channel' => $row['channel'],
            'visitors' => $visitorCount,
            'sessions' => (int)$row['sessions'],
            'cta_clicks' => (int)$row['cta_clicks'],
            'leads' => (int)$row['leads'],
            'conversion' => $visitorCount > 0 ? landing_insights_percent($row['leads'], $visitorCount, 1) : 0,
        ];
    }
    usort($channels, function ($a, $b) {
        return ($b['visitors'] ?? 0) <=> ($a['visitors'] ?? 0);
    });

    $utmRows = [];
    foreach ($utmAgg as $row) {
        $visitorCount = landing_insights_unique_count(array_keys($row['visitors']));
        $utmRows[] = [
            'utm_source' => $row['utm_source'],
            'utm_medium' => $row['utm_medium'],
            'utm_campaign' => $row['utm_campaign'],
            'visitors' => $visitorCount,
            'clicks' => (int)$row['clicks'],
            'leads' => (int)$row['leads'],
            'conversion' => $visitorCount > 0 ? landing_insights_percent($row['leads'], $visitorCount, 1) : 0,
        ];
    }
    usort($utmRows, function ($a, $b) {
        return ($b['visitors'] ?? 0) <=> ($a['visitors'] ?? 0);
    });

    $referrerRows = [];
    foreach ($referrerAgg as $row) {
        $visitorCount = landing_insights_unique_count(array_keys($row['visitors']));
        $referrerRows[] = [
            'origin' => $row['origin'],
            'visitors' => $visitorCount,
            'leads' => (int)$row['leads'],
            'conversion' => $visitorCount > 0 ? landing_insights_percent($row['leads'], $visitorCount, 1) : 0,
        ];
    }
    usort($referrerRows, function ($a, $b) {
        return ($b['visitors'] ?? 0) <=> ($a['visitors'] ?? 0);
    });

    $deviceRows = [];
    foreach ($deviceAgg as $row) {
        $visitorCount = landing_insights_unique_count(array_keys($row['visitors']));
        $deviceRows[] = [
            'device' => $row['device'],
            'visitors' => $visitorCount,
            'sessions' => (int)$row['sessions'],
            'cta_clicks' => (int)$row['cta_clicks'],
            'form_starts' => (int)$row['form_starts'],
            'leads' => (int)$row['leads'],
            'conversion' => $visitorCount > 0 ? landing_insights_percent($row['leads'], $visitorCount, 1) : 0,
            'avg_time_seconds' => (int)$row['sessions'] > 0 ? round($row['time_total'] / $row['sessions']) : 0,
            'avg_scroll_percent' => (int)$row['sessions'] > 0 ? round($row['scroll_total'] / $row['sessions'], 1) : 0,
        ];
    }
    usort($deviceRows, function ($a, $b) {
        return ($b['visitors'] ?? 0) <=> ($a['visitors'] ?? 0);
    });

    $partnerRows = [];
    foreach ($partnerAgg as $row) {
        $visitorCount = landing_insights_unique_count(array_keys($row['unique_visitors']));
        $partnerRows[] = [
            'partner_code' => $row['partner_code'],
            'partner_name' => $row['partner_name'],
            'partner_instagram' => $row['partner_instagram'],
            'partner_instagram_url' => $row['partner_instagram_url'],
            'referral_code' => $row['referral_code'],
            'trial_days' => (int)$row['trial_days'],
            'signup_url' => $row['signup_url'],
            'views' => (int)$row['views'],
            'sessions' => (int)$row['sessions'],
            'unique_visitors' => $visitorCount,
            'leads' => (int)$row['leads'],
            'conversion' => (int)$row['views'] > 0 ? landing_insights_percent($row['leads'], $row['views'], 1) : 0,
            'last_lead_at' => $row['last_lead_at'],
        ];
    }
    usort($partnerRows, function ($a, $b) {
        return ($b['views'] ?? 0) <=> ($a['views'] ?? 0);
    });

    $funnelSteps = [
        ['id' => 'visited', 'label' => 'Visitou a landing', 'count' => $uniqueVisitors],
        ['id' => 'hero', 'label' => 'Viu a hero', 'count' => count($heroVisitors)],
        ['id' => 'cta', 'label' => 'Clicou em algum CTA', 'count' => count($ctaVisitors)],
        ['id' => 'form_start', 'label' => 'Iniciou o formulario', 'count' => $formStartCount],
        ['id' => 'form_submit', 'label' => 'Enviou o formulario', 'count' => $formSubmitCount],
        ['id' => 'lead', 'label' => 'Lead criado', 'count' => $leadVisitorCount],
    ];

    $biggestDrop = ['id' => '', 'label' => '', 'drop_count' => 0, 'drop_percent' => 0];
    foreach ($funnelSteps as $index => &$step) {
        $previousCount = $index > 0 ? (int)$funnelSteps[$index - 1]['count'] : (int)$funnelSteps[0]['count'];
        $currentCount = (int)$step['count'];
        $step['percent_previous'] = $index === 0 ? 100 : landing_insights_percent($currentCount, max(1, $previousCount), 1);
        $step['percent_total'] = landing_insights_percent($currentCount, max(1, $uniqueVisitors), 1);
        $step['drop_count'] = max(0, $previousCount - $currentCount);
        $step['drop_percent'] = $index === 0 ? 0 : landing_insights_percent($step['drop_count'], max(1, $previousCount), 1);

        if ($step['drop_count'] > $biggestDrop['drop_count']) {
            $biggestDrop = [
                'id' => $step['id'],
                'label' => $step['label'],
                'drop_count' => $step['drop_count'],
                'drop_percent' => $step['drop_percent'],
            ];
        }
    }
    unset($step);

    $miniFunnel = [
        ['id' => 'hero_to_cta', 'label' => 'Taxa hero -> CTA', 'value' => landing_insights_percent(count($ctaVisitors), max(1, count($heroVisitors)), 1)],
        ['id' => 'cta_to_form', 'label' => 'Taxa CTA -> formulario iniciado', 'value' => landing_insights_percent($formStartCount, max(1, count($ctaVisitors)), 1)],
        ['id' => 'form_to_lead', 'label' => 'Taxa formulario iniciado -> lead', 'value' => landing_insights_percent($leadVisitorCount, max(1, $formStartCount), 1)],
        ['id' => 'visitor_to_lead', 'label' => 'Taxa visitante -> lead', 'value' => landing_insights_percent($leadVisitorCount, max(1, $uniqueVisitors), 1)],
    ];

    $series = [];
    $dailyVisitors = [];
    $dailyLeads = [];
    foreach ($sessionList as $session) {
        $dayKey = landing_insights_day_key($session['first_seen_at']);
        if ($dayKey === '') continue;
        if (!isset($dailyVisitors[$dayKey])) $dailyVisitors[$dayKey] = [];
        $dailyVisitors[$dayKey][$session['visitor_id']] = true;
    }
    foreach ($leads as $lead) {
        $dayKey = landing_insights_day_key($lead['created_at']);
        if ($dayKey === '') continue;
        $dailyLeads[$dayKey] = ($dailyLeads[$dayKey] ?? 0) + 1;
    }
    for ($cursor = (int)$range['start']; $cursor <= (int)$range['end']; $cursor += 86400) {
        $dayKey = gmdate('Y-m-d', $cursor);
        $series[] = [
            'date' => $dayKey,
            'label' => gmdate('d/m', $cursor),
            'visitors' => isset($dailyVisitors[$dayKey]) ? count($dailyVisitors[$dayKey]) : 0,
            'leads' => (int)($dailyLeads[$dayKey] ?? 0),
        ];
    }

    $technicalEvents = [];
    $eventsSortedDesc = $allFilteredEvents;
    usort($eventsSortedDesc, function ($a, $b) {
        return ($b['timestamp'] ?? 0) <=> ($a['timestamp'] ?? 0);
    });
    foreach ($eventsSortedDesc as $event) {
        $ctaMeta = landing_insights_cta_meta($event['cta_id'], $event['cta_label']);
        $technicalEvents[] = [
            'date' => $event['created_at'],
            'visitor_id' => $event['visitor_id'],
            'session_id' => $event['session_id'],
            'page_instance_id' => $event['page_instance_id'],
            'event_name' => $event['event_name'],
            'section_id' => $event['section_id'],
            'section_label' => landing_insights_section_label($event['section_id']),
            'cta_id' => $event['cta_id'],
            'cta_label' => $ctaMeta['label'],
            'partner_code' => $event['partner_code'],
            'referral_code' => $event['referral_code'],
            'channel' => $event['channel'],
            'device' => landing_insights_device_label($event['device_type']),
            'scroll_percent' => (int)$event['scroll_percent'],
            'time_on_page' => (int)$event['time_on_page'],
            'lead_created' => $event['event_name'] === 'lead_created',
            'error' => $event['event_name'] === 'form_error' ? $event['message'] : '',
            'data_source' => landing_insights_string($event['data_source'] ?? 'novo_tracker', 'novo_tracker'),
        ];
    }

    $leadRows = [];
    usort($leads, function ($a, $b) {
        return ($b['timestamp'] ?? 0) <=> ($a['timestamp'] ?? 0);
    });
    foreach ($leads as $lead) {
        $leadRows[] = [
            'id' => $lead['id'],
            'created_at' => $lead['created_at'],
            'name' => $lead['name'],
            'phone' => $lead['phone'],
            'instagram' => $lead['instagram'],
            'instagram_username' => $lead['instagram_username'],
            'instagram_url' => $lead['instagram_url'],
            'channel' => $lead['channel'],
            'source_label' => $lead['source_label'],
            'partner_name' => $lead['partner_name'],
            'partner_code' => $lead['partner_code'],
            'referral_code' => $lead['referral_code'],
            'partner_instagram' => $lead['partner_instagram'],
            'partner_instagram_url' => $lead['partner_instagram_url'],
            'partner_trial_days' => $lead['partner_trial_days'],
            'partner_signup_url' => $lead['partner_signup_url'],
            'utm_source' => $lead['utm_source'],
            'utm_medium' => $lead['utm_medium'],
            'campaign' => $lead['campaign'],
            'cta_id' => $lead['cta_id'],
            'cta_label' => $lead['cta_meta']['label'],
            'section_id' => $lead['section_id'],
            'section_label' => $lead['section_label'],
            'status' => $lead['lead_status'],
            'status_label' => landing_insights_lead_status_label($lead['lead_status']),
            'visitor_id' => $lead['visitor_id'],
            'session_id' => $lead['session_id'],
            'device_label' => $lead['device_label'],
            'data_source' => $lead['data_source'],
            'is_partial' => !empty($lead['is_partial']),
        ];
    }

    $summaryCore = [
        'unique_visitors' => $uniqueVisitors,
        'page_views' => array_sum(array_map(function ($session) {
            return max(0, (int)($session['page_views'] ?? 0));
        }, $sessionList)),
        'sessions' => $sessionCount,
        'cta_clicks' => $ctaClickCount,
        'leads' => count($leads),
        'visitor_to_lead' => landing_insights_percent(count($leads), max(1, $uniqueVisitors), 2),
        'click_to_lead' => landing_insights_percent(count($leads), max(1, $ctaClickCount), 1),
        'hero_to_cta_rate' => landing_insights_percent(count($ctaVisitors), max(1, count($heroVisitors)), 1),
        'form_start_rate' => landing_insights_percent($formStartCount, max(1, $formViewCount), 1),
        'form_completion_rate' => landing_insights_percent($leadVisitorCount, max(1, $formStartCount), 1),
        'form_error_count' => $submitErrorCount,
        'avg_time_on_page' => $sessionCount > 0 ? round(array_sum(array_map(function ($session) {
            return (int)$session['time_on_page'];
        }, $sessionList)) / $sessionCount) : 0,
        'avg_scroll_percent' => $sessionCount > 0 ? round(array_sum(array_map(function ($session) {
            return (int)$session['max_scroll_percent'];
        }, $sessionList)) / $sessionCount, 1) : 0,
    ];

    $sectionLookup = [];
    foreach ($sectionRows as $row) {
        $sectionLookup[$row['id']] = $row;
    }
    $ctaLookup = [];
    foreach ($ctaRows as $row) {
        $ctaLookup[$row['id']] = $row;
    }

    $mobileVisitors = 0;
    $mobileConversion = 0;
    $desktopConversion = 0;
    foreach ($deviceRows as $row) {
        if ($row['device'] === 'Mobile') {
            $mobileVisitors = $row['visitors'];
            $mobileConversion = $row['conversion'];
        }
        if ($row['device'] === 'Desktop') {
            $desktopConversion = $row['conversion'];
        }
    }

    return [
        'cards' => $summaryCore,
        'summary' => $summaryCore,
        'funnel' => [
            'steps' => $funnelSteps,
            'biggest_drop' => $biggestDrop,
            'mini_cards' => $miniFunnel,
        ],
        'sections' => array_values($sectionRows),
        'section_lookup' => $sectionLookup,
        'ctas' => $ctaRows,
        'cta_lookup' => $ctaLookup,
        'form' => [
            'viewers' => $formViewCount,
            'started' => $formStartCount,
            'submit_attempts' => $formSubmitCount,
            'leads' => $leadVisitorCount,
            'start_rate' => landing_insights_percent($formStartCount, max(1, $formViewCount), 1),
            'completion_rate' => landing_insights_percent($leadVisitorCount, max(1, $formStartCount), 1),
            'errors' => $submitErrorCount,
            'fields' => $formFieldRows,
        ],
        'acquisition' => [
            'channels' => $channels,
            'utms' => $utmRows,
            'referrers' => $referrerRows,
        ],
        'partners' => $partnerRows,
        'devices' => $deviceRows,
        'device_summary' => [
            'mobile_share' => landing_insights_percent($mobileVisitors, max(1, $uniqueVisitors), 1),
            'mobile_conversion' => $mobileConversion,
            'desktop_conversion' => $desktopConversion,
        ],
        'leads' => $leadRows,
        'technical_events' => array_slice($technicalEvents, 0, 500),
        'series' => $series,
    ];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method !== 'POST') {
    landing_insights_respond(405, ['error' => 'Metodo nao permitido']);
}

if (users_store_backend() === 'error') {
    landing_insights_respond(500, ['error' => users_store_last_error() ?: 'Banco configurado, mas nao esta pronto ainda.']);
}

$body = json_decode(file_get_contents('php://input'), true);
if (!is_array($body)) {
    landing_insights_respond(400, ['error' => 'JSON invalido']);
}

$token = trim((string)($body['token'] ?? ''));
$auth = landing_private_authenticate_token($token);
if (empty($auth['ok'])) {
    landing_insights_respond((int)($auth['status'] ?? 401), [
        'ok' => false,
        'error' => $auth['error'] ?? 'Sessao privada invalida.',
    ]);
}

$range = landing_insights_build_range(
    $body['period'] ?? '30d',
    trim((string)($body['dateFrom'] ?? '')),
    trim((string)($body['dateTo'] ?? ''))
);
$includeTest = landing_insights_bool($body['includeTest'] ?? false);

$eventsStore = landing_insights_load_store();
$rawEvents = is_array($eventsStore['events'] ?? null) ? array_values($eventsStore['events']) : [];
$events = [];
foreach ($rawEvents as $event) {
    $normalized = landing_insights_normalize_event($event);
    if (!$normalized) continue;
    if (!$includeTest && ($normalized['is_test'] || $normalized['is_bot'])) continue;
    $events[] = $normalized;
}

$waitlistEntries = landing_insights_load_waitlist_entries();
$leads = [];
foreach ($waitlistEntries as $entry) {
    $normalized = landing_insights_normalize_lead($entry);
    if (!$normalized) continue;
    $leads[] = $normalized;
}
$leads = array_merge($leads, landing_insights_build_legacy_leads($events, $leads));

$currentEvents = array_values(array_filter($events, function ($event) use ($range) {
    return landing_insights_is_in_range((int)$event['timestamp'], ['start' => $range['start'], 'end' => $range['end']]);
}));
$previousEvents = array_values(array_filter($events, function ($event) use ($range) {
    return landing_insights_is_in_range((int)$event['timestamp'], ['start' => $range['previous_start'], 'end' => $range['previous_end']]);
}));

$currentLeads = array_values(array_filter($leads, function ($lead) use ($range) {
    return landing_insights_is_in_range((int)$lead['timestamp'], ['start' => $range['start'], 'end' => $range['end']]);
}));
$previousLeads = array_values(array_filter($leads, function ($lead) use ($range) {
    return landing_insights_is_in_range((int)$lead['timestamp'], ['start' => $range['previous_start'], 'end' => $range['previous_end']]);
}));

$currentAnalytics = landing_insights_build_analytics($currentEvents, $currentLeads, $range, $currentEvents);
$previousAnalytics = landing_insights_build_analytics($previousEvents, $previousLeads, [
    'start' => $range['previous_start'],
    'end' => $range['previous_end'],
], $previousEvents);
$legacySnapshots = landing_insights_load_legacy_snapshots();
$appliedLegacySnapshots = [];
$legacyEventsCount = 0;
foreach ($legacySnapshots as $legacySnapshot) {
    if (!landing_insights_range_contains_snapshot($range, $legacySnapshot)) continue;
    $appliedLegacySnapshots[] = $legacySnapshot;
    $legacyEventsCount = max($legacyEventsCount, (int)($legacySnapshot['events_count'] ?? 0));
    $currentAnalytics = landing_insights_apply_legacy_snapshot($currentAnalytics, $legacySnapshot, $range);
}

$GLOBALS['currentAnalyticsSampleVisitors'] = (int)($currentAnalytics['summary']['unique_visitors'] ?? 0);
$GLOBALS['currentAnalyticsHeroToCtaRate'] = (float)($currentAnalytics['summary']['hero_to_cta_rate'] ?? 0);
$cards = landing_insights_build_cards($currentAnalytics['cards'], $previousAnalytics['cards']);
$diagnostics = landing_insights_build_diagnostics($currentAnalytics);
$directChannel = null;
foreach ($currentAnalytics['acquisition']['channels'] as $channel) {
    if (($channel['channel'] ?? '') === 'Direto') {
        $directChannel = $channel;
        break;
    }
}

$highlights = [];
if ($directChannel && ($directChannel['visitors'] ?? 0) > 0 && landing_insights_percent($directChannel['visitors'], max(1, $currentAnalytics['summary']['unique_visitors']), 1) >= 50) {
    $highlights[] = 'Muitos acessos estao sem origem definida. Use UTMs nos links de divulgacao.';
}
if (($currentAnalytics['cta_lookup']['hero_secondary_features']['clicks'] ?? 0) > 0 && ($currentAnalytics['cta_lookup']['hero_secondary_features']['leads_after_click'] ?? 0) === 0) {
    $highlights[] = 'O CTA secundario pode estar roubando atencao do CTA principal.';
}
if (($currentAnalytics['cta_lookup']['final_form_submit']['post_click_conversion'] ?? 0) >= 40 && ($currentAnalytics['section_lookup']['final-form']['visitors_percent'] ?? 0) < 15) {
    $highlights[] = 'O formulario final converte, mas pouca gente chega ate ele.';
}
$partialLeadCount = count(array_filter((array)($currentAnalytics['leads'] ?? []), function ($lead) {
    return !empty($lead['is_partial']);
}));
if ($partialLeadCount > 0) {
    $highlights[] = $partialLeadCount . ' pre-cadastros historicos foram recuperados sem contato porque o tracker antigo nao preservou nome, WhatsApp e Instagram.';
}

$dataSources = [];
foreach ($currentEvents as $event) {
    $dataSources[$event['data_source'] ?? 'novo_tracker'] = true;
}
foreach ($currentLeads as $lead) {
    $dataSources[$lead['data_source'] ?? 'novo_tracker'] = true;
}
$dataSourceKeys = array_keys($dataSources);
$legacySourceKeys = [];
foreach ($appliedLegacySnapshots as $legacySnapshot) {
    $legacySourceKey = landing_insights_legacy_snapshot_source_key($legacySnapshot);
    $dataSourceKeys[] = $legacySourceKey;
    $legacySourceKeys[$legacySourceKey] = true;
}
$dataSourceKeys = array_values(array_unique($dataSourceKeys));
$dataSourceLabel = count($dataSourceKeys) > 1 ? 'Dados combinados' : (($dataSourceKeys[0] ?? 'novo_tracker') === 'landing_antiga' ? 'Landing antiga' : 'Novo tracker');
if ($appliedLegacySnapshots) {
    $dataSourceLabel = count($dataSourceKeys) > 1 ? 'Tracker atual + recuperacao historica' : 'Recuperacao historica';
}

landing_insights_respond(200, [
    'ok' => true,
    'viewer' => [
        'email' => (string)($auth['email'] ?? ''),
        'name' => (string)($auth['user']['name'] ?? ''),
    ],
    'meta' => [
        'landingUrl' => 'landing.html',
        'selectedPeriod' => $range['label'],
        'generatedAt' => landing_insights_iso_now(),
        'updatedAt' => (string)($eventsStore['updatedAt'] ?? ''),
        'eventsCount' => $appliedLegacySnapshots ? max(count($currentEvents), $legacyEventsCount) : count($currentEvents),
        'leadCount' => (int)($currentAnalytics['summary']['leads'] ?? count($currentLeads)),
        'includeTest' => $includeTest,
        'dataSources' => $dataSourceKeys,
        'dataSourceLabel' => $dataSourceLabel,
    ],
    'filters' => [
        'period' => $range['key'],
        'label' => $range['label'],
        'dateFrom' => gmdate('Y-m-d', $range['start']),
        'dateTo' => gmdate('Y-m-d', $range['end']),
        'previousDateFrom' => gmdate('Y-m-d', $range['previous_start']),
        'previousDateTo' => gmdate('Y-m-d', $range['previous_end']),
    ],
    'overview' => [
        'cards' => $cards,
        'diagnostics' => $diagnostics['items'],
        'nextActions' => $diagnostics['next_actions'],
        'highlights' => $highlights,
    ],
    'summary' => $currentAnalytics['summary'],
    'funnel' => $currentAnalytics['funnel'],
    'sections' => $currentAnalytics['sections'],
    'ctas' => $currentAnalytics['ctas'],
    'form' => $currentAnalytics['form'],
    'acquisition' => $currentAnalytics['acquisition'],
    'partners' => $currentAnalytics['partners'],
    'devices' => $currentAnalytics['devices'],
    'leads' => $currentAnalytics['leads'],
    'technicalEvents' => $currentAnalytics['technical_events'],
    'series' => $currentAnalytics['series'],
]);
