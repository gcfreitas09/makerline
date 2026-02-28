<?php
// api/mailer.php
const SMTP_CONFIG_PATH = __DIR__ . '/../storage/smtp.json';
require_once __DIR__ . '/smtp_client.php';

$GLOBALS['UGC_MAILER_LAST_INFO'] = null;

function mailer_last_info()
{
    return $GLOBALS['UGC_MAILER_LAST_INFO'];
}

function mailer_mask_email($email)
{
    $value = (string) $email;
    $at = strpos($value, '@');
    if ($at === false) {
        return $value ? '***' : '';
    }
    $name = substr($value, 0, $at);
    $domain = substr($value, $at);
    if (strlen($name) <= 2) {
        return '**' . $domain;
    }
    return substr($name, 0, 1) . '***' . substr($name, -1) . $domain;
}

function smtp_config_is_placeholder($data)
{
    if (!is_array($data)) return true;
    $username = strtolower(trim((string)($data['username'] ?? '')));
    $password = trim((string)($data['password'] ?? ''));
    if ($username === '' || $password === '') return true;
    if (strpos($username, 'seu_email') !== false) return true;
    if (stripos($password, 'SENHA_DE_APP') !== false) return true;
    if (stripos($password, 'sua_senha_de_app') !== false) return true;
    return false;
}

