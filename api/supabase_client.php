<?php
// api/supabase_client.php
require_once __DIR__ . '/supabase.php';

$GLOBALS['UGC_SUPABASE_LAST_HTTP'] = null;

function supabase_client_last_info()
{
    return $GLOBALS['UGC_SUPABASE_LAST_HTTP'];
}

function supabase_client_set_last_info($info)
{
    $GLOBALS['UGC_SUPABASE_LAST_HTTP'] = $info;
}

function supabase_client_build_url($config, $table, $query = [])
{
    $base = rtrim((string)($config['url'] ?? ''), '/');
    $path = $base . '/rest/v1/' . rawurlencode((string)$table);
    if (is_array($query) && count($query)) {
        $path .= '?' . http_build_query($query, '', '&', PHP_QUERY_RFC3986);
    }
    return $path;
}

function supabase_client_http_request($method, $url, $headers, $body, $timeoutSeconds)
{
    $method = strtoupper((string)$method);
    $timeout = (int)$timeoutSeconds;
    if ($timeout <= 0) $timeout = 12;

    if (function_exists('curl_init')) {
        $ch = curl_init();
        if (!$ch) return [0, null, null, 'Falha ao iniciar cURL.'];

        $headerLines = [];
        foreach ((array)$headers as $key => $value) {
            $headerLines[] = "{$key}: {$value}";
        }

        curl_setopt_array($ch, [
            CURLOPT_URL => $url,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HEADER => true,
            CURLOPT_TIMEOUT => $timeout,
            CURLOPT_HTTPHEADER => $headerLines
        ]);

        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
        }

        $raw = curl_exec($ch);
        if ($raw === false) {
            $err = curl_error($ch);
            curl_close($ch);
            return [0, null, null, $err ?: 'Falha ao chamar Supabase.'];
        }

        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $headerSize = (int)curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        curl_close($ch);

        $rawHeaders = substr($raw, 0, $headerSize);
        $rawBody = substr($raw, $headerSize);

        return [$status, $rawBody, $rawHeaders, null];
    }

    // Fallback sem cURL
    $headerLines = [];
    foreach ((array)$headers as $key => $value) {
        $headerLines[] = "{$key}: {$value}";
    }

    $opts = [
        'http' => [
            'method' => $method,
            'header' => implode("\r\n", $headerLines),
            'ignore_errors' => true,
            'timeout' => $timeout
        ]
    ];
    if ($body !== null) {
        $opts['http']['content'] = $body;
    }

    $context = stream_context_create($opts);
    $rawBody = @file_get_contents($url, false, $context);
    $headersOut = isset($http_response_header) ? implode("\r\n", $http_response_header) : null;

    $status = 0;
    if (isset($http_response_header[0])) {
        if (preg_match('/\s(\d{3})\s/', (string)$http_response_header[0], $m)) {
            $status = (int)$m[1];
        }
    }

    if ($rawBody === false) {
        return [$status ?: 0, null, $headersOut, 'Falha ao chamar Supabase (allow_url_fopen desligado?).'];
    }

    return [$status ?: 200, $rawBody, $headersOut, null];
}

function supabase_client_request($method, $table, $query = [], $payload = null, $extraHeaders = [])
{
    $config = supabase_config();
    if (!$config || empty($config['enabled'])) {
        return ['ok' => false, 'status' => 0, 'data' => null, 'error' => 'Supabase não configurado.'];
    }

    $url = supabase_client_build_url($config, $table, $query);

    $headers = [
        'Authorization' => 'Bearer ' . (string)$config['service_key'],
        'apikey' => (string)$config['service_key'],
        'Accept' => 'application/json'
    ];

    $body = null;
    if ($payload !== null) {
        $headers['Content-Type'] = 'application/json';
        $body = json_encode($payload, JSON_UNESCAPED_UNICODE);
    }

    foreach ((array)$extraHeaders as $k => $v) {
        $headers[(string)$k] = (string)$v;
    }

    [$status, $rawBody, $rawHeaders, $httpError] = supabase_client_http_request(
        $method,
        $url,
        $headers,
        $body,
        (int)($config['timeout'] ?? 12)
    );

    $info = [
        'ok' => false,
        'status' => $status,
        'url' => $config['url'] ?? null,
        'table' => $table,
        'error' => $httpError ?: null
    ];

    $parsed = null;
    if (is_string($rawBody) && trim($rawBody) !== '') {
        $decoded = json_decode($rawBody, true);
        if (is_array($decoded) || is_object($decoded)) {
            $parsed = $decoded;
        }
    }

    if ($httpError) {
        supabase_client_set_last_info($info);
        return ['ok' => false, 'status' => 0, 'data' => $parsed, 'error' => $httpError];
    }

    $ok = $status >= 200 && $status < 300;
    $info['ok'] = $ok;

    if (!$ok) {
        $message = null;
        if (is_array($parsed)) {
            $message = $parsed['message'] ?? ($parsed['error'] ?? null);
        }
        if (!$message && is_string($rawBody)) {
            $message = trim($rawBody);
        }

        $info['error'] = $message ?: "Erro HTTP {$status}";
        supabase_client_set_last_info($info);
        return ['ok' => false, 'status' => $status, 'data' => $parsed, 'error' => $info['error']];
    }

    supabase_client_set_last_info($info);
    return ['ok' => true, 'status' => $status, 'data' => $parsed, 'error' => null];
}

