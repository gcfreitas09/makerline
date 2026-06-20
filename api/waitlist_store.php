<?php
require_once __DIR__ . '/referrals.php';

const MAKERLINE_WAITLIST_FILE = __DIR__ . '/../storage/waitlist.json';
const MAKERLINE_WAITLIST_DB_FILE = __DIR__ . '/../storage/waitlist.sqlite';
const MAKERLINE_WAITLIST_TABLE = 'landing_waitlist_entries';
const MAKERLINE_WAITLIST_BACKUP_DIR = __DIR__ . '/../storage/backups';
const MAKERLINE_LEAD_STATUS_DEFAULT = 'new';
const MAKERLINE_LEAD_STATUS_OPTIONS = ['new', 'contacted', 'qualified', 'discarded', 'client'];

$GLOBALS['MAKERLINE_WAITLIST_LAST_ERROR'] = null;

function waitlist_store_last_error()
{
    return $GLOBALS['MAKERLINE_WAITLIST_LAST_ERROR'];
}

function waitlist_store_set_error($message)
{
    $GLOBALS['MAKERLINE_WAITLIST_LAST_ERROR'] = trim((string)$message);
}

function waitlist_store_string($value, $max = 255)
{
    $text = trim((string)$value);
    if ($text === '') return '';
    return mb_substr($text, 0, $max);
}

function waitlist_store_integer($value, $min = 0, $max = 1000000)
{
    $number = (int)$value;
    if ($number < $min) return $min;
    if ($number > $max) return $max;
    return $number;
}

function waitlist_store_boolean($value)
{
    if (is_bool($value)) return $value;
    if (is_numeric($value)) return (int)$value === 1;

    $safe = strtolower(trim((string)$value));
    if ($safe === '') return false;
    return in_array($safe, ['1', 'true', 'yes', 'sim', 'on'], true);
}

function waitlist_store_string_list($value, $maxItems = 24, $maxLength = 80)
{
    if (!is_array($value)) return [];

    $items = [];
    foreach ($value as $item) {
        $safe = waitlist_store_string($item, $maxLength);
        if ($safe === '') continue;
        $items[$safe] = true;
        if (count($items) >= $maxItems) break;
    }

    return array_keys($items);
}

function waitlist_store_normalize_phone($value)
{
    return preg_replace('/\D+/', '', (string)$value) ?: '';
}

function waitlist_store_normalize_instagram($value)
{
    $safe = strtolower(trim((string)$value));
    if ($safe === '') return '';

    $safe = preg_replace('#^https?://(www\.)?instagram\.com/#i', '', $safe);
    $safe = preg_replace('#^instagram\.com/#i', '', $safe);
    $safe = strtok($safe, '?') ?: $safe;
    $safe = strtok($safe, '#') ?: $safe;
    $safe = trim((string)$safe, "/ \t\n\r\0\x0B");
    $parts = preg_split('#/#', $safe);
    $safe = is_array($parts) && isset($parts[0]) ? (string)$parts[0] : $safe;
    $safe = ltrim($safe, '@');
    $safe = preg_replace('/[^a-z0-9._]+/', '', $safe);
    return trim((string)$safe);
}

function waitlist_store_is_valid_instagram($value)
{
    $handle = waitlist_store_normalize_instagram($value);
    if ($handle === '') return false;
    if (strlen($handle) < 3 || strlen($handle) > 30) return false;
    return preg_match('/^[a-z0-9._]+$/', $handle) === 1;
}

function waitlist_store_format_instagram($value)
{
    $handle = waitlist_store_normalize_instagram($value);
    return $handle !== '' ? '@' . $handle : '';
}

function waitlist_store_instagram_url($value)
{
    $handle = waitlist_store_normalize_instagram($value);
    return $handle !== '' ? 'https://instagram.com/' . $handle : '';
}

function waitlist_store_tracking_field($value, $keys, $max = 255)
{
    foreach ((array)$keys as $key) {
        if (!is_array($value) || !array_key_exists($key, $value)) continue;
        $safe = waitlist_store_string($value[$key], $max);
        if ($safe !== '') return $safe;
    }
    return '';
}

function waitlist_store_tracking_integer($value, $keys, $min = 0, $max = 1000000)
{
    foreach ((array)$keys as $key) {
        if (!is_array($value) || !array_key_exists($key, $value)) continue;
        return waitlist_store_integer($value[$key], $min, $max);
    }
    return 0;
}

function waitlist_store_tracking_boolean($value, $keys)
{
    foreach ((array)$keys as $key) {
        if (!is_array($value) || !array_key_exists($key, $value)) continue;
        return waitlist_store_boolean($value[$key]);
    }
    return false;
}

