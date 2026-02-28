<?php
// api/smtp_example.php
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

$file = __DIR__ . '/../storage/smtp.example.json';
if (!file_exists($file)) {
    http_response_code(404);
    echo json_encode(['error' => 'Arquivo smtp.example.json não encontrado'], JSON_UNESCAPED_UNICODE);
    exit;
}

echo file_get_contents($file);
