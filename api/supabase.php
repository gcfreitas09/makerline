<?php
// api/supabase.php

const UGC_SUPABASE_CONFIG_PATH = __DIR__ . '/../storage/supabase.json';

$GLOBALS['UGC_SUPABASE_LAST_INFO'] = null;
$GLOBALS['UGC_SUPABASE_CONFIG'] = null;

function supabase_last_info()
{
    return $GLOBALS['UGC_SUPABASE_LAST_INFO'];
}

function supabase_config()
{
    if (!is_array($GLOBALS['UGC_SUPABASE_CONFIG'])) {
        load_supabase_config();
    }
    return is_array($GLOBALS['UGC_SUPABASE_CONFIG']) ? $GLOBALS['UGC_SUPABASE_CONFIG'] : null;
}

function supabase_info($config, $reason, $error = null)
{
    $safe = [
        'supabaseConfigured' => (bool)$config,
        'reason' => (string)$reason,
        'configPath' => 'storage/supabase.json',
        'examplePath' => 'storage/supabase.example.json',
        'error' => $error ? (string)$error : null
    ];

    if ($config) {
        $safe['supabase'] = [
            'url' => $config['url'] ?? null,
            'table_users' => $config['table_users'] ?? 'ugc_users',
            'table_states' => $config['table_states'] ?? 'ugc_user_states',
            'timeout' => $config['timeout'] ?? 12
        ];
    }

    return $safe;
}

function load_supabase_config()
{
    $file = UGC_SUPABASE_CONFIG_PATH;
    $envEnabled = getenv('UGC_SUPABASE_ENABLED');

    if (!file_exists($file)) {
        if ($envEnabled !== false) {
            $enabledBool = filter_var($envEnabled, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($enabledBool === false) {
                $GLOBALS['UGC_SUPABASE_LAST_INFO'] = supabase_info(null, 'supabase_disabled_env');
                return null;
            }
        }

        $url = trim((string)(getenv('UGC_SUPABASE_URL') ?: ''));
        $key = (string)(getenv('UGC_SUPABASE_SERVICE_KEY') ?: (getenv('UGC_SUPABASE_KEY') ?: ''));
        $table = trim((string)(getenv('UGC_SUPABASE_USERS_TABLE') ?: 'ugc_users'));
        $tableStates = trim((string)(getenv('UGC_SUPABASE_STATES_TABLE') ?: 'ugc_user_states'));
        $timeoutEnv = getenv('UGC_SUPABASE_TIMEOUT');
        $timeout = $timeoutEnv !== false ? (int)$timeoutEnv : 12;

        if ($url !== '' && $key !== '') {
            $config = [
                'enabled' => true,
                'url' => rtrim($url, '/'),
                'service_key' => $key,
                'table_users' => $table !== '' ? $table : 'ugc_users',
                'table_states' => $tableStates !== '' ? $tableStates : 'ugc_user_states',
                'timeout' => $timeout > 0 ? $timeout : 12
            ];
            $GLOBALS['UGC_SUPABASE_CONFIG'] = $config;
            $GLOBALS['UGC_SUPABASE_LAST_INFO'] = supabase_info($config, 'ok');
            return $config;
        }

        $GLOBALS['UGC_SUPABASE_LAST_INFO'] = supabase_info(null, 'supabase_file_missing');
        return null;
    }

    $raw = file_get_contents($file);
    $data = json_decode((string)$raw, true);
    if (!is_array($data)) {
        $GLOBALS['UGC_SUPABASE_LAST_INFO'] = supabase_info(null, 'supabase_invalid_json');
        return null;
    }

    if (array_key_exists('enabled', $data) && !$data['enabled']) {
        $GLOBALS['UGC_SUPABASE_LAST_INFO'] = supabase_info(null, 'supabase_disabled');
        return null;
    }

    $url = rtrim(trim((string)($data['url'] ?? '')), '/');
    $key = (string)($data['service_key'] ?? ($data['key'] ?? ''));
    $table = trim((string)($data['table_users'] ?? 'ugc_users'));
    $tableStates = trim((string)($data['table_states'] ?? 'ugc_user_states'));
    $timeout = (int)($data['timeout'] ?? 12);

    if ($url === '' || $key === '') {
        $GLOBALS['UGC_SUPABASE_LAST_INFO'] = supabase_info(null, 'supabase_incomplete');
        return null;
    }

    $config = [
        'enabled' => true,
        'url' => $url,
        'service_key' => $key,
        'table_users' => $table !== '' ? $table : 'ugc_users',
        'table_states' => $tableStates !== '' ? $tableStates : 'ugc_user_states',
        'timeout' => $timeout > 0 ? $timeout : 12
    ];

    $GLOBALS['UGC_SUPABASE_CONFIG'] = $config;
    $GLOBALS['UGC_SUPABASE_LAST_INFO'] = supabase_info($config, 'ok');
    return $config;
}