function waitlist_store_normalize_tracking($value)
{
    if (!is_array($value)) return null;

    $utmRaw = is_array($value['utm'] ?? null) ? $value['utm'] : [];

    return [
        'visitorId' => waitlist_store_tracking_field($value, ['visitor_id', 'visitorId'], 80),
        'sessionId' => waitlist_store_tracking_field($value, ['session_id', 'sessionId'], 80),
        'pageInstanceId' => waitlist_store_tracking_field($value, ['page_instance_id', 'pageInstanceId'], 80),
        'capturedAt' => waitlist_store_tracking_field($value, ['captured_at', 'capturedAt'], 40),
        'sessionStartedAt' => waitlist_store_tracking_field($value, ['session_started_at', 'sessionStartedAt'], 40),
        'pageLoadedAt' => waitlist_store_tracking_field($value, ['page_loaded_at', 'pageLoadedAt'], 40),
        'landingPath' => waitlist_store_tracking_field($value, ['page_path', 'landingPath', 'path'], 255),
        'entryUrl' => waitlist_store_tracking_field($value, ['page_url', 'entryUrl', 'entry_url'], 500),
        'referrer' => waitlist_store_tracking_field($value, ['referrer'], 500),
        'referrerHost' => waitlist_store_tracking_field($value, ['referrer_host', 'referrerHost'], 160),
        'hostname' => waitlist_store_tracking_field($value, ['hostname'], 160),
        'environment' => waitlist_store_tracking_field($value, ['environment'], 40),
        'channel' => waitlist_store_tracking_field($value, ['channel'], 80),
        'deviceType' => waitlist_store_tracking_field($value, ['device_type', 'deviceType'], 32),
        'browser' => waitlist_store_tracking_field($value, ['browser'], 80),
        'os' => waitlist_store_tracking_field($value, ['os'], 80),
        'viewportWidth' => waitlist_store_tracking_integer($value, ['viewport_width', 'viewportWidth'], 0, 10000),
        'viewportHeight' => waitlist_store_tracking_integer($value, ['viewport_height', 'viewportHeight'], 0, 10000),
        'screenWidth' => waitlist_store_tracking_integer($value, ['screen_width', 'screenWidth'], 0, 10000),
        'screenHeight' => waitlist_store_tracking_integer($value, ['screen_height', 'screenHeight'], 0, 10000),
        'engagementSeconds' => waitlist_store_tracking_integer($value, ['time_on_page', 'engagementSeconds'], 0, 86400),
        'maxScrollDepth' => waitlist_store_tracking_integer($value, ['scroll_percent', 'maxScrollDepth', 'scrollDepth'], 0, 100),
        'lastCtaLabel' => waitlist_store_tracking_field($value, ['last_cta_label', 'lastCtaLabel'], 160),
        'lastCtaId' => waitlist_store_tracking_field($value, ['cta_id', 'lastCtaId', 'ctaId'], 80),
        'lastSectionId' => waitlist_store_tracking_field($value, ['section_id', 'lastSectionId', 'sectionId'], 80),
        'seenSections' => waitlist_store_string_list($value['seen_sections'] ?? ($value['seenSections'] ?? []), 24, 80),
        'ctaHistory' => waitlist_store_string_list($value['cta_history'] ?? ($value['ctaHistory'] ?? []), 12, 160),
        'referralCode' => waitlist_store_tracking_field($value, ['referral_code', 'referralCode'], 80),
        'partnerCode' => waitlist_store_tracking_field($value, ['partner_code', 'partnerCode'], 80),
        'isTest' => waitlist_store_tracking_boolean($value, ['is_test', 'isTest']),
        'utm' => [
            'source' => waitlist_store_tracking_field($utmRaw, ['source', 'utm_source'], 120),
            'medium' => waitlist_store_tracking_field($utmRaw, ['medium', 'utm_medium'], 120),
            'campaign' => waitlist_store_tracking_field($utmRaw, ['campaign', 'utm_campaign'], 160),
            'content' => waitlist_store_tracking_field($utmRaw, ['content', 'utm_content'], 160),
            'term' => waitlist_store_tracking_field($utmRaw, ['term', 'utm_term'], 160),
        ],
    ];
}

function waitlist_store_allowed_lead_statuses()
{
    return MAKERLINE_LEAD_STATUS_OPTIONS;
}

function waitlist_store_normalize_lead_status($value, $fallback = MAKERLINE_LEAD_STATUS_DEFAULT)
{
    $safe = strtolower(trim((string)$value));
    if (in_array($safe, waitlist_store_allowed_lead_statuses(), true)) {
        return $safe;
    }
    return $fallback;
}

