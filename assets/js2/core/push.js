/**
 * Notificacoes push do Makerline (Web Push + VAPID).
 *
 * Ponto importante do iPhone: o Safari so entrega push se a pessoa tiver
 * adicionado o Makerline a tela de inicio. Por isso isSupported() checa
 * standalone no iOS, e a UI usa isIosNeedsInstall() pra explicar o passo
 * em vez de pedir uma permissao que o navegador ia recusar calado.
 */

const getToken = () => {
  try {
    return sessionStorage.getItem('ugcQuestToken') || localStorage.getItem('ugcQuestSessionToken') || '';
  } catch (error) {
    return '';
  }
};

const isIos = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

/** No iOS o push exige o app instalado na tela de inicio. */
const isIosNeedsInstall = () => isIos() && !isStandalone();

const isSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const getPermission = () => (('Notification' in window) ? Notification.permission : 'unsupported');

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
};

const arrayBufferToBase64Url = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) binary += String.fromCharCode(bytes[i]);
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/**
 * Caminho relativo de proposito: em producao o app fica na raiz do dominio e o
 * escopo vira "/", enquanto no XAMPP local ele fica em /saas-ugc/ e o escopo
 * acompanha. Com caminho absoluto, o registro quebraria em um dos dois.
 */
const getServiceWorkerUrl = () => {
  const path = window.location.pathname;
  const base = path.slice(0, path.lastIndexOf('/') + 1);
  return { url: base + 'sw.js', scope: base };
};

const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const { url, scope } = getServiceWorkerUrl();
    return await navigator.serviceWorker.register(url, { scope });
  } catch (error) {
    return null;
  }
};

const fetchPublicKey = async () => {
  const response = await fetch('api/push_subscribe.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'public-key' }),
  });
  const data = await response.json().catch(() => null);
  return data && data.ok ? String(data.publicKey || '') : '';
};

/** Pede permissao e registra a inscricao no backend. Retorna {ok, reason}. */
const enablePushNotifications = async () => {
  if (!isSupported()) return { ok: false, reason: 'unsupported' };
  if (isIosNeedsInstall()) return { ok: false, reason: 'ios-needs-install' };

  const token = getToken();
  if (!token) return { ok: false, reason: 'no-session' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'denied' };

  const registration = await registerServiceWorker();
  if (!registration) return { ok: false, reason: 'sw-failed' };
  await navigator.serviceWorker.ready;

  const publicKey = await fetchPublicKey();
  if (!publicKey) return { ok: false, reason: 'no-key' };

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const response = await fetch('api/push_subscribe.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'subscribe',
      token,
      endpoint: subscription.endpoint,
      p256dh: arrayBufferToBase64Url(subscription.getKey('p256dh')),
      auth: arrayBufferToBase64Url(subscription.getKey('auth')),
    }),
  });

  const data = await response.json().catch(() => null);
  return data && data.ok ? { ok: true } : { ok: false, reason: 'save-failed' };
};

const disablePushNotifications = async () => {
  if (!('serviceWorker' in navigator)) return { ok: true };

  const registration = await navigator.serviceWorker.getRegistration(getServiceWorkerUrl().scope);
  const subscription = registration ? await registration.pushManager.getSubscription() : null;
  if (!subscription) return { ok: true };

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe().catch(() => {});

  await fetch('api/push_subscribe.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'unsubscribe', token: getToken(), endpoint }),
  }).catch(() => {});

  return { ok: true };
};

const isPushActive = async () => {
  if (!isSupported()) return false;
  if (getPermission() !== 'granted') return false;
  try {
    const registration = await navigator.serviceWorker.getRegistration(getServiceWorkerUrl().scope);
    if (!registration) return false;
    return Boolean(await registration.pushManager.getSubscription());
  } catch (error) {
    return false;
  }
};

/**
 * Registra o service worker no boot. Isso e o que torna o app instalavel
 * na tela de inicio, mesmo antes de a pessoa aceitar notificacao.
 */
const initPushRuntime = () => {
  if (!('serviceWorker' in navigator)) return;
  if (window.location.protocol === 'file:') return;
  registerServiceWorker();
};

export {
  initPushRuntime,
  enablePushNotifications,
  disablePushNotifications,
  isPushActive,
  isSupported,
  isIosNeedsInstall,
  getPermission,
};
