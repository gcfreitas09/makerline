<?php
require_once __DIR__ . '/referrals.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

function referral_lookup_respond($status, $data = [])
{
    http_response_code((int)$status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$code = trim((string)($_GET['ref'] ?? ($_GET['code'] ?? $_GET['slug'] ?? '')));
if ($code === '') {
    referral_lookup_respond(400, ['ok' => false, 'error' => 'Codigo de parceiro obrigatorio.']);
}

$partner = referrals_partner_by_code($code);
if (!$partner) {
    referral_lookup_respond(404, ['ok' => false, 'error' => 'Parceiro nao encontrado.']);
}

referral_lookup_respond(200, [
    'ok' => true,
    'partner' => referrals_public_partner_payload($partner),
]);
