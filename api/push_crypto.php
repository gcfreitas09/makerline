<?php
// api/push_crypto.php
// Web Push nativo: VAPID (RFC 8292) + criptografia de payload aes128gcm (RFC 8291).
//
// Feito sem biblioteca externa de proposito. A opcao comum (minishlink/web-push)
// exige as extensoes gmp e sodium, que nao estao disponiveis aqui nem sao garantidas
// em hospedagem compartilhada. Tudo abaixo usa so openssl + hash, que ja existem.

require_once __DIR__ . '/supabase_client.php';

const PUSH_VAPID_FILE = __DIR__ . '/../storage/push_vapid.json';
const PUSH_VAPID_SUBJECT = 'mailto:fgui3662@gmail.com';

/** base64 url-safe, sem padding (formato que o padrao web push usa). */
function push_b64url_encode($data)
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function push_b64url_decode($data)
{
    $safe = strtr((string)$data, '-_', '+/');
    $pad = strlen($safe) % 4;
    if ($pad) $safe .= str_repeat('=', 4 - $pad);
    $decoded = base64_decode($safe, true);
    return $decoded === false ? '' : $decoded;
}

/**
 * O XAMPP no Windows nao acha o openssl.cnf sozinho. Em Linux o caminho padrao
 * funciona, entao so passamos config explicito quando encontramos o arquivo.
 */
function push_openssl_config()
{
    static $resolved = null;
    if ($resolved !== null) return $resolved;

    $resolved = [];
    $candidates = [
        __DIR__ . '/../../apache/conf/openssl.cnf',
        'C:/xampp2/apache/conf/openssl.cnf',
        'C:/xampp/apache/conf/openssl.cnf',
    ];
    foreach ($candidates as $candidate) {
        if (is_file($candidate)) {
            $resolved = ['config' => $candidate];
            break;
        }
    }
    return $resolved;
}

function push_new_ec_key()
{
    $args = array_merge([
        'curve_name' => 'prime256v1',
        'private_key_type' => OPENSSL_KEYTYPE_EC,
    ], push_openssl_config());

    return openssl_pkey_new($args);
}

/** Chave publica EC no formato cru nao comprimido: 0x04 || X(32) || Y(32). */
function push_ec_public_raw($key)
{
    $details = openssl_pkey_get_details($key);
    if (!$details || !isset($details['ec']['x'], $details['ec']['y'])) return '';

    return "\x04"
        . str_pad($details['ec']['x'], 32, "\x00", STR_PAD_LEFT)
        . str_pad($details['ec']['y'], 32, "\x00", STR_PAD_LEFT);
}

function push_ec_private_raw($key)
{
    $details = openssl_pkey_get_details($key);
    if (!$details || !isset($details['ec']['d'])) return '';
    return str_pad($details['ec']['d'], 32, "\x00", STR_PAD_LEFT);
}

/**
 * Monta uma chave publica EC utilizavel a partir das coordenadas cruas.
 * Prefixo DER fixo para P-256 (SubjectPublicKeyInfo) + os 65 bytes do ponto.
 */
function push_ec_public_key_from_raw($raw)
{
    if (strlen($raw) !== 65 || $raw[0] !== "\x04") return null;

    $der = hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200') . $raw;
    $pem = "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END PUBLIC KEY-----\n";

    return openssl_pkey_get_public($pem);
}

/** Reconstroi a chave privada EC (PEM) a partir dos bytes crus, pra assinar o VAPID. */
function push_ec_private_key_from_raw($privRaw, $pubRaw)
{
    if (strlen($privRaw) !== 32 || strlen($pubRaw) !== 65) return null;

    // ECPrivateKey (RFC 5915) em DER, com parametros da curva P-256.
    $der = "\x30\x77\x02\x01\x01\x04\x20" . $privRaw
        . "\xa0\x0a\x06\x08\x2a\x86\x48\xce\x3d\x03\x01\x07"
        . "\xa1\x44\x03\x42\x00" . $pubRaw;

    $pem = "-----BEGIN EC PRIVATE KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END EC PRIVATE KEY-----\n";

    return openssl_pkey_get_private($pem);
}

/** Le (ou cria na primeira vez) o par de chaves VAPID do servidor. */
function push_vapid_keys()
{
    if (is_file(PUSH_VAPID_FILE)) {
        $data = json_decode((string)@file_get_contents(PUSH_VAPID_FILE), true);
        if (is_array($data) && !empty($data['publicKey']) && !empty($data['privateKey'])) {
            return $data;
        }
    }

    $key = push_new_ec_key();
    if (!$key) return null;

    $keys = [
        'publicKey' => push_b64url_encode(push_ec_public_raw($key)),
        'privateKey' => push_b64url_encode(push_ec_private_raw($key)),
        'createdAt' => date('c'),
    ];

    $dir = dirname(PUSH_VAPID_FILE);
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    @file_put_contents(PUSH_VAPID_FILE, json_encode($keys, JSON_PRETTY_PRINT), LOCK_EX);

    return $keys;
}

/** Converte assinatura DER do openssl para o formato cru R||S de 64 bytes do ES256. */
function push_der_to_raw_signature($der)
{
    if (strlen($der) < 8 || $der[0] !== "\x30") return '';

    $offset = 2;
    if (ord($der[1]) > 0x80) $offset += ord($der[1]) - 0x80;

    $extract = function ($der, &$offset) {
        if (($der[$offset] ?? '') !== "\x02") return '';
        $len = ord($der[$offset + 1]);
        $val = substr($der, $offset + 2, $len);
        $offset += 2 + $len;
        return ltrim($val, "\x00");
    };

    $r = $extract($der, $offset);
    $s = $extract($der, $offset);
    if ($r === '' || $s === '') return '';

    return str_pad($r, 32, "\x00", STR_PAD_LEFT) . str_pad($s, 32, "\x00", STR_PAD_LEFT);
}

