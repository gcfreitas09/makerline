const ADMIN_USERS_CACHE_KEY = 'ugcQuestAdminUsersCacheV2';
const ADMIN_USERS_CACHE_TTL_MS = 5 * 60 * 1000;

let trackerRequest = null;
let trackerLoaded = false;

const getEls = () => ({
  card: document.getElementById('admin-tracker-card'),
  msg: document.getElementById('admin-tracker-msg')
});

const setMsg = (text) => {
  const { msg } = getEls();
  if (!msg) return;
  msg.textContent = text || '';
};

const setBtnEnabled = (enabled) => {
  const { card } = getEls();
  if (!card) return;
  const btn = card.querySelector('a[href="admin.html"]');
  if (!btn) return;
  btn.classList.toggle('is-disabled', !enabled);
  btn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
  if (!enabled) btn.setAttribute('tabindex', '-1');
  else btn.removeAttribute('tabindex');
};

const getCountFromPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return 0;
  if (Number.isFinite(payload.count)) return payload.count;
  if (Array.isArray(payload.users)) return payload.users.length;
  return 0;
};

const setSummaryMessage = (count) => {
  setMsg(count ? `Tem ${count} cadastro${count === 1 ? '' : 's'} rolando.` : 'Ainda não tem cadastros por aqui.');
};

const readUsersCache = () => {
  try {
    const raw = sessionStorage.getItem(ADMIN_USERS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const viewerId = String(getSessionUserId() || '');
    const cacheViewerId = String(parsed.viewerId || '');
    if (!viewerId || cacheViewerId !== viewerId) return null;
    const ts = Number(parsed.ts) || 0;
    if (ts <= 0 || Date.now() - ts > ADMIN_USERS_CACHE_TTL_MS) return null;
    if (!Array.isArray(parsed.users) && !Number.isFinite(parsed.count)) return null;
    return parsed;
  } catch (e) {
    return null;
  }
};

const writeUsersCache = (payload) => {
  try {
    const users = Array.isArray(payload?.users) ? payload.users : [];
    const count = Number.isFinite(payload?.count) ? payload.count : users.length;
    const viewerId = String(getSessionUserId() || '');
    if (!viewerId) return;
    sessionStorage.setItem(
      ADMIN_USERS_CACHE_KEY,
      JSON.stringify({
        ts: Date.now(),
        viewerId,
        count,
        users
      })
    );
  } catch (e) {}
};

const getSessionToken = () => {
  try {
    return sessionStorage.getItem('ugcQuestToken') || '';
  } catch (e) {
    return '';
  }
};

const getSessionUserId = () => {
  try {
    return sessionStorage.getItem('ugcQuestUserId') || '';
  } catch (e) {
    return '';
  }
};

const initAdminTrackerCard = () => {
  const { card } = getEls();
  if (!card) return;
  if (window.location.protocol === 'file:') return;

  const token = getSessionToken();
  if (!token) return;

  card.style.display = 'block';

  const cached = readUsersCache();
  if (cached) {
    setBtnEnabled(true);
    setSummaryMessage(getCountFromPayload(cached));
  } else {
    setBtnEnabled(false);
    setMsg('Carregando painel do time...');
  }

  if (trackerLoaded || trackerRequest) return;

  trackerRequest = fetch('api/admin_users.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  })
    .then((res) =>
      res
        .json()
        .catch(() => null)
        .then((data) => ({ res, data }))
    )
    .then(({ res, data }) => {
      if (!res.ok || !data || data.ok !== true) {
        if (res.status === 403) {
          trackerLoaded = true;
          card.style.display = 'none';
          return;
        }

        const msg = data?.error ? String(data.error) : 'Não consegui carregar o tracker agora.';
        if (!cached) setMsg(msg);
        setBtnEnabled(true);
        return;
      }

      trackerLoaded = true;
      writeUsersCache(data);
      setBtnEnabled(true);
      setSummaryMessage(getCountFromPayload(data));
    })
    .catch(() => {
      if (!cached) {
        setMsg('Não consegui carregar o tracker agora. Se der, tenta de novo mais tarde.');
      }
      setBtnEnabled(true);
    })
    .finally(() => {
      trackerRequest = null;
    });
};

export { initAdminTrackerCard };
