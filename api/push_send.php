<?php
// api/push_send.php
// Varre as contas procurando entregas vencendo e pagamentos previstos/atrasados,
// e dispara a notificacao para quem estiver inscrito.
//
// Para rodar todo dia, agende no painel da hospedagem (cron):
//   curl -s "https://makerline.com.br/api/push_send.php?key=SEGREDO"
// O SEGREDO fica em storage/push_vapid.json (campo cronKey), criado no primeiro uso.

ini_set('display_errors', '0');
error_reporting(0);
set_time_limit(300);

require_once __DIR__ . '/users_store.php';
require_once __DIR__ . '/states_store.php';
require_once __DIR__ . '/push_crypto.php';

header('Content-Type: application/json; charset=UTF-8');

const PUSH_DEADLINE_WINDOW_DAYS = 2;
const PUSH_PAYMENT_WINDOW_DAYS = 1;

function push_send_respond($status, $data = [])
{
    http_response_code((int)$status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function push_table($key, $fallback)
{
    $config = function_exists('supabase_config') ? supabase_config() : null;
    $table = is_array($config) ? trim((string)($config[$key] ?? '')) : '';
    return $table !== '' ? $table : $fallback;
}

/** Cria (uma vez) e devolve a chave secreta usada pra autorizar o cron. */
function push_cron_key()
{
    $keys = push_vapid_keys();
    if (!$keys) return '';

    if (!empty($keys['cronKey'])) return (string)$keys['cronKey'];

    $keys['cronKey'] = bin2hex(random_bytes(16));
    @file_put_contents(PUSH_VAPID_FILE, json_encode($keys, JSON_PRETTY_PRINT), LOCK_EX);
    return $keys['cronKey'];
}

function push_days_until($dateString)
{
    $safe = trim((string)$dateString);
    if ($safe === '') return null;

    $timestamp = strtotime($safe);
    if ($timestamp === false) return null;

    $today = strtotime('today');
    $target = strtotime(date('Y-m-d', $timestamp));
    return (int)round(($target - $today) / 86400);
}

function push_format_money($value)
{
    $number = is_numeric($value) ? (float)$value : 0.0;
    return 'R$ ' . number_format($number, 2, ',', '.');
}

function push_deadline_message($campaign, $days)
{
    $brand = trim((string)($campaign['brand'] ?? $campaign['title'] ?? 'sua campanha'));

    if ($days < 0) {
        $late = abs($days);
        return ['Entrega atrasada', $brand . ' venceu há ' . $late . ($late === 1 ? ' dia' : ' dias') . '.'];
    }
    if ($days === 0) return ['Entrega é hoje', $brand . ' vence hoje.'];
    if ($days === 1) return ['Entrega amanhã', $brand . ' vence amanhã.'];

    return ['Entrega chegando', $brand . ' vence em ' . $days . ' dias.'];
}

function push_payment_message($campaign, $days)
{
    $brand = trim((string)($campaign['brand'] ?? $campaign['title'] ?? 'uma campanha'));
    $value = push_format_money($campaign['value'] ?? 0);

    if ($days < 0) {
        $late = abs($days);
        return ['Pagamento atrasado', $value . ' de ' . $brand . ' está ' . $late . ($late === 1 ? ' dia' : ' dias') . ' atrasado.'];
    }
    if ($days === 0) return ['Pagamento previsto pra hoje', $value . ' de ' . $brand . ' deve cair hoje.'];

    return ['Pagamento chegando', $value . ' de ' . $brand . ' está previsto pra amanhã.'];
}

/** Monta a lista de avisos pendentes de um state. */
function push_build_notifications($state)
{
    $notifications = [];
    $campaigns = is_array($state['campaigns'] ?? null) ? $state['campaigns'] : [];

    foreach ($campaigns as $campaign) {
        if (!is_array($campaign)) continue;
        if (!empty($campaign['archived']) || !empty($campaign['paused'])) continue;

        $status = strtolower(trim((string)($campaign['status'] ?? '')));
        $campaignId = trim((string)($campaign['id'] ?? ''));
        if ($campaignId === '') continue;

        // 1) Entrega chegando ou atrasada
        if ($status !== 'concluida') {
            $days = push_days_until($campaign['dueDate'] ?? '');
            if ($days !== null && $days <= PUSH_DEADLINE_WINDOW_DAYS) {
                [$title, $bodyText] = push_deadline_message($campaign, $days);
                $notifications[] = [
                    'type' => 'deadline',
                    'dedupe' => 'deadline:' . $campaignId . ':' . date('Y-m-d'),
                    'title' => $title,
                    'body' => $bodyText,
                    'tag' => 'deadline-' . $campaignId,
                    'url' => '/app.html?page=campaigns',
                ];
            }
        }

        // 2) Pagamento previsto ou atrasado (so se ainda nao foi recebido)
        $paymentPercent = (int)($campaign['paymentPercent'] ?? 0);
        $received = trim((string)($campaign['paymentReceivedAt'] ?? ''));
        if ($paymentPercent < 100 && $received === '') {
            $days = push_days_until($campaign['paymentDate'] ?? '');
            if ($days !== null && $days <= PUSH_PAYMENT_WINDOW_DAYS) {
                [$title, $bodyText] = push_payment_message($campaign, $days);
                $notifications[] = [
                    'type' => 'payment',
                    'dedupe' => 'payment:' . $campaignId . ':' . date('Y-m-d'),
                    'title' => $title,
                    'body' => $bodyText,
                    'tag' => 'payment-' . $campaignId,
                    'url' => '/app.html?page=finance',
                ];
            }
        }
    }

    return $notifications;
}

function push_already_sent($logTable, $userId, $dedupeKey)
{
    $response = supabase_client_request('GET', $logTable, [
        'select' => 'id',
        'user_id' => 'eq.' . $userId,
        'dedupe_key' => 'eq.' . $dedupeKey,
        'limit' => '1',
    ], null);

    if (($response['ok'] ?? false) !== true) return false;
    return !empty($response['data']);
}

function push_mark_sent($logTable, $userId, $dedupeKey)
{
    supabase_client_request('POST', $logTable, ['on_conflict' => 'user_id,dedupe_key'], [
        'id' => 'sent_' . substr(hash('sha256', $userId . '|' . $dedupeKey), 0, 32),
        'user_id' => $userId,
        'dedupe_key' => $dedupeKey,
        'sent_at' => date('c'),
    ], ['Prefer' => 'resolution=merge-duplicates,return=minimal']);
}

// ---------------------------------------------------------------- execucao

$providedKey = trim((string)($_GET['key'] ?? ''));
$expectedKey = push_cron_key();

if ($expectedKey === '' || !hash_equals($expectedKey, $providedKey)) {
    push_send_respond(403, ['ok' => false, 'error' => 'Chave invalida.']);
}

$subsTable = push_table('table_push_subscriptions', 'push_subscriptions');
$logTable = push_table('table_push_sent_log', 'push_sent_log');
$dryRun = !empty($_GET['dry']);

// ?teste=1 dispara um aviso de teste pra todo mundo que estiver inscrito, sem
// depender de existir prazo ou pagamento de verdade. Serve pra confirmar que a
// corrente inteira funciona: navegador -> banco -> servidor -> notificacao.
if (!empty($_GET['teste'])) {
    $subsResponse = supabase_client_request('GET', $subsTable, ['select' => '*', 'limit' => '200'], null);
    $subscriptions = is_array($subsResponse['data'] ?? null) ? $subsResponse['data'] : [];

    if (!$subscriptions) {
        push_send_respond(200, [
            'ok' => true,
            'aviso' => 'Nenhum aparelho inscrito ainda. Ative "Avisos no celular" nas Configuracoes do app primeiro.',
            'inscricoes' => 0,
        ]);
    }

    $resultados = [];
    foreach ($subscriptions as $sub) {
        $r = push_send_notification($sub, [
            'title' => 'Makerline funcionando',
            'body' => 'Se voce esta lendo isso, as notificacoes estao ativas.',
            'tag' => 'teste',
            'url' => '/app.html',
        ]);
        $resultados[] = [
            'email' => $sub['user_email'] ?? '',
            'enviado' => !empty($r['ok']),
            'status' => $r['status'] ?? 0,
            'erro' => $r['error'] ?? '',
        ];

        if (!empty($r['expired'])) {
            supabase_client_request('DELETE', $subsTable, ['endpoint' => 'eq.' . $sub['endpoint']], null, ['Prefer' => 'return=minimal']);
        }
    }

    push_send_respond(200, ['ok' => true, 'modo' => 'teste', 'inscricoes' => count($subscriptions), 'resultados' => $resultados]);
}

$subsResponse = supabase_client_request('GET', $subsTable, [
    'select' => '*',
    'limit' => '1000',
], null);

if (($subsResponse['ok'] ?? false) !== true) {
    push_send_respond(500, ['ok' => false, 'error' => 'Nao consegui carregar as inscricoes.']);
}

$subscriptions = is_array($subsResponse['data'] ?? null) ? $subsResponse['data'] : [];

// Agrupa por usuario: uma pessoa pode ter varios aparelhos inscritos.
$byUser = [];
foreach ($subscriptions as $sub) {
    if (!is_array($sub)) continue;
    $userId = trim((string)($sub['user_id'] ?? ''));
    if ($userId === '') continue;
    $byUser[$userId][] = $sub;
}

$stats = ['usuarios' => 0, 'avisos' => 0, 'enviados' => 0, 'falhas' => 0, 'inscricoes_removidas' => 0];
$preview = [];

foreach ($byUser as $userId => $userSubs) {
    $statePayload = states_store_load_by_user_id($userId);
    $state = is_array($statePayload['state'] ?? null) ? $statePayload['state'] : null;
    if (!$state) continue;

    $notifications = push_build_notifications($state);
    if (!$notifications) continue;

    $stats['usuarios']++;

    foreach ($notifications as $notification) {
        if (push_already_sent($logTable, $userId, $notification['dedupe'])) continue;

        $stats['avisos']++;

        if ($dryRun) {
            $preview[] = ['userId' => $userId, 'title' => $notification['title'], 'body' => $notification['body']];
            continue;
        }

        $deliveredToAnyDevice = false;

        foreach ($userSubs as $sub) {
            // Respeita a preferencia por tipo de aviso.
            if ($notification['type'] === 'deadline' && isset($sub['notify_deadlines']) && !$sub['notify_deadlines']) continue;
            if ($notification['type'] === 'payment' && isset($sub['notify_payments']) && !$sub['notify_payments']) continue;

            $result = push_send_notification($sub, [
                'title' => $notification['title'],
                'body' => $notification['body'],
                'tag' => $notification['tag'],
                'url' => $notification['url'],
            ]);

            if (!empty($result['ok'])) {
                $deliveredToAnyDevice = true;
                $stats['enviados']++;
            } else {
                $stats['falhas']++;
                if (!empty($result['expired'])) {
                    supabase_client_request('DELETE', $subsTable, ['endpoint' => 'eq.' . $sub['endpoint']], null, ['Prefer' => 'return=minimal']);
                    $stats['inscricoes_removidas']++;
                }
            }
        }

        // So marca como enviado se ao menos um aparelho recebeu, senao tenta de novo amanha.
        if ($deliveredToAnyDevice) {
            push_mark_sent($logTable, $userId, $notification['dedupe']);
        }
    }
}

push_send_respond(200, array_filter([
    'ok' => true,
    'dryRun' => $dryRun,
    'geradoEm' => date('c'),
    'stats' => $stats,
    'preview' => $dryRun ? $preview : null,
], fn($v) => $v !== null));
