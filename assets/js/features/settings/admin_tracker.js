const getEls = () => ({
  card: document.getElementById('admin-tracker-card'),
  msg: document.getElementById('admin-tracker-msg')
});
const TRACKER_ALLOWED_EMAILS = new Set(['fgui3662@gmail.com', 'lorenzo.ritter27@gmail.com']);
<<<<<<< HEAD
const INTELLIGENCE_ROUTE = 'intelligence.html';
=======
>>>>>>> 902074b4211073f9129513d97dbf8b86232764f7

const getSessionEmail = () => {
  try {
    return (sessionStorage.getItem('ugcQuestUserEmail') || '').trim().toLowerCase();
  } catch (e) {
    return '';
  }
};

const setMsg = (text) => {
  const { msg } = getEls();
  if (!msg) return;
  msg.textContent = text || '';
};

const setBtnEnabled = (enabled) => {
  const { card } = getEls();
  if (!card) return;
<<<<<<< HEAD
  const btn = card.querySelector(`a[href="${INTELLIGENCE_ROUTE}"]`);
=======
  const btn = card.querySelector('a[href="admin.html"]');
>>>>>>> 902074b4211073f9129513d97dbf8b86232764f7
  if (!btn) return;
  btn.classList.toggle('is-disabled', !enabled);
  btn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
  if (!enabled) btn.setAttribute('tabindex', '-1');
  else btn.removeAttribute('tabindex');
};

const initAdminTrackerCard = () => {
  const { card } = getEls();
  if (!card) return;
  if (card.dataset.bound === '1') return;
  card.dataset.bound = '1';
  const email = getSessionEmail();
  if (!email || !TRACKER_ALLOWED_EMAILS.has(email)) {
    card.style.display = 'none';
    return;
  }

  if (window.location.protocol === 'file:') return;

  let token = '';
  try {
    token = sessionStorage.getItem('ugcQuestToken') || '';
  } catch (e) {
    token = '';
  }
  if (!token) return;

  card.style.display = 'block';
  setBtnEnabled(false);
<<<<<<< HEAD
  setMsg('Carregando Makerline Intelligence...');
=======
  setMsg('Carregando painel do time...');
>>>>>>> 902074b4211073f9129513d97dbf8b86232764f7

  fetch('api/admin_users.php', {
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
          card.style.display = 'none';
          return;
        }

<<<<<<< HEAD
        const msg = data?.error ? String(data.error) : 'Não consegui carregar o Makerline Intelligence agora.';
=======
        const msg = data?.error ? String(data.error) : 'Não consegui carregar o tracker agora.';
>>>>>>> 902074b4211073f9129513d97dbf8b86232764f7
        setMsg(msg);
        setBtnEnabled(true);
        return;
      }

      setBtnEnabled(true);
      const count = Number.isFinite(data.count) ? data.count : Array.isArray(data.users) ? data.users.length : 0;
<<<<<<< HEAD
      setMsg(count ? `${count} usuário${count === 1 ? '' : 's'} monitorado${count === 1 ? '' : 's'} no Intelligence.` : 'Ainda não há usuários monitorados no Intelligence.');
    })
    .catch(() => {
      setMsg('Não consegui carregar o Makerline Intelligence agora. Tente de novo mais tarde.');
=======
      setMsg(count ? `Tem ${count} cadastro${count === 1 ? '' : 's'} rolando.` : 'Ainda não tem cadastros por aqui.');
    })
    .catch(() => {
      setMsg('Não consegui carregar o tracker agora. Se der, tenta de novo mais tarde.');
>>>>>>> 902074b4211073f9129513d97dbf8b86232764f7
      setBtnEnabled(true);
    });
};

export { initAdminTrackerCard };