function waitlist_store_ensure_storage($file = MAKERLINE_WAITLIST_FILE)
{
    if (file_exists($file)) {
        return true;
    }

    $dir = dirname($file);
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        waitlist_store_set_error('Nao consegui criar a pasta do storage da waitlist.');
        return false;
    }

    $created = @file_put_contents($file, json_encode([], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
    if ($created === false) {
        waitlist_store_set_error('Nao consegui criar o arquivo storage/waitlist.json.');
        return false;
    }
    return true;
}

function waitlist_store_ensure_backup_dir()
{
    if (is_dir(MAKERLINE_WAITLIST_BACKUP_DIR)) return true;
    return @mkdir(MAKERLINE_WAITLIST_BACKUP_DIR, 0775, true) || is_dir(MAKERLINE_WAITLIST_BACKUP_DIR);
}

function waitlist_store_backup_json_if_needed($file = MAKERLINE_WAITLIST_FILE)
{
    if (!is_file($file)) return true;
    if (!waitlist_store_ensure_backup_dir()) return false;

    $existing = glob(MAKERLINE_WAITLIST_BACKUP_DIR . DIRECTORY_SEPARATOR . 'waitlist_*.json') ?: [];
    $latestMtime = 0;
    foreach ($existing as $path) {
        $mtime = @filemtime($path);
        if ($mtime && $mtime > $latestMtime) $latestMtime = $mtime;
    }
    if ($latestMtime > 0 && (time() - $latestMtime) < 1800) {
        return true;
    }

    $backupFile = MAKERLINE_WAITLIST_BACKUP_DIR . DIRECTORY_SEPARATOR . 'waitlist_' . date('Ymd_His') . '.json';
    @copy($file, $backupFile);

    $existing = glob(MAKERLINE_WAITLIST_BACKUP_DIR . DIRECTORY_SEPARATOR . 'waitlist_*.json') ?: [];
    if (count($existing) > 60) {
        usort($existing, function ($a, $b) {
            return (int)@filemtime($a) <=> (int)@filemtime($b);
        });
        $toDelete = array_slice($existing, 0, count($existing) - 60);
        foreach ($toDelete as $path) {
            @unlink($path);
        }
    }

    return true;
}

function waitlist_store_db()
{
    static $pdo = null;
    static $checked = false;

    if ($checked) {
        return $pdo;
    }
    $checked = true;

    $dir = dirname(MAKERLINE_WAITLIST_DB_FILE);
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        waitlist_store_set_error('Nao consegui criar a pasta do banco local da waitlist.');
        return null;
    }

    try {
        $pdo = new PDO('sqlite:' . MAKERLINE_WAITLIST_DB_FILE);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $pdo->exec('PRAGMA journal_mode = WAL;');
        $pdo->exec('PRAGMA synchronous = NORMAL;');
        $pdo->exec('PRAGMA busy_timeout = 5000;');
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS ' . MAKERLINE_WAITLIST_TABLE . ' (
                id TEXT PRIMARY KEY,
                instagram_handle TEXT,
                phone_digits TEXT,
                email TEXT,
                lead_status TEXT NOT NULL DEFAULT "new",
                is_test INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                payload_json TEXT NOT NULL
            )'
        );
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_waitlist_instagram_handle ON ' . MAKERLINE_WAITLIST_TABLE . ' (instagram_handle)');
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_waitlist_phone_digits ON ' . MAKERLINE_WAITLIST_TABLE . ' (phone_digits)');
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON ' . MAKERLINE_WAITLIST_TABLE . ' (created_at DESC)');
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_waitlist_is_test ON ' . MAKERLINE_WAITLIST_TABLE . ' (is_test)');
        waitlist_store_migrate_json_to_db($pdo);
        return $pdo;
    } catch (Throwable $e) {
        waitlist_store_set_error($e->getMessage());
        $pdo = null;
        return null;
    }
}

function waitlist_store_entry_id($entry, $fallbackIndex = null)
{
    if (!is_array($entry)) return '';

    $storedId = waitlist_store_string($entry['id'] ?? '', 80);
    if ($storedId !== '') return $storedId;

    $seedParts = [
        waitlist_store_string($entry['createdAt'] ?? '', 64),
        waitlist_store_string($entry['instagramHandle'] ?? ($entry['instagram'] ?? ''), 80),
        waitlist_store_string($entry['phoneDigits'] ?? ($entry['phone'] ?? ''), 32),
        waitlist_store_string($entry['name'] ?? '', 160),
    ];

    if ($fallbackIndex !== null) {
        $seedParts[] = (string)(int)$fallbackIndex;
    }

    $seed = implode('|', $seedParts);
    if (trim($seed, '|') === '') {
        $seed = 'waitlist|' . (string)(int)$fallbackIndex . '|' . microtime(true);
    }

    return 'wl_' . substr(hash('sha256', $seed), 0, 24);
}

function waitlist_store_ensure_entry_id($entry, $fallbackIndex = null)
{
    if (!is_array($entry)) return $entry;
    if (waitlist_store_string($entry['id'] ?? '', 80) !== '') return $entry;
    $entry['id'] = waitlist_store_entry_id($entry, $fallbackIndex);
    return $entry;
}

function waitlist_store_is_test_entry($entry)
{
    if (!is_array($entry)) return false;

    if (waitlist_store_boolean($entry['isTest'] ?? false)) return true;
    if (waitlist_store_boolean($entry['trackingLast']['isTest'] ?? false)) return true;
    if (waitlist_store_boolean($entry['trackingFirst']['isTest'] ?? false)) return true;

    $entryUrl = strtolower(waitlist_store_string($entry['trackingLast']['entryUrl'] ?? ($entry['entryUrl'] ?? ''), 500));
    $referrer = strtolower(waitlist_store_string($entry['trackingLast']['referrer'] ?? ($entry['referrer'] ?? ''), 500));
    $referrerHost = strtolower(waitlist_store_string($entry['trackingLast']['referrerHost'] ?? ($entry['referrerHost'] ?? ''), 160));
    $hostname = strtolower(waitlist_store_string($entry['trackingLast']['hostname'] ?? ($entry['hostname'] ?? ''), 160));
    $environment = strtolower(waitlist_store_string($entry['trackingLast']['environment'] ?? ($entry['environment'] ?? ''), 40));
    $name = strtolower(waitlist_store_string($entry['name'] ?? '', 160));
    $email = strtolower(waitlist_store_string($entry['email'] ?? '', 160));
    $instagram = strtolower(waitlist_store_string($entry['instagram'] ?? ($entry['instagramHandle'] ?? ''), 80));

    $combined = $entryUrl . ' ' . $referrer . ' ' . $referrerHost . ' ' . $hostname;
    if (strpos($combined, 'localhost') !== false || strpos($combined, '127.0.0.1') !== false) {
        return true;
    }

    if ($environment !== '' && in_array($environment, ['development', 'dev', 'staging', 'local'], true)) {
        return true;
    }

    foreach ([$name, $email, $instagram] as $value) {
        if ($value === '') continue;
        if (strpos($value, 'teste') !== false || strpos($value, 'test') !== false || strpos($value, 'example.com') !== false) {
            return true;
        }
    }

    return false;
}

