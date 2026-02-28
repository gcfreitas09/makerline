<?php
// api/url.php

function ugc_current_scheme()
{
    $forwarded = $_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '';
    if ($forwarded) {
        $parts = explode(',', $forwarded);
        $value = strtolower(trim($parts[0] ?? ''));
        if ($value === 'https' || $value === 'http') {
            return $value;
        }
    }

    if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
        return 'https';
    }

    $port = (int)($_SERVER['SERVER_PORT'] ?? 0);
    if ($port === 443) {
        return 'https';
    }

    return 'http';
}

function ugc_current_host()
{
    $host = $_SERVER['HTTP_X_FORWARDED_HOST'] ?? ($_SERVER['HTTP_HOST'] ?? ($_SERVER['SERVER_NAME'] ?? 'localhost'));
    $host = (string)$host;
    $parts = explode(',', $host);
    return trim($parts[0] ?? 'localhost');
}

function ugc_base_path()
{
    $script = (string)($_SERVER['SCRIPT_NAME'] ?? '');
    $basePath = rtrim(dirname(dirname($script)), '/');
    if ($basePath === '/' || $basePath === '.') {
        return '';
    }
    return $basePath;
}

function ugc_base_url()
{
    return ugc_current_scheme() . '://' . ugc_current_host() . ugc_base_path();
}

