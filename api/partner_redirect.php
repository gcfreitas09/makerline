<?php
require_once __DIR__ . '/referrals.php';

header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

$slug = trim((string)($_GET['slug'] ?? $_GET['ref'] ?? ''));
$partner = $slug !== '' ? referrals_partner_by_code($slug) : null;

if (!$partner) {
    http_response_code(302);
    header('Location: ../landing.html');
    exit;
}

$payload = referrals_public_partner_payload($partner);
$target = (string)($payload['signupUrl'] ?? '../landing.html');
$parts = parse_url($target);
$queryPairs = [];

if (!empty($parts['query'])) {
    parse_str((string)$parts['query'], $queryPairs);
}

foreach ($_GET as $key => $value) {
    if ($key === 'slug' || $key === 'ref') continue;
    if (is_array($value)) continue;
    $queryPairs[$key] = (string)$value;
}

$path = '';
if (!empty($parts['scheme']) && !empty($parts['host'])) {
    $path .= $parts['scheme'] . '://' . $parts['host'];
    if (!empty($parts['port'])) {
        $path .= ':' . $parts['port'];
    }
}
if (!empty($parts['path'])) {
    $path .= $parts['path'];
}

$query = http_build_query($queryPairs);
if ($query !== '') {
    $path .= '?' . $query;
}
if (!empty($parts['fragment'])) {
    $path .= '#' . $parts['fragment'];
}

http_response_code(302);
header('Location: ' . $path);
exit;