function waitlist_store_ensure_entry_defaults($entry)
{
    if (!is_array($entry)) return [];

    $entry = waitlist_store_ensure_entry_id($entry);
    $entry['leadStatus'] = waitlist_store_normalize_lead_status(
        $entry['leadStatus'] ?? ($entry['statusLead'] ?? ''),
        MAKERLINE_LEAD_STATUS_DEFAULT
    );

    if (!isset($entry['isTest'])) {
        $entry['isTest'] = waitlist_store_is_test_entry($entry);
    } else {
        $entry['isTest'] = waitlist_store_boolean($entry['isTest']);
    }

    $instagramHandle = waitlist_store_normalize_instagram($entry['instagramHandle'] ?? ($entry['instagramUsername'] ?? ($entry['instagram'] ?? '')));
    if (!isset($entry['instagramHandle']) || trim((string)$entry['instagramHandle']) === '') {
        $entry['instagramHandle'] = $instagramHandle;
    }
    if (!isset($entry['instagramUsername']) || trim((string)$entry['instagramUsername']) === '') {
        $entry['instagramUsername'] = $instagramHandle;
    }
    if (!isset($entry['instagram']) || trim((string)$entry['instagram']) === '') {
        $entry['instagram'] = waitlist_store_format_instagram($instagramHandle);
    }
    if (!isset($entry['instagramUrl']) || trim((string)$entry['instagramUrl']) === '') {
        $entry['instagramUrl'] = waitlist_store_instagram_url($instagramHandle);
    }
    if (!isset($entry['phoneDigits']) || trim((string)$entry['phoneDigits']) === '') {
        $entry['phoneDigits'] = waitlist_store_normalize_phone($entry['phone'] ?? '');
    }
    if (!isset($entry['dataSource']) || trim((string)$entry['dataSource']) === '') {
        $entry['dataSource'] = 'novo_tracker';
    }
    if (!isset($entry['createdAt']) || trim((string)$entry['createdAt']) === '') {
        $entry['createdAt'] = date('c');
    }
    if (!isset($entry['updatedAt']) || trim((string)$entry['updatedAt']) === '') {
        $entry['updatedAt'] = (string)$entry['createdAt'];
    }
    if (!isset($entry['signupCount']) || (int)$entry['signupCount'] < 1) {
        $entry['signupCount'] = 1;
    }
    if (!isset($entry['seenSections']) || !is_array($entry['seenSections'])) {
        $entry['seenSections'] = [];
    } else {
        $entry['seenSections'] = waitlist_store_string_list($entry['seenSections'], 24, 80);
    }

    if (isset($entry['trackingFirst']) && is_array($entry['trackingFirst'])) {
        $entry['trackingFirst'] = waitlist_store_normalize_tracking($entry['trackingFirst']) ?: $entry['trackingFirst'];
    }
    if (isset($entry['trackingLast']) && is_array($entry['trackingLast'])) {
        $entry['trackingLast'] = waitlist_store_normalize_tracking($entry['trackingLast']) ?: $entry['trackingLast'];
    }

    return $entry;
}

function waitlist_store_read_locked_entries($fp)
{
    $raw = stream_get_contents($fp);
    $entries = json_decode((string)($raw ?: ''), true);
    if (!is_array($entries)) {
        $entries = [];
    }

    $normalized = [];
    foreach ($entries as $index => $entry) {
        $normalized[] = waitlist_store_ensure_entry_defaults(
            waitlist_store_ensure_entry_id(is_array($entry) ? $entry : [], $index)
        );
    }

    return $normalized;
}

function waitlist_store_write_locked_entries($fp, $entries)
{
    $json = json_encode(array_values($entries), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($json)) {
        return false;
    }

    rewind($fp);
    ftruncate($fp, 0);
    $written = fwrite($fp, $json);
    fflush($fp);

    return $written !== false;
}

function waitlist_store_load_all_json($file = MAKERLINE_WAITLIST_FILE)
{
    if (!waitlist_store_ensure_storage($file)) {
        return [];
    }

    $raw = @file_get_contents($file);
    if ($raw === false) {
        waitlist_store_set_error('Nao consegui ler storage/waitlist.json.');
        return [];
    }

    $entries = json_decode((string)$raw, true);
    if (!is_array($entries)) return [];

    $normalized = [];
    foreach ($entries as $index => $entry) {
        $normalized[] = waitlist_store_ensure_entry_defaults(
            waitlist_store_ensure_entry_id(is_array($entry) ? $entry : [], $index)
        );
    }

    return $normalized;
}

