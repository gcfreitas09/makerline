<?php
// api/smtp_client.php

function smtp_is_ascii($value)
{
    return preg_match('/^[\x20-\x7E]*$/', (string)$value) === 1;
}

function smtp_encode_header($value)
{
    $text = (string)$value;
    if ($text === '') return '';
    if (smtp_is_ascii($text)) return $text;
    return '=?UTF-8?B?' . base64_encode($text) . '?=';
}

function smtp_read_reply($fp)
{
    $reply = '';
    while (!feof($fp)) {
        $line = fgets($fp, 515);
        if ($line === false) break;
        $reply .= $line;
        if (preg_match('/^\d{3}\s/', $line)) break;
    }
    return trim($reply);
}

function smtp_reply_code($reply)
{
    if (preg_match('/^(\d{3})/', (string)$reply, $m)) {
        return (int)$m[1];
    }
    return 0;
}

function smtp_expect($fp, $expectedCodes, &$debug)
{
    $reply = smtp_read_reply($fp);
    $debug[] = $reply;
    $code = smtp_reply_code($reply);
    $expected = is_array($expectedCodes) ? $expectedCodes : [$expectedCodes];
    foreach ($expected as $ok) {
        if ((int)$ok === $code) return [true, $reply];
    }
    return [false, $reply];
}

function smtp_write($fp, $cmd, &$debug, $log = null)
{
    $debug[] = '> ' . ($log !== null ? (string)$log : $cmd);
    fwrite($fp, $cmd . "\r\n");
}

function smtp_enable_crypto($fp, $allowSelfSigned, &$debug)
{
    $method = null;
    if (defined('STREAM_CRYPTO_METHOD_TLS_CLIENT')) {
        $method = STREAM_CRYPTO_METHOD_TLS_CLIENT;
    } elseif (defined('STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT')) {
        $method = STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT;
    } elseif (defined('STREAM_CRYPTO_METHOD_TLSv1_1_CLIENT')) {
        $method = STREAM_CRYPTO_METHOD_TLSv1_1_CLIENT;
    } elseif (defined('STREAM_CRYPTO_METHOD_TLSv1_0_CLIENT')) {
        $method = STREAM_CRYPTO_METHOD_TLSv1_0_CLIENT;
    }

    $ok = @stream_socket_enable_crypto($fp, true, $method);
    $debug[] = $ok ? 'TLS: ok' : 'TLS: falhou';
    return (bool)$ok;
}

