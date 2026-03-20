import { state, saveState, STORAGE_KEY, PREFS_KEY } from '../../core/state.js';
import { renderAll } from '../../core/renderers.js?v=20260318e';

const getSessionToken = () => {
  try {
    return sessionStorage.getItem('ugcQuestToken') || '';
  } catch (error) {
    return '';
  }
};

const clearAccountSession = () => {
  const userId = (() => {
    try {
      return sessionStorage.getItem('ugcQuestUserId') || '';
    } catch (error) {
      return '';
    }
  })();

  const scopedStateKey = userId ? `ugcQuestState:${userId}` : STORAGE_KEY;
  const scopedPrefsKey = userId ? `ugcQuestPrefs:${userId}` : PREFS_KEY;

  try {
    localStorage.removeItem(scopedStateKey);
    localStorage.removeItem(scopedPrefsKey);
    localStorage.removeItem('ugcQuestLastEmail');
  } catch (error) {}

  try {
    sessionStorage.removeItem('ugcQuestToken');
    sessionStorage.removeItem('ugcQuestLoggedIn');
    sessionStorage.removeItem('ugcQuestUserId');
    sessionStorage.removeItem('ugcQuestUserEmail');
    sessionStorage.removeItem('ugcQuestUserName');
  } catch (error) {}
};

const initAccountForm = () => {
  const accountForm = document.getElementById('account-form');
  if (!accountForm) return;
  if (accountForm.dataset.bound === '1') return;
  accountForm.dataset.bound = '1';

  const msg = document.getElementById('account-msg');
  const deleteBtn = document.getElementById('account-delete-btn');

  accountForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!msg) return;

    (async () => {
      const formData = new FormData(accountForm);
      const payload = {
        token: getSessionToken(),
        newEmail: String(formData.get('newEmail') || '').trim(),
        newPassword: String(formData.get('newPassword') || '')
      };

      if (!payload.token) {
        msg.textContent = 'Sua sessão caiu. Faz login de novo.';
        return;
      }

      if (!payload.newEmail && !payload.newPassword) {
        msg.textContent = 'Nada pra salvar: preenche um novo email ou uma nova senha.';
        return;
      }

      msg.textContent = 'Salvando...';

      try {
        const res = await fetch('api/account.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) {
          msg.textContent = data.error || 'Erro ao salvar.';
          return;
        }

        msg.textContent = 'Conta atualizada com sucesso.';

        if (data.token) {
          try {
            sessionStorage.setItem('ugcQuestToken', data.token);
          } catch (error) {}
        }

        if (data.user?.email) {
          state.profile.email = data.user.email;
          try {
            sessionStorage.setItem('ugcQuestUserEmail', data.user.email);
            localStorage.setItem('ugcQuestLastEmail', data.user.email);
          } catch (error) {}
        }

        if (data.user?.name) {
          state.profile.name = data.user.name;
          try {
            sessionStorage.setItem('ugcQuestUserName', data.user.name);
          } catch (error) {}
        }

        accountForm.reset();
        saveState();
        renderAll();
      } catch (error) {
        msg.textContent = 'Erro ao salvar.';
      }
    })();
  });

  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      if (!msg) return;

      const confirmed = window.confirm('Tem certeza que você quer excluir sua conta? Essa ação não pode ser desfeita.');
      if (!confirmed) return;

      const token = getSessionToken();
      if (!token) {
        msg.textContent = 'Sua sessão caiu. Faz login de novo.';
        return;
      }

      deleteBtn.disabled = true;
      msg.textContent = 'Excluindo conta...';

      try {
        const res = await fetch('api/delete_account.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        const data = await res.json().catch(() => null);

        if (!res.ok || !data || data.ok !== true) {
          msg.textContent = data?.error || 'Não consegui excluir sua conta agora.';
          deleteBtn.disabled = false;
          return;
        }

        clearAccountSession();
        window.location.replace('index.html');
      } catch (error) {
        msg.textContent = 'Não consegui excluir sua conta agora.';
        deleteBtn.disabled = false;
      }
    });
  }
};

export { initAccountForm };