function waitlist_store_save_all_json($entries, $file = MAKERLINE_WAITLIST_FILE)
{
    if (!waitlist_store_ensure_storage($file)) {
        return false;
    }

    waitlist_store_backup_json_if_needed($file);

    $safeEntries = [];
    foreach ((array)$entries as $index => $entry) {
        $safeEntries[] = waitlist_store_ensure_entry_defaults(
            waitlist_store_ensure_entry_id(is_array($entry) ? $entry : [], $index)
        );
    }

    $ok = @file_put_contents(
        $file,
        json_encode(array_values($safeEntries), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        LOCK_EX
    );

    if ($ok === false) {
        waitlist_store_set_error('Nao consegui salvar storage/waitlist.json.');
        return false;
    }

    return true;
}

function waitlist_store_entry_match_signature($entry)
{
    if (!is_array($entry)) return [];

    $id = waitlist_store_string($entry['id'] ?? '', 80);
    $instagram = waitlist_store_normalize_instagram($entry['instagramHandle'] ?? ($entry['instagram'] ?? ''));
    $phone = waitlist_store_normalize_phone($entry['phoneDigits'] ?? ($entry['phone'] ?? ''));

    return [
        'id' => $id,
        'instagram' => $instagram,
        'phone' => $phone,
    ];
}

function waitlist_store_entries_match($left, $right)
{
    $leftSig = waitlist_store_entry_match_signature($left);
    $rightSig = waitlist_store_entry_match_signature($right);

    if ($leftSig['id'] !== '' && $leftSig['id'] === $rightSig['id']) return true;
    if ($leftSig['instagram'] !== '' && $leftSig['instagram'] === $rightSig['instagram']) return true;
    if ($leftSig['phone'] !== '' && $leftSig['phone'] === $rightSig['phone']) return true;

    return false;
}

function waitlist_store_merge_entry_pair($preferred, $fallback)
{
    $preferred = waitlist_store_ensure_entry_defaults(is_array($preferred) ? $preferred : []);
    $fallback = waitlist_store_ensure_entry_defaults(is_array($fallback) ? $fallback : []);
    $authoritativeAttributionFields = [
        'originLabel',
        'referralCode',
        'partnerCode',
        'partnerName',
        'partnerInstagram',
        'partnerInstagramUrl',
        'partnerTrialDays',
        'trackingFirst',
        'trackingLast',
    ];

    $merged = $preferred;
    foreach ($fallback as $key => $value) {
        if (array_key_exists($key, $preferred) && in_array($key, $authoritativeAttributionFields, true)) {
            continue;
        }
        if (!array_key_exists($key, $merged) || $merged[$key] === '' || $merged[$key] === null) {
            $merged[$key] = $value;
        }
    }

    $preferredCreatedAt = strtotime((string)($preferred['createdAt'] ?? '')) ?: 0;
    $fallbackCreatedAt = strtotime((string)($fallback['createdAt'] ?? '')) ?: 0;
    if ($preferredCreatedAt <= 0 || ($fallbackCreatedAt > 0 && $fallbackCreatedAt < $preferredCreatedAt)) {
        $merged['createdAt'] = (string)($fallback['createdAt'] ?? $merged['createdAt']);
    }

    $preferredUpdatedAt = strtotime((string)($preferred['updatedAt'] ?? ($preferred['createdAt'] ?? ''))) ?: 0;
    $fallbackUpdatedAt = strtotime((string)($fallback['updatedAt'] ?? ($fallback['createdAt'] ?? ''))) ?: 0;
    if ($fallbackUpdatedAt > $preferredUpdatedAt) {
        foreach ($fallback as $key => $value) {
            if ($value === '' || $value === null) continue;
            $merged[$key] = $value;
        }
        $merged['id'] = waitlist_store_entry_id($preferred);
    }

    $firstCaptured = array_filter([
        waitlist_store_string($preferred['firstCapturedAt'] ?? '', 40),
        waitlist_store_string($fallback['firstCapturedAt'] ?? '', 40),
        waitlist_store_string($preferred['createdAt'] ?? '', 40),
        waitlist_store_string($fallback['createdAt'] ?? '', 40),
    ]);
    if ($firstCaptured) {
        usort($firstCaptured, function ($a, $b) {
            return (strtotime($a) ?: 0) <=> (strtotime($b) ?: 0);
        });
        $merged['firstCapturedAt'] = $firstCaptured[0];
    }

    $lastCaptured = array_filter([
        waitlist_store_string($preferred['lastCapturedAt'] ?? '', 40),
        waitlist_store_string($fallback['lastCapturedAt'] ?? '', 40),
        waitlist_store_string($preferred['updatedAt'] ?? '', 40),
        waitlist_store_string($fallback['updatedAt'] ?? '', 40),
    ]);
    if ($lastCaptured) {
        usort($lastCaptured, function ($a, $b) {
            return (strtotime($b) ?: 0) <=> (strtotime($a) ?: 0);
        });
        $merged['lastCapturedAt'] = $lastCaptured[0];
        $merged['updatedAt'] = $lastCaptured[0];
    }

    $merged['signupCount'] = max(1, (int)($preferred['signupCount'] ?? 1), (int)($fallback['signupCount'] ?? 1));
    $merged['isTest'] = waitlist_store_boolean($preferred['isTest'] ?? false) || waitlist_store_boolean($fallback['isTest'] ?? false);
    $merged['leadStatus'] = waitlist_store_normalize_lead_status($merged['leadStatus'] ?? '');
    $merged['seenSections'] = waitlist_store_string_list(array_merge(
        is_array($preferred['seenSections'] ?? null) ? $preferred['seenSections'] : [],
        is_array($fallback['seenSections'] ?? null) ? $fallback['seenSections'] : []
    ), 24, 80);

    if (!is_array($merged['trackingFirst'] ?? null) && is_array($fallback['trackingFirst'] ?? null)) {
        $merged['trackingFirst'] = $fallback['trackingFirst'];
    }
    if (!is_array($merged['trackingLast'] ?? null) && is_array($fallback['trackingLast'] ?? null)) {
        $merged['trackingLast'] = $fallback['trackingLast'];
    }

    return waitlist_store_ensure_entry_defaults($merged);
}

function waitlist_store_db_row_to_entry($row)
{
    if (!is_array($row)) return null;

    $payload = json_decode((string)($row['payload_json'] ?? ''), true);
    if (!is_array($payload)) {
        $payload = [];
    }

    $payload['id'] = waitlist_store_string($row['id'] ?? ($payload['id'] ?? ''), 80);
    $payload['instagramHandle'] = waitlist_store_normalize_instagram($row['instagram_handle'] ?? ($payload['instagramHandle'] ?? ''));
    $payload['phoneDigits'] = waitlist_store_normalize_phone($row['phone_digits'] ?? ($payload['phoneDigits'] ?? ''));
    $payload['email'] = waitlist_store_string($row['email'] ?? ($payload['email'] ?? ''), 190);
    $payload['leadStatus'] = waitlist_store_normalize_lead_status($row['lead_status'] ?? ($payload['leadStatus'] ?? ''));
    $payload['isTest'] = waitlist_store_boolean($row['is_test'] ?? ($payload['isTest'] ?? false));
    $payload['createdAt'] = waitlist_store_string($row['created_at'] ?? ($payload['createdAt'] ?? ''), 40);
    $payload['updatedAt'] = waitlist_store_string($row['updated_at'] ?? ($payload['updatedAt'] ?? ''), 40);

    return waitlist_store_ensure_entry_defaults($payload);
}

function waitlist_store_db_upsert_entry($entry)
{
    $pdo = waitlist_store_db();
    if (!$pdo) return false;

    $entry = waitlist_store_ensure_entry_defaults($entry);
    $payloadJson = json_encode($entry, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($payloadJson)) {
        waitlist_store_set_error('Nao consegui serializar o pre-cadastro para salvar no banco local.');
        return false;
    }

    try {
        $stmt = $pdo->prepare(
            'INSERT INTO ' . MAKERLINE_WAITLIST_TABLE . ' (
                id,
                instagram_handle,
                phone_digits,
                email,
                lead_status,
                is_test,
                created_at,
                updated_at,
                payload_json
            ) VALUES (
                :id,
                :instagram_handle,
                :phone_digits,
                :email,
                :lead_status,
                :is_test,
                :created_at,
                :updated_at,
                :payload_json
            )
            ON CONFLICT(id) DO UPDATE SET
                instagram_handle = excluded.instagram_handle,
                phone_digits = excluded.phone_digits,
                email = excluded.email,
                lead_status = excluded.lead_status,
                is_test = excluded.is_test,
                created_at = excluded.created_at,
                updated_at = excluded.updated_at,
                payload_json = excluded.payload_json'
        );
        $stmt->execute([
            'id' => (string)$entry['id'],
            'instagram_handle' => waitlist_store_normalize_instagram($entry['instagramHandle'] ?? ($entry['instagram'] ?? '')) ?: null,
            'phone_digits' => waitlist_store_normalize_phone($entry['phoneDigits'] ?? ($entry['phone'] ?? '')) ?: null,
            'email' => waitlist_store_string($entry['email'] ?? '', 190) ?: null,
            'lead_status' => waitlist_store_normalize_lead_status($entry['leadStatus'] ?? ''),
            'is_test' => waitlist_store_boolean($entry['isTest'] ?? false) ? 1 : 0,
            'created_at' => (string)($entry['createdAt'] ?? date('c')),
            'updated_at' => (string)($entry['updatedAt'] ?? date('c')),
            'payload_json' => $payloadJson,
        ]);
        return true;
    } catch (Throwable $e) {
        waitlist_store_set_error($e->getMessage());
        return false;
    }
}

