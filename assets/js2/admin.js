const getFromStorage = (key) => {
  try {
    return sessionStorage.getItem(key) || '';
  } catch (e) {
    return '';
  }
};

const getFromLocal = (key) => {
  try {
    return localStorage.getItem(key) || '';
  } catch (e) {
    return '';
  }
};

const sessionToken = getFromStorage('ugcQuestToken') || getFromLocal('ugcQuestSessionToken');
const sessionUserId = getFromStorage('ugcQuestUserId') || getFromLocal('ugcQuestSessionUserId');
const hasSession =
  (getFromStorage('ugcQuestLoggedIn') === '1' && Boolean(sessionToken) && Boolean(sessionUserId)) ||
  (getFromLocal('ugcQuestSessionLoggedIn') === '1' && Boolean(sessionToken) && Boolean(sessionUserId));

if (!hasSession) {
  window.location.replace('index.html');
}

const state = {
  users: [],
  selectedUserId: null,
  deleteUserId: null
};

let migrationAttempted = false;
let statesMigrationAttempted = false;

const getEls = () => ({
  summary: document.getElementById('admin-summary'),
  count: document.getElementById('admin-count'),
  summaryTitle: document.getElementById('admin-summary-title'),
  summarySubtitle: document.getElementById('admin-summary-subtitle'),
  userDetail: document.getElementById('admin-user-detail'),
  pie: document.getElementById('admin-pie'),
  pieLegend: document.getElementById('admin-pie-legend'),
  msg: document.getElementById('admin-msg'),
  search: document.getElementById('admin-search'),
  tableBody: document.querySelector('#admin-table tbody'),
  deleteModal: document.getElementById('admin-delete-modal'),
  deleteTitle: document.getElementById('admin-delete-title'),
  deleteSubtitle: document.getElementById('admin-delete-subtitle'),
  deleteMsg: document.getElementById('admin-delete-msg')
});

const formatDateTime = (iso) => {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString();
};