function smtp_send_email($config, $to, $subject, $message, $fromEmail, $fromName, &$info)
{
    $debug = [];

    $host = trim((string)($config['host'] ?? ''));
    $port = (int)($config['port'] ?? 0);
    $secure = strtolower(trim((string)($config['secure'] ?? 'tls')));
    $username = (string)($config['username'] ?? '');
    $password = (string)($config['password'] ?? '');

    if ($host === '' || $username === '' || $password === '') {
        $info['error'] = 'SMTP incompleto (host/username/password).';
        $info['smtpDebug'] = $debug;
        return false;
    }

    if ($port <= 0) {
        $port = $secure === 'ssl' ? 465 : 587;
    }

    $allowSelfSigned = !empty($config['allow_self_signed']);
    $envAllow = getenv('UGC_SMTP_ALLOW_SELF_SIGNED');
    if ($envAllow !== false) {
        $envBool = filter_var($envAllow, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        if ($envBool !== null) $allowSelfSigned = (bool)$envBool;
    }

    $contextOptions = [];
    if ($allowSelfSigned) {
        $contextOptions['ssl'] = [
            'verify_peer' => false,
            'verify_peer_name' => false,
            'allow_self_signed' => true
        ];
    }
    $context = stream_context_create($contextOptions);

    $remote = ($secure === 'ssl' ? 'ssl://' : '') . $host . ':' . $port;
    $fp = @stream_socket_client($remote, $errno, $errstr, 12, STREAM_CLIENT_CONNECT, $context);
    if (!$fp) {
        $info['error'] = "Falha ao conectar no SMTP ({$host}:{$port}) - {$errstr}";
        $info['smtpDebug'] = $debug;
        return false;
    }

    stream_set_timeout($fp, 12);

    [$ok, $reply] = smtp_expect($fp, 220, $debug);
    if (!$ok) {
        fclose($fp);
        $info['error'] = 'SMTP: sem greeting 220';
        $info['smtpDebug'] = $debug;
        return false;
    }

    $clientName = 'ugcquest';
    $domain = $_SERVER['HTTP_HOST'] ?? '';
    if ($domain) {
        $domain = preg_replace('/:\d+$/', '', (string)$domain);
        $domain = preg_replace('/[^a-z0-9.-]/i', '', $domain);
        if ($domain) $clientName = $domain;
    }

    smtp_write($fp, 'EHLO ' . $clientName, $debug);
    [$ok, $reply] = smtp_expect($fp, 250, $debug);
    if (!$ok) {
        smtp_write($fp, 'HELO ' . $clientName, $debug);
        [$ok, $reply] = smtp_expect($fp, 250, $debug);
        if (!$ok) {
            fclose($fp);
            $info['error'] = 'SMTP: EHLO/HELO falhou';
            $info['smtpDebug'] = $debug;
            return false;
        }
    }

    if ($secure !== 'ssl') {
        smtp_write($fp, 'STARTTLS', $debug);
        [$ok, $reply] = smtp_expect($fp, 220, $debug);
        if ($ok) {
            if (!smtp_enable_crypto($fp, $allowSelfSigned, $debug)) {
                fclose($fp);
                $info['error'] = 'SMTP: não consegui iniciar TLS';
                $info['smtpDebug'] = $debug;
                return false;
            }
            smtp_write($fp, 'EHLO ' . $clientName, $debug);
            [$ok, $reply] = smtp_expect($fp, 250, $debug);
            if (!$ok) {
                fclose($fp);
                $info['error'] = 'SMTP: EHLO pós-TLS falhou';
                $info['smtpDebug'] = $debug;
                return false;
            }
        } else {
            // Alguns servidores não aceitam STARTTLS nesse modo; segue sem TLS.
            $debug[] = 'STARTTLS não disponível, seguindo sem TLS';
        }
    }

    smtp_write($fp, 'AUTH LOGIN', $debug);
    [$ok, $reply] = smtp_expect($fp, 334, $debug);
    if (!$ok) {
        fclose($fp);
        $info['error'] = 'SMTP: AUTH LOGIN falhou';
        $info['smtpDebug'] = $debug;
        return false;
    }

    smtp_write($fp, base64_encode($username), $debug, '[username]');
    [$ok, $reply] = smtp_expect($fp, 334, $debug);
    if (!$ok) {
        fclose($fp);
        $info['error'] = 'SMTP: usuário rejeitado';
        $info['smtpDebug'] = $debug;
        return false;
    }

    smtp_write($fp, base64_encode($password), $debug, '[password]');
    [$ok, $reply] = smtp_expect($fp, 235, $debug);
    if (!$ok) {
        fclose($fp);
        $info['error'] = 'SMTP: senha rejeitada';
        $info['smtpDebug'] = $debug;
        return false;
    }

    $safeFromEmail = $fromEmail ?: $username;
    $safeFromEmail = trim((string)$safeFromEmail);
    $safeTo = trim((string)$to);

    smtp_write($fp, 'MAIL FROM:<' . $safeFromEmail . '>', $debug);
    [$ok, $reply] = smtp_expect($fp, 250, $debug);
    if (!$ok) {
        fclose($fp);
        $info['error'] = 'SMTP: MAIL FROM falhou';
        $info['smtpDebug'] = $debug;
        return false;
    }

    smtp_write($fp, 'RCPT TO:<' . $safeTo . '>', $debug);
    [$ok, $reply] = smtp_expect($fp, [250, 251], $debug);
    if (!$ok) {
        fclose($fp);
        $info['error'] = 'SMTP: RCPT TO falhou';
        $info['smtpDebug'] = $debug;
        return false;
    }

    smtp_write($fp, 'DATA', $debug);
    [$ok, $reply] = smtp_expect($fp, 354, $debug);
    if (!$ok) {
        fclose($fp);
        $info['error'] = 'SMTP: DATA falhou';
        $info['smtpDebug'] = $debug;
        return false;
    }

    $safeFromName = $fromName ?: 'Makerline';
    $encodedSubject = smtp_encode_header($subject);
    $encodedFromName = smtp_encode_header($safeFromName);

    $headers = [];
    $headers[] = 'From: ' . $encodedFromName . ' <' . $safeFromEmail . '>';
    $headers[] = 'To: <' . $safeTo . '>';
    $headers[] = 'Subject: ' . $encodedSubject;
    $headers[] = 'MIME-Version: 1.0';
    $headers[] = 'Content-Type: text/plain; charset=UTF-8';
    $headers[] = 'Content-Transfer-Encoding: 8bit';

    $body = implode("\r\n", $headers) . "\r\n\r\n" . (string)$message;
    $body = preg_replace("/(?m)^\./", '..', $body);

    fwrite($fp, $body . "\r\n.\r\n");
    [$ok, $reply] = smtp_expect($fp, 250, $debug);
    if (!$ok) {
        fclose($fp);
        $info['error'] = 'SMTP: envio falhou';
        $info['smtpDebug'] = $debug;
        return false;
    }

    smtp_write($fp, 'QUIT', $debug);
    smtp_expect($fp, [221, 250], $debug);
    fclose($fp);

    $info['sent'] = true;
    $info['driver'] = 'smtp';
    $info['smtpDebug'] = $debug;
    return true;
}