function waitlist_store_db_delete_by_id($entryId)
{
    $pdo = waitlist_store_db();
    if (!$pdo) return false;

    try {
        $stmt = $pdo->prepare('DELETE FROM ' . MAKERLINE_WAITLIST_TABLE . ' WHERE id = :id');
        $stmt->execute(['id' => waitlist_store_string($entryId, 80)]);
        return $stmt->rowCount() > 0;
    } catch (Throwable $e) {
        waitlist_store_set_error($e->getMessage());
        return false;
    }
}

function waitlist_store_db_delete_test_entries()
{
    $pdo = waitlist_store_db();
    if (!$pdo) return 0;

    try {
        $stmt = $pdo->prepare('DELETE FROM ' . MAKERLINE_WAITLIST_TABLE . ' WHERE is_test = 1');
        $stmt->execute();
        return (int)$stmt->rowCount();
    } catch (Throwable $e) {
        waitlist_store_set_error($e->getMessage());
        return 0;
    }
}

function waitlist_store_db_load_all()
{
    $pdo = waitlist_store_db();
    if (!$pdo) {
        return [];
    }

    try {
        $stmt = $pdo->query('SELECT * FROM ' . MAKERLINE_WAITLIST_TABLE . ' ORDER BY datetime(created_at) DESC, id DESC');
        $rows = $stmt ? $stmt->fetchAll() : [];
        $entries = [];
        foreach ((array)$rows as $row) {
            $entry = waitlist_store_db_row_to_entry(is_array($row) ? $row : null);
            if ($entry) $entries[] = $entry;
        }
        return $entries;
    } catch (Throwable $e) {
        waitlist_store_set_error($e->getMessage());
        return [];
    }
}