const formatDuration = (seconds) => {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : parseInt(seconds, 10) || 0;
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m`;
  return `${safe}s`;
};

const renderSelectedUser = () => {
  const { summaryTitle, summarySubtitle, userDetail, pie, pieLegend } = getEls();
  if (!summaryTitle || !summarySubtitle) return;

  const selected = state.selectedUserId ? state.users.find((u) => String(u.id) === String(state.selectedUserId)) : null;

  if (!selected) {
    summaryTitle.textContent = 'Cadastros';
    summarySubtitle.textContent = 'Clique num nome pra ver o resumo do usuário.';
    if (userDetail) userDetail.style.display = 'none';
    return;
  }

  summaryTitle.textContent = selected.name || selected.email || 'Usuário';

  const accessCount = Number.isFinite(selected.accessCount) ? selected.accessCount : parseInt(selected.accessCount, 10) || 0;
  const timeSpentSeconds = Number.isFinite(selected.timeSpentSeconds)
    ? selected.timeSpentSeconds
    : parseInt(selected.timeSpentSeconds, 10) || 0;

  const avgSeconds = accessCount > 0 ? Math.round(timeSpentSeconds / accessCount) : 0;
  summarySubtitle.textContent = `Acessos: ${accessCount} • Tempo no app: ${formatDuration(timeSpentSeconds)} • Média: ${formatDuration(
    avgSeconds
  )}`;

  if (!userDetail || !pie || !pieLegend) return;
  userDetail.style.display = 'block';

  const accessUnits = Math.max(0, accessCount);
  const timeUnits = Math.max(0, timeSpentSeconds / 60);
  const total = accessUnits + timeUnits;
  const accessPct = total ? Math.max(0, Math.min(100, (accessUnits / total) * 100)) : 50;
  const timePct = Math.max(0, Math.min(100, 100 - accessPct));

  pie.style.background = `conic-gradient(var(--admin-access) 0 ${accessPct}%, var(--admin-time) ${accessPct}% 100%)`;
  pieLegend.innerHTML = `
    <div class="admin-pie-legend-item">
      <span class="admin-pie-dot" style="background: var(--admin-access)"></span>
      <div>
        <div class="admin-pie-metric">Acessos</div>
        <div class="muted">${accessCount} (${Math.round(accessPct)}%)</div>
      </div>
    </div>
    <div class="admin-pie-legend-item">
      <span class="admin-pie-dot" style="background: var(--admin-time)"></span>
      <div>
        <div class="admin-pie-metric">Tempo no app</div>
        <div class="muted">${formatDuration(timeSpentSeconds)} (${Math.round(timePct)}%)</div>
      </div>
    </div>
  `;
};

const render = () => {
  const { count, tableBody, search } = getEls();
  if (!tableBody) return;

  const query = String(search?.value || '').trim().toLowerCase();
  const users = query
    ? state.users.filter((u) => String(u.email || '').toLowerCase().includes(query) || String(u.name || '').toLowerCase().includes(query))
    : state.users;

  if (count) {
    count.textContent = `${state.users.length} usuário${state.users.length === 1 ? '' : 's'}`;
  }

	  tableBody.innerHTML = users
	    .map((user) => {
      const weekly = user.weeklySummary ? 'Ativo' : 'Off';
      const isSelf = String(user.id) === String(sessionUserId);
      const canDelete = !isSelf;
	      return `
	        <tr>
	          <td>${user.email || '-'}</td>
	          <td>
	            <button type="button" class="btn btn-ghost btn-small admin-user-btn" data-admin-user="${user.id}">
	              ${user.name || user.email || '-'}
	            </button>
	          </td>
	          <td>${formatDateTime(user.createdAt)}</td>
	          <td>${formatDateTime(user.lastLoginAt)}</td>
	          <td>${formatDateTime(user.lastSeenAt)}</td>
	          <td style="white-space: nowrap;">${weekly}</td>
            <td style="white-space: nowrap;">
              ${
                canDelete
                  ? `
                    <button
                      type="button"
                      class="btn btn-danger btn-small"
                      data-admin-action="delete-user"
                      data-user-id="${user.id}"
                      title="Excluir conta"
                    >
                      Excluir
                    </button>
                  `
                  : ''
              }
            </td>
	        </tr>
	      `;
	    })
	    .join('');

  renderSelectedUser();
};

const showMessage = (text) => {
  const { msg } = getEls();
  if (!msg) return;
  msg.textContent = text;
};

const setDeleteMessage = (text) => {
  const { deleteMsg } = getEls();
  if (!deleteMsg) return;
  deleteMsg.textContent = text || '';
};

const openDeleteModal = (userId) => {
  const { deleteModal, deleteTitle, deleteSubtitle } = getEls();
  if (!deleteModal) return;

  const target = state.users.find((u) => String(u.id) === String(userId));
  if (!target) return;

  if (String(target.id) === String(sessionUserId)) {
    showMessage('Essa e sua conta. Melhor nao apagar por aqui.');
    return;
  }

  state.deleteUserId = String(target.id);

  if (deleteTitle) {
    deleteTitle.textContent = `Excluir: ${target.name || target.email || 'usuario'}`;
  }
  if (deleteSubtitle) {
    deleteSubtitle.textContent = `Isso apaga a conta e o progresso de ${target.email || 'quem voce escolheu'}.`;
  }

  setDeleteMessage('');

  deleteModal.classList.add('open');
  deleteModal.setAttribute('aria-hidden', 'false');
};

const closeDeleteModal = () => {
  const { deleteModal } = getEls();
  if (!deleteModal) return;
  deleteModal.classList.remove('open');
  deleteModal.setAttribute('aria-hidden', 'true');
  state.deleteUserId = null;
  setDeleteMessage('');
};

const confirmDeleteUser = async () => {
  if (window.location.protocol === 'file:') return;
  if (!sessionToken) return;
  if (!state.deleteUserId) return;

  setDeleteMessage('Excluindo...');

  try {
    const res = await fetch('api/admin_delete_user.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: sessionToken, userId: state.deleteUserId })
    });

    const data = await res.json().catch(() => null);
    if (res.status === 401) {
      window.location.replace('index.html');
      return;
    }

    if (!res.ok || !data || data.ok !== true) {
      setDeleteMessage(data?.error || 'Nao consegui excluir agora.');
      return;
    }

    closeDeleteModal();
    state.selectedUserId = null;
    showMessage('Conta excluida.');
    await loadUsers({ skipMigration: true });
  } catch (e) {
    setDeleteMessage('Deu ruim ao excluir. Tenta de novo.');
  }
};

const migrateUsersIfNeeded = async (force = false) => {
  if (window.location.protocol === 'file:') return null;
  if (!sessionToken) return null;
  if (migrationAttempted && !force) return null;
  migrationAttempted = true;

  try {
    const res = await fetch('api/admin_migrate_users.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: sessionToken })
    });

    const data = await res.json().catch(() => null);
    if (res.status === 401) {
      window.location.replace('index.html');
      return null;
    }

    if (!res.ok || !data || data.ok !== true) return null;

    const imported = Number(data.imported) || 0;
    const errors = Number(data.errors) || 0;

    if (imported > 0) {
      showMessage(
        errors > 0
          ? `Importei ${imported} usuário(s) do histórico (mas ${errors} deu erro).`
          : `Importei ${imported} usuário(s) do histórico pro banco.`
      );
    }

    return data;
  } catch (e) {
    return null;
  }
};

const migrateStatesIfNeeded = async (force = false) => {
  if (window.location.protocol === 'file:') return null;
  if (!sessionToken) return null;
  if (statesMigrationAttempted && !force) return null;
  statesMigrationAttempted = true;

  try {
    const res = await fetch('api/admin_migrate_states.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: sessionToken })
    });

    const data = await res.json().catch(() => null);
    if (res.status === 401) {
      window.location.replace('index.html');
      return null;
    }

    if (!res.ok || !data || data.ok !== true) {
      const err = data?.error || 'Não consegui importar o progresso.';
      const hint = data?.hint ? ` ${data.hint}` : '';
      showMessage(`${err}${hint}`.trim());
      return null;
    }

    const imported = Number(data.imported) || 0;
    const recoveredUsers = Number(data.recoveredUsers) || 0;
    const errors = Number(data.errors) || 0;

    if (imported > 0 || recoveredUsers > 0) {
      const parts = [];
      if (imported > 0) parts.push(`Importei ${imported} progresso(s) pro Supabase.`);
      if (recoveredUsers > 0) parts.push(`Recuperei ${recoveredUsers} conta(s) a partir dos states.`);
      if (errors > 0) parts.push(`${errors} deu erro no caminho.`);
      showMessage(parts.join(' '));
    } else {
      showMessage('Não achei nenhum progresso antigo pra importar.');
    }

    return data;
  } catch (e) {
    showMessage('Deu ruim ao importar. Tenta de novo.');
    return null;
  }
};

const loadUsers = async (options = {}) => {
  if (window.location.protocol === 'file:') {
    showMessage('Esse tracker precisa rodar no servidor (Apache/XAMPP).');
    return;
  }

  showMessage('Carregando…');

  try {
    if (!options.skipMigration) {
      await migrateUsersIfNeeded(false);
    }

    const res = await fetch('api/admin_users.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: sessionToken })
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data || typeof data !== 'object' || data.ok !== true) {
      const err = data?.error || 'Não consegui carregar.';
      showMessage(err);
      if (res.status === 401) window.location.replace('index.html');
      return;
    }

    state.users = Array.isArray(data.users) ? data.users : [];
    showMessage(state.users.length ? '' : 'Ainda não tem usuários por aqui.');
    render();
  } catch (e) {
    showMessage('Não consegui carregar agora. Tenta de novo.');
  }
};

const logout = () => {
  try {
    ['ugcQuestLoggedIn', 'ugcQuestToken', 'ugcQuestUserId', 'ugcQuestUserEmail', 'ugcQuestUserName'].forEach((k) =>
      sessionStorage.removeItem(k)
    );
  } catch (e) {}
  try {
    [
      'ugcQuestSessionLoggedIn',
      'ugcQuestSessionToken',
      'ugcQuestSessionUserId',
      'ugcQuestSessionUserEmail',
      'ugcQuestSessionUserName'
    ].forEach((k) => localStorage.removeItem(k));
  } catch (e) {}
  window.location.replace('index.html');
};

document.addEventListener('DOMContentLoaded', () => {
  const { search, tableBody } = getEls();

  document.body.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-admin-action]');
    if (!btn) return;
    const action = btn.dataset.adminAction;
    if (action === 'logout') logout();
    if (action === 'back') {
      try {
        const token = getFromLocal('ugcQuestSessionToken');
        const userId = getFromLocal('ugcQuestSessionUserId');
        const email = getFromLocal('ugcQuestSessionUserEmail');
        const name = getFromLocal('ugcQuestSessionUserName');
        if (token && userId) {
          sessionStorage.setItem('ugcQuestLoggedIn', '1');
          sessionStorage.setItem('ugcQuestToken', token);
          sessionStorage.setItem('ugcQuestUserId', userId);
          sessionStorage.setItem('ugcQuestUserEmail', email);
          sessionStorage.setItem('ugcQuestUserName', name);
        }
      } catch (e) {}
      window.location.href = 'app.html';
    }
    if (action === 'migrate') {
      showMessage('Importando…');
      migrateUsersIfNeeded(true).finally(() => loadUsers({ skipMigration: true }));
    }
    if (action === 'migrate-states') {
      showMessage('Importando progressos…');
      migrateStatesIfNeeded(true).finally(() => loadUsers({ skipMigration: true }));
    }
    if (action === 'delete-user') {
      openDeleteModal(btn.dataset.userId || '');
    }
    if (action === 'close-delete') {
      closeDeleteModal();
    }
    if (action === 'confirm-delete') {
      confirmDeleteUser();
    }
  });

  if (tableBody) {
    tableBody.addEventListener('click', (event) => {
      const button = event.target.closest('[data-admin-user]');
      if (!button) return;
      state.selectedUserId = button.dataset.adminUser || null;
      renderSelectedUser();
    });
  }

  if (search) {
    search.addEventListener('input', render);
  }

  loadUsers();
});

window.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  const { deleteModal } = getEls();
  if (deleteModal && deleteModal.classList.contains('open')) {
    closeDeleteModal();
  }
});

window.addEventListener('pageshow', () => {
  const loggedIn =
    (getFromStorage('ugcQuestLoggedIn') === '1' && Boolean(sessionToken) && Boolean(sessionUserId)) ||
    (getFromLocal('ugcQuestSessionLoggedIn') === '1' && Boolean(sessionToken) && Boolean(sessionUserId));
  if (!loggedIn) {
    window.location.replace('index.html');
  }
});
