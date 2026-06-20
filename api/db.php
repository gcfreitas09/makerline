<?php
// api/db.php

const UGC_DB_CONFIG_PATH = __DIR__ . '/../storage/db.json';

$GLOBALS['UGC_DB_LAST_INFO'] = null;
$GLOBALS['UGC_DB_CONFIG'] = null;

function db_last_info()
{
    return $GLOBALS['UGC_DB_LAST_INFO'];
}

function db_config()
{
    if (!is_array($GLOBALS['UGC_DB_CONFIG'])) {
        load_db_config();
    }
    return is_array($GLOBALS['UGC_DB_CONFIG']) ? $GLOBALS['UGC_DB_CONFIG'] : null;
}

function db_info($config, $reason, $error = null)
{
    $safe = [
        'dbConfigured' => (bool)$config,
        'reason' => (string)$reason,
        'dbPath' => 'storage/db.json',
        'examplePath' => 'storage/db.example.json',
        'error' => $error ? (string)$error : null
    ];

    if ($config) {
        $safe['db'] = [
            'driver' => $config['driver'] ?? 'mysql',
            'host' => $config['host'] ?? null,
            'port' => $config['port'] ?? null,
            'database' => $config['database'] ?? null,
            'username' => $config['username'] ?? null,
            'table_users' => $config['table_users'] ?? 'ugc_users'
        ];
    }

    return $safe;
}

function load_db_config()
{
    $file = UGC_DB_CONFIG_PATH;
    $envEnabled = getenv('UGC_DB_ENABLED');

    if (!file_exists($file)) {
        if ($envEnabled !== false) {
            $enabledBool = filter_var($envEnabled, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($enabledBool === false) {
                $GLOBALS['UGC_DB_LAST_INFO'] = db_info(null, 'db_disabled_env');
                return null;
            }
        }

        $host = getenv('UGC_DB_HOST');
        $user = getenv('UGC_DB_USER');
        $pass = getenv('UGC_DB_PASSWORD');
        $name = getenv('UGC_DB_NAME');
        if ($host && $user && $name) {
            $config = [
                'enabled' => true,
                'driver' => 'mysql',
                'host' => $host,
                'port' => getenv('UGC_DB_PORT') ? (int)getenv('UGC_DB_PORT') : 3306,
                'database' => $name,
                'username' => $user,
                'password' => $pass ?: '',
                'table_users' => getenv('UGC_DB_USERS_TABLE') ?: 'ugc_users'
            ];
            $GLOBALS['UGC_DB_CONFIG'] = $config;
            $GLOBALS['UGC_DB_LAST_INFO'] = db_info($config, 'ok');
            return $config;
        }

        $GLOBALS['UGC_DB_LAST_INFO'] = db_info(null, 'db_file_missing');
        return null;
    }

    $raw = file_get_contents($file);
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        $GLOBALS['UGC_DB_LAST_INFO'] = db_info(null, 'db_invalid_json');
        return null;
    }

    if (array_key_exists('enabled', $data) && !$data['enabled']) {
        $GLOBALS['UGC_DB_LAST_INFO'] = db_info(null, 'db_disabled');
        return null;
    }

    $driver = strtolower(trim((string)($data['driver'] ?? 'mysql')));
    $host = trim((string)($data['host'] ?? ''));
    $database = trim((string)($data['database'] ?? ''));
    $username = trim((string)($data['username'] ?? ''));
    $password = (string)($data['password'] ?? '');
    $port = (int)($data['port'] ?? 3306);

    if ($host === '' || $database === '' || $username === '') {
        $GLOBALS['UGC_DB_LAST_INFO'] = db_info(null, 'db_incomplete');
        return null;
    }

    $config = [
        'enabled' => true,
        'driver' => $driver ?: 'mysql',
        'host' => $host,
        'port' => $port > 0 ? $port : 3306,
        'database' => $database,
        'username' => $username,
        'password' => $password,
        'table_users' => trim((string)($data['table_users'] ?? 'ugc_users')) ?: 'ugc_users'
    ];

    $GLOBALS['UGC_DB_CONFIG'] = $config;
    $GLOBALS['UGC_DB_LAST_INFO'] = db_info($config, 'ok');
    return $config;
}

function db()
{
    static $pdo = null;
    static $checked = false;

    if ($checked) {
        return $pdo;
    }
    $checked = true;

    $config = load_db_config();
    if (!$config) {
        return null;
    }

    if (($config['driver'] ?? 'mysql') !== 'mysql') {
        $GLOBALS['UGC_DB_LAST_INFO'] = db_info(null, 'db_driver_unsupported');
        return null;
    }

    try {
        $dsn = 'mysql:host=' . $config['host'] . ';port=' . (int)($config['port'] ?? 3306) . ';dbname=' . $config['database'] . ';charset=utf8mb4';
        $pdo = new PDO($dsn, $config['username'], $config['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]);
        return $pdo;
    } catch (Throwable $e) {
        $pdo = null;
        $GLOBALS['UGC_DB_LAST_INFO'] = db_info($config, 'db_connect_failed', $e->getMessage());
        return null;
    }
}