function waitlist_store_find_index_by_id($entries, $entryId)
{
    $safeId = waitlist_store_string($entryId, 80);
    if ($safeId === '') return null;

    foreach ((array)$entries as $index => $entry) {
        if (!is_array($entry)) continue;
        if (waitlist_store_entry_id($entry, $index) === $safeId) {
            return $index;
        }
    }

    return null;
}

function waitlist_store_find_matching_index($entries, $candidate)
{
    foreach ((array)$entries as $index => $entry) {
        if (!is_array($entry)) continue;
        if (waitlist_store_entries_match($entry, $candidate)) {
            return $index;
        }
    }
    return null;
}

function waitlist_store_migrate_json_to_db($pdo = null, $file = MAKERLINE_WAITLIST_FILE)
{
    static $done = false;
    if ($done) return true;
    $done = true;

    $pdo = $pdo ?: waitlist_store_db();
    if (!$pdo) return false;

    $jsonEntries = waitlist_store_load_all_json($file);
    if (!$jsonEntries) return true;

    $dbEntries = waitlist_store_db_load_all();
    foreach ($jsonEntries as $entry) {
        if (waitlist_store_find_matching_index($dbEntries, $entry) !== null) {
            continue;
        }
        if (!waitlist_store_db_upsert_entry($entry)) {
            return false;
        }
        $dbEntries[] = $entry;
    }

    return true;
}

function waitlist_store_load_all($file = MAKERLINE_WAITLIST_FILE)
{
    $dbEntries = waitlist_store_db_load_all();
    if ($dbEntries) {
        return $dbEntries;
    }

    return waitlist_store_load_all_json($file);
}

function waitlist_store_save_entry($entry, $file = MAKERLINE_WAITLIST_FILE)
{
    $entry = waitlist_store_ensure_entry_defaults($entry);

    $dbOk = waitlist_store_db() ? waitlist_store_db_upsert_entry($entry) : true;
    if (!$dbOk) {
        return false;
    }

    $jsonEntries = waitlist_store_load_all_json($file);
    $index = waitlist_store_find_matching_index($jsonEntries, $entry);
    if ($index === null) {
        $jsonEntries[] = $entry;
    } else {
        $jsonEntries[$index] = waitlist_store_merge_entry_pair($entry, $jsonEntries[$index]);
    }

    return waitlist_store_save_all_json($jsonEntries, $file);
}

function waitlist_store_delete_by_id($entryId, $file = MAKERLINE_WAITLIST_FILE)
{
    $safeId = waitlist_store_string($entryId, 80);
    if ($safeId === '') {
        return ['ok' => false, 'error' => 'ID invalido para excluir o pre-cadastro.'];
    }

    $entries = waitlist_store_load_all($file);
    $deleteIndex = waitlist_store_find_index_by_id($entries, $safeId);
    if ($deleteIndex === null) {
        return ['ok' => false, 'status' => 404, 'error' => 'Pre-cadastro nao encontrado.'];
    }

    $deleted = $entries[$deleteIndex];

    $dbTouched = true;
    if (waitlist_store_db()) {
        $dbTouched = waitlist_store_db_delete_by_id($safeId);
    }
    if (!$dbTouched) {
        return ['ok' => false, 'error' => waitlist_store_last_error() ?: 'Nao consegui excluir o pre-cadastro do banco local.'];
    }

    $jsonEntries = waitlist_store_load_all_json($file);
    $jsonDeleteIndex = waitlist_store_find_index_by_id($jsonEntries, $safeId);
    if ($jsonDeleteIndex !== null) {
        array_splice($jsonEntries, $jsonDeleteIndex, 1);
        if (!waitlist_store_save_all_json($jsonEntries, $file)) {
            return ['ok' => false, 'error' => waitlist_store_last_error() ?: 'Nao consegui salvar a exclusao do pre-cadastro.'];
        }
    }

    return [
        'ok' => true,
        'deleted' => $deleted,
        'deletedId' => $safeId,
        'remainingCount' => max(0, count($entries) - 1),
    ];
}