/** Cabecalho Authorization do VAPID para um endpoint. */
function push_vapid_authorization($endpoint)
{
    $keys = push_vapid_keys();
    if (!$keys) return null;

    $parts = parse_url($endpoint);
    if (!$parts || empty($parts['scheme']) || empty($parts['host'])) return null;
    $audience = $parts['scheme'] . '://' . $parts['host'];

    $header = push_b64url_encode(json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
    $payload = push_b64url_encode(json_encode([
        'aud' => $audience,
        'exp' => time() + 43200,
        'sub' => PUSH_VAPID_SUBJECT,
    ]));
    $unsigned = $header . '.' . $payload;

    $privateKey = push_ec_private_key_from_raw(
        push_b64url_decode($keys['privateKey']),
        push_b64url_decode($keys['publicKey'])
    );
    if (!$privateKey) return null;

    $derSignature = '';
    if (!openssl_sign($unsigned, $derSignature, $privateKey, OPENSSL_ALGO_SHA256)) return null;

    $rawSignature = push_der_to_raw_signature($derSignature);
    if ($rawSignature === '') return null;

    $jwt = $unsigned . '.' . push_b64url_encode($rawSignature);

    return [
        'Authorization: vapid t=' . $jwt . ', k=' . $keys['publicKey'],
    ];
}

/**
 * Criptografa o payload no esquema aes128gcm (RFC 8291).
 * Retorna o corpo binario pronto pra enviar ao endpoint do navegador.
 */
function push_encrypt_payload($payload, $p256dhBase64, $authBase64)
{
    $userPublicRaw = push_b64url_decode($p256dhBase64);
    $authSecret = push_b64url_decode($authBase64);
    if (strlen($userPublicRaw) !== 65 || strlen($authSecret) < 16) return null;

    $userPublicKey = push_ec_public_key_from_raw($userPublicRaw);
    if (!$userPublicKey) return null;

    $serverKey = push_new_ec_key();
    if (!$serverKey) return null;
    $serverPublicRaw = push_ec_public_raw($serverKey);

    $sharedSecret = openssl_pkey_derive($userPublicKey, $serverKey, 32);
    if (!$sharedSecret) return null;

    $salt = random_bytes(16);

    // PRK combina o segredo ECDH com o auth_secret da inscricao.
    $prkInfo = "WebPush: info\x00" . $userPublicRaw . $serverPublicRaw;
    $prk = hash_hkdf('sha256', $sharedSecret, 32, $prkInfo, $authSecret);

    $cek = hash_hkdf('sha256', $prk, 16, "Content-Encoding: aes128gcm\x00", $salt);
    $nonce = hash_hkdf('sha256', $prk, 12, "Content-Encoding: nonce\x00", $salt);

    // 0x02 marca o fim do conteudo (delimitador de padding do RFC 8188).
    $plaintext = $payload . "\x02";

    $tag = '';
    $ciphertext = openssl_encrypt($plaintext, 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag);
    if ($ciphertext === false) return null;

    // Cabecalho: salt(16) || record size(4) || tamanho da chave(1) || chave publica(65)
    return $salt
        . pack('N', 4096)
        . pack('C', strlen($serverPublicRaw))
        . $serverPublicRaw
        . $ciphertext
        . $tag;
}

/**
 * Envia uma notificacao para uma inscricao.
 * Retorna ['ok'=>bool, 'status'=>int, 'expired'=>bool].
 * expired=true significa que o navegador descartou a inscricao e ela deve sair do banco.
 */
function push_send_notification($subscription, array $notification)
{
    $endpoint = trim((string)($subscription['endpoint'] ?? ''));
    $p256dh = trim((string)($subscription['p256dh'] ?? ''));
    $auth = trim((string)($subscription['auth'] ?? ''));
    if ($endpoint === '' || $p256dh === '' || $auth === '') {
        return ['ok' => false, 'status' => 0, 'expired' => false, 'error' => 'Inscricao incompleta.'];
    }

    $payload = json_encode($notification, JSON_UNESCAPED_UNICODE);
    $body = push_encrypt_payload($payload, $p256dh, $auth);
    if ($body === null) {
        return ['ok' => false, 'status' => 0, 'expired' => false, 'error' => 'Falha ao criptografar o payload.'];
    }

    $headers = push_vapid_authorization($endpoint);
    if (!$headers) {
        return ['ok' => false, 'status' => 0, 'expired' => false, 'error' => 'Falha ao assinar o VAPID.'];
    }

    $headers[] = 'Content-Type: application/octet-stream';
    $headers[] = 'Content-Encoding: aes128gcm';
    $headers[] = 'TTL: 86400';
    $headers[] = 'Urgency: normal';

    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
    ]);
    $response = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);

    // 404/410 = o navegador removeu a inscricao (app desinstalado, permissao revogada).
    $expired = in_array($status, [404, 410], true);

    return [
        'ok' => $status >= 200 && $status < 300,
        'status' => $status,
        'expired' => $expired,
        'error' => $curlError ?: (($status >= 400) ? trim((string)$response) : ''),
    ];
}