function read_smtp_env()
{
    $enabled = getenv('UGC_SMTP_ENABLED');
    $enabled = $enabled === false ? null : $enabled;
    if ($enabled !== null) {
        $enabledBool = filter_var($enabled, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        if ($enabledBool === false) {
            return ['enabled' => false];
        }
    }

    $host = getenv('UGC_SMTP_HOST');
    $username = getenv('UGC_SMTP_USERNAME');
    $password = getenv('UGC_SMTP_PASSWORD');
    if (!$host || !$username || !$password) {
        return null;
    }

    $port = getenv('UGC_SMTP_PORT');
    $secure = getenv('UGC_SMTP_SECURE');
    $fromEmail = getenv('UGC_SMTP_FROM_EMAIL');
    $fromName = getenv('UGC_SMTP_FROM_NAME');

    return [
        'enabled' => true,
        'host' => $host,
        'port' => $port ? (int) $port : null,
        'secure' => $secure ?: null,
        'username' => $username,
        'password' => $password,
        'from_email' => $fromEmail ?: null,
        'from_name' => $fromName ?: null
    ];
}

function smtp_env_info($config, $reason)
{
    if (!$config) {
        return [
            'smtpConfigured' => false,
            'reason' => $reason,
            'smtpPath' => 'storage/smtp.json',
            'examplePath' => 'storage/smtp.example.json'
        ];
    }

    return [
        'smtpConfigured' => true,
        'reason' => 'ok',
        'smtpPath' => 'storage/smtp.json',
        'examplePath' => 'storage/smtp.example.json',
        'smtp' => [
            'host' => $config['host'] ?? null,
            'port' => $config['port'] ?? null,
            'secure' => $config['secure'] ?? null,
            'username' => mailer_mask_email($config['username'] ?? ''),
            'from_email' => mailer_mask_email($config['from_email'] ?? ($config['username'] ?? '')),
            'from_name' => $config['from_name'] ?? 'Makerline'
        ]
    ];
}

function load_smtp_config()
{
    $file = SMTP_CONFIG_PATH;
    $env = read_smtp_env();

    if (!file_exists($file)) {
        if (is_array($env) && !empty($env['enabled']) && !smtp_config_is_placeholder($env)) {
            $GLOBALS['UGC_MAILER_LAST_INFO'] = smtp_env_info($env, 'ok');
            return $env;
        }

        $GLOBALS['UGC_MAILER_LAST_INFO'] = smtp_env_info(null, 'smtp_file_missing');
        return null;
    }
    $json = file_get_contents($file);
    $data = json_decode($json, true);
    if (!is_array($data)) {
        $GLOBALS['UGC_MAILER_LAST_INFO'] = smtp_env_info(null, 'smtp_invalid_json');
        return null;
    }
    if (array_key_exists('enabled', $data) && !$data['enabled']) {
        $GLOBALS['UGC_MAILER_LAST_INFO'] = smtp_env_info(null, 'smtp_disabled');
        return null;
    }
    if (empty($data['host']) || empty($data['username']) || empty($data['password'])) {
        if (is_array($env) && !empty($env['enabled']) && !smtp_config_is_placeholder($env)) {
            $GLOBALS['UGC_MAILER_LAST_INFO'] = smtp_env_info($env, 'ok');
            return $env;
        }

        $GLOBALS['UGC_MAILER_LAST_INFO'] = smtp_env_info(null, 'smtp_incomplete');
        return null;
    }

    if (smtp_config_is_placeholder($data)) {
        if (is_array($env) && !empty($env['enabled']) && !smtp_config_is_placeholder($env)) {
            $GLOBALS['UGC_MAILER_LAST_INFO'] = smtp_env_info($env, 'ok');
            return $env;
        }

        $GLOBALS['UGC_MAILER_LAST_INFO'] = smtp_env_info(null, 'smtp_placeholder');
        return null;
    }

    $GLOBALS['UGC_MAILER_LAST_INFO'] = smtp_env_info($data, 'ok');
    return $data;
}

function mailer_guess_domain()
{
    $host = $_SERVER['HTTP_HOST'] ?? ($_SERVER['SERVER_NAME'] ?? 'ugcquest.local');
    $host = strtolower(trim((string)$host));
    $host = explode(',', $host)[0];
    $host = trim($host);
    $host = preg_replace('/:\\d+$/', '', $host);
    $host = preg_replace('/[^a-z0-9.-]/', '', $host);
    if (!$host || $host === 'localhost') {
        return 'ugcquest.local';
    }
    return $host;
}

function mailer_default_from_email()
{
    return 'no-reply@' . mailer_guess_domain();
}

function mailer_send_with_mail($to, $subject, $message, $fromEmail, $fromName, &$info)
{
    if (!function_exists('mail')) {
        $info['error'] = 'mail() indisponÃ­vel';
        return false;
    }

    $safeFromEmail = $fromEmail ?: mailer_default_from_email();
    $safeFromName = $fromName ?: 'Makerline';

    $headers = '';
    $headers .= "From: {$safeFromName} <{$safeFromEmail}>\r\n";
    $headers .= "Reply-To: {$safeFromEmail}\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $headers .= "X-Mailer: PHP/" . phpversion() . "\r\n";

    $ok = @mail($to, $subject, $message, $headers);
    $info['sent'] = (bool)$ok;
    $info['driver'] = 'mail';
    if (!$ok && !$info['error']) {
        $info['error'] = 'mail() falhou ou nÃ£o estÃ¡ configurado';
    }
    return $ok;
}

function send_email($to, $subject, $message)
{
    $config = load_smtp_config();
    $info = mailer_last_info();
    if (!is_array($info)) {
        $info = smtp_env_info($config, $config ? 'ok' : 'smtp_unknown');
    }
    $info['driver'] = $config ? 'smtp' : 'mail';
    $info['mailAvailable'] = function_exists('mail');
    $info['error'] = null;
    $info['sent'] = false;

    if ($config) {
        $fromEmail = $config['from_email'] ?? ($config['username'] ?? mailer_default_from_email());
        $host = strtolower((string)($config['host'] ?? ''));
        if (strpos($host, 'gmail.com') !== false) {
            $fromEmail = $config['username'] ?? $fromEmail;
        }
        $fromName = $config['from_name'] ?? 'Makerline';

        $smtpInfo = $info;
        $ok = smtp_send_email($config, $to, $subject, $message, $fromEmail, $fromName, $smtpInfo);
        $GLOBALS['UGC_MAILER_LAST_INFO'] = $smtpInfo;
        if ($ok) {
            return true;
        }

        // Se SMTP falhar mas mail() existir no servidor, tenta uma segunda via.
        $fallbackInfo = $smtpInfo;
        $fallbackInfo['driver'] = 'mail';
        $ok = mailer_send_with_mail($to, $subject, $message, $fromEmail, $fromName, $fallbackInfo);
        $GLOBALS['UGC_MAILER_LAST_INFO'] = $fallbackInfo;
        return $ok;
    }

    $fromEmail = mailer_default_from_email();
    $fromName = 'Makerline';
    $headers = "From: {$fromName} <{$fromEmail}>\r\n";
    $headers .= "Reply-To: {$fromEmail}\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $headers .= "X-Mailer: PHP/" . phpversion() . "\r\n";
    if (function_exists('mail')) {
        $ok = @mail($to, $subject, $message, $headers);
        $info['sent'] = (bool) $ok;
        if (!$ok) {
            $info['error'] = 'mail() falhou ou não está configurado';
        }
        $GLOBALS['UGC_MAILER_LAST_INFO'] = $info;
        return $ok;
    }
    $info['error'] = 'mail() indisponível';
    $GLOBALS['UGC_MAILER_LAST_INFO'] = $info;
    return false;
}