function waitlist_store_update_status_by_id($entryId, $status, $file = MAKERLINE_WAITLIST_FILE)
{
    $safeId = waitlist_store_string($entryId, 80);
    if ($safeId === '') {
        return ['ok' => false, 'error' => 'ID invalido para atualizar o lead.'];
    }

    $entries = waitlist_store_load_all($file);
    $index = waitlist_store_find_index_by_id($entries, $safeId);
    if ($index === null) {
        return ['ok' => false, 'status' => 404, 'error' => 'Lead nao encontrado.'];
    }

    $entries[$index]['leadStatus'] = waitlist_store_normalize_lead_status($status);
    $entries[$index]['updatedAt'] = date('c');
    $saved = waitlist_store_save_entry($entries[$index], $file);

    if (!$saved) {
        return ['ok' => false, 'error' => waitlist_store_last_error() ?: 'Nao consegui salvar o novo status do lead.'];
    }

    return [
        'ok' => true,
        'lead' => $entries[$index],
    ];
}

function waitlist_store_delete_test_entries($file = MAKERLINE_WAITLIST_FILE)
{
    $entries = waitlist_store_load_all($file);
    $before = count($entries);
    $filtered = array_values(array_filter($entries, function ($entry) {
        return !waitlist_store_is_test_entry($entry);
    }));

    if (waitlist_store_db()) {
        waitlist_store_db_delete_test_entries();
    }

    if (!waitlist_store_save_all_json($filtered, $file)) {
        return ['ok' => false, 'error' => waitlist_store_last_error() ?: 'Nao consegui limpar os leads de teste.'];
    }

    foreach ($filtered as $entry) {
        if (waitlist_store_db() && !waitlist_store_db_upsert_entry($entry)) {
            return ['ok' => false, 'error' => waitlist_store_last_error() ?: 'Nao consegui regravar os leads validos no banco local.'];
        }
    }

    return [
        'ok' => true,
        'deletedCount' => max(0, $before - count($filtered)),
        'remainingCount' => count($filtered),
    ];
}

function waitlist_store_find_existing_index($entries, $instagramHandle, $phoneDigits = '')
{
    $safeInstagram = waitlist_store_normalize_instagram($instagramHandle);
    $safePhone = waitlist_store_normalize_phone($phoneDigits);

    foreach ((array)$entries as $index => $entry) {
        if (!is_array($entry)) continue;

        $entryInstagram = waitlist_store_normalize_instagram($entry['instagramHandle'] ?? ($entry['instagram'] ?? ''));
        $entryPhone = waitlist_store_normalize_phone($entry['phoneDigits'] ?? ($entry['phone'] ?? ''));

        if ($safeInstagram !== '' && $entryInstagram === $safeInstagram) {
            return $index;
        }
        if ($safePhone !== '' && $entryPhone !== '' && $entryPhone === $safePhone) {
            return $index;
        }
    }

    return null;
}

function waitlist_store_find_pre_signup_match($instagramHandle, $email = '', $file = MAKERLINE_WAITLIST_FILE)
{
    $safeInstagram = waitlist_store_normalize_instagram($instagramHandle);
    $safeEmail = trim(strtolower((string)$email));
    if ($safeEmail !== '' && !filter_var($safeEmail, FILTER_VALIDATE_EMAIL)) {
        $safeEmail = '';
    }
    if ($safeInstagram === '' && $safeEmail === '') return null;

    $entries = waitlist_store_load_all($file);
    $match = null;
    $matchUpdatedAt = 0;

    foreach ($entries as $entry) {
        if (!is_array($entry)) continue;
        $entryInstagram = waitlist_store_normalize_instagram($entry['instagramHandle'] ?? ($entry['instagram'] ?? ''));
        $entryEmail = trim(strtolower((string)($entry['email'] ?? '')));
        $matchesInstagram = $safeInstagram !== '' && $entryInstagram === $safeInstagram;
        $matchesEmail = $safeEmail !== '' && $entryEmail === $safeEmail;
        if (!$matchesInstagram && !$matchesEmail) continue;

        $updatedAt = strtotime((string)($entry['updatedAt'] ?? ($entry['createdAt'] ?? ''))) ?: 0;
        if ($match === null || $updatedAt >= $matchUpdatedAt) {
            $match = $entry;
            $matchUpdatedAt = $updatedAt;
        }
    }

    return $match;
}

function waitlist_store_resolve_partner($referralCode)
{
    $canonicalCode = referrals_valid_code_or_null($referralCode);
    $partner = $canonicalCode ? referrals_partner_by_code($canonicalCode) : null;

    return [
        'referralCode' => $canonicalCode,
        'partnerCode' => $partner ? (string)($partner['partnerCode'] ?? ($partner['code'] ?? '')) : '',
        'partnerName' => $partner ? (string)($partner['name'] ?? '') : '',
        'partnerInstagram' => $partner ? (string)($partner['instagram'] ?? '') : '',
        'partnerInstagramUrl' => $partner ? (string)($partner['instagramUrl'] ?? '') : '',
        'trialDays' => $partner ? (int)($partner['trialDays'] ?? 0) : 0,
    ];
}
