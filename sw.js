/**
 * Service worker do Makerline.
 *
 * Responsabilidades:
 *  1. Existir, para o app poder ser instalado na tela de inicio (requisito do
 *     push no iPhone: sem instalar como app, o iOS nao entrega notificacao).
 *  2. Receber o push e mostrar a notificacao.
 *  3. Levar a pessoa para a tela certa quando ela toca na notificacao.
 *
 * Nao faz cache de conteudo de proposito: o app depende de dados sempre atuais
 * (prazos, valores, status), e cache errado aqui causaria confusao real.
 */

const NOTIFICATION_ICON = '/assets/img/logo.png';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    payload = {};
  }

  const title = payload.title || 'Makerline';
  const options = {
    body: payload.body || '',
    icon: NOTIFICATION_ICON,
    badge: NOTIFICATION_ICON,
    tag: payload.tag || 'makerline',
    // Notificacao nova do mesmo assunto substitui a anterior em vez de empilhar.
    renotify: Boolean(payload.tag),
    data: { url: payload.url || '/app.html' },
    lang: 'pt-BR',
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/app.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Se o app ja estiver aberto, foca a aba existente em vez de abrir outra.
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
    })
  );
});
