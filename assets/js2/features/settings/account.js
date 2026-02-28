import { state, saveState } from '../../core/state.js';
import { renderAll } from '../../core/renderers.js';

const initAccountForm = () => {
  const accountForm = document.getElementById('account-form');
  if (!accountForm) return;
  if (accountForm.dataset.bound === '1') return;
  accountForm.dataset.bound = '1';

  accountForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = document.getElementById('account-msg');
    if (!msg) return;
    
    (async () => {

    const formData = new FormData(accountForm);
    const token = (() => {
      try {
        return sessionStorage.getItem('ugcQuestToken') || '';
      } catch (e) {
        return '';
      }
    })();
    const payload = {
      token,
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

      msg.textContent = 'Atualizado!';

      if (data.token) {
        try {
          sessionStorage.setItem('ugcQuestToken', data.token);
        } catch (e) {}
      }

      if (data.user?.email) {
        state.profile.email = data.user.email;
        try {
          sessionStorage.setItem('ugcQuestUserEmail', data.user.email);
          localStorage.setItem('ugcQuestLastEmail', data.user.email);
        } catch (e) {}
      }
      if (data.user?.name) {
        state.profile.name = data.user.name;
        try {
          sessionStorage.setItem('ugcQuestUserName', data.user.name);
        } catch (e) {}
      }

      accountForm.reset();
      saveState();
      renderAll();
    } catch (error) {
      msg.textContent = 'Erro ao salvar.';
    }
    })();
  });
};

export { initAccountForm };
