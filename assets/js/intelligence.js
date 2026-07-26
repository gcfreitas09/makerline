import {
  buildChartsData,
  buildDashboardStats,
  filterUsers,
  normalizeUser,
  sortUsers,
} from './intelligence-utils.js?v=20260721b';
import {
  CriticalUsersSection,
  DashboardCharts,
  DashboardHeader,
  EmptyState,
  LoadingSkeleton,
  MetricsGrid,
  UserDetailsPanel,
  UserFilters,
  UsersTable,
} from './intelligence-components.js?v=20260721b';

const getFromStorage = (key) => {
  try {
    return sessionStorage.getItem(key) || '';
  } catch (error) {
    return '';
  }
};

const getFromLocal = (key) => {
  try {
    return localStorage.getItem(key) || '';
  } catch (error) {
    return '';
  }
};

const setLocal = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (error) {}
};

const readPrivateTrackerAuth = () => {
  try {
    const raw = sessionStorage.getItem('makerlineLandingInsightsAuth');
    const parsed = raw ? JSON.parse(raw) : null;
    const expiresAt = parsed?.expiresAt ? new Date(parsed.expiresAt).getTime() : 0;
    if (!parsed?.token || !parsed?.email || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
    return parsed;
  } catch (error) {
    return null;
  }
};

const privateTrackerAuth = readPrivateTrackerAuth();
const isEmbeddedTracker = new URLSearchParams(window.location.search).get('embed') === '1';
const appSessionToken = getFromStorage('ugcQuestToken') || getFromLocal('ugcQuestSessionToken');
const sessionToken = (isEmbeddedTracker ? privateTrackerAuth?.token : '') || appSessionToken || privateTrackerAuth?.token || '';
const sessionUserId = getFromStorage('ugcQuestUserId') || getFromLocal('ugcQuestSessionUserId');
const sessionEmail = (
  (isEmbeddedTracker ? privateTrackerAuth?.email : '') ||
  getFromStorage('ugcQuestUserEmail') ||
  getFromLocal('ugcQuestUserEmail') ||
  privateTrackerAuth?.email ||
  ''
).trim().toLowerCase();
const hasSession =
  (getFromStorage('ugcQuestLoggedIn') === '1' && Boolean(appSessionToken) && Boolean(sessionUserId)) ||
  (getFromLocal('ugcQuestSessionLoggedIn') === '1' && Boolean(appSessionToken) && Boolean(sessionUserId)) ||
  Boolean(privateTrackerAuth?.token);
const TRACKER_ALLOWED_EMAILS = new Set(['fgui3662@gmail.com', 'lorenzo.ritter27@gmail.com']);

const isTopLevelWindow = window.top === window.self;

const goToLoginIfTopLevel = () => {
  if (isTopLevelWindow) {
    window.location.replace('index.html');
  }
};

if (!hasSession && isTopLevelWindow) {
  window.location.replace('tracker?view=landing');
}

if ((!sessionEmail || !TRACKER_ALLOWED_EMAILS.has(sessionEmail)) && isTopLevelWindow) {
  window.location.replace('tracker?view=landing');
}

const CONTACTS_KEY = 'makerlineIntelligenceContacts';
const state = {
  loading: true,
  error: '',
  users: [],
  selectedUserId: null,
  deleteUserId: null,
  resetPasswordUserId: null,
  lockedScrollY: 0,
  filters: {
    query: '',
    onboarding: 'all',
    sort: 'last_activity',
  },
};

let migrationAttempted = false;
let statesMigrationAttempted = false;

const getEls = () => ({
  app: document.getElementById('intelligence-app'),
  message: document.getElementById('intelligence-message'),
  deleteModal: document.getElementById('intelligence-delete-modal'),
  deleteTitle: document.getElementById('intelligence-delete-title'),
  deleteText: document.getElementById('intelligence-delete-text'),
  deleteMessage: document.getElementById('intelligence-delete-message'),
  resetPasswordModal: document.getElementById('intelligence-reset-password-modal'),
  resetPasswordTitle: document.getElementById('intelligence-reset-password-title'),
  resetPasswordText: document.getElementById('intelligence-reset-password-text'),
  resetPasswordInput: document.getElementById('intelligence-reset-password-input'),
  resetPasswordMessage: document.getElementById('intelligence-reset-password-message'),
  resetPasswordForm: document.getElementById('intelligence-reset-password-form'),
  sidePanel: document.getElementById('intelligence-side-panel'),
  sidePanelBody: document.getElementById('intelligence-side-panel-body'),
});

const showMessage = (text, kind = '') => {
  const { message } = getEls();
  if (!message) return;
  message.textContent = text || '';
  message.className = `ml-inline-message${kind ? ` ${kind}` : ''}`;
};

const readMarkedContacts = () => {
  try {
    const raw = localStorage.getItem(CONTACTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map((item) => String(item)) : []);
  } catch (error) {
    return new Set();
  }
};

const writeMarkedContacts = (set) => {
  setLocal(CONTACTS_KEY, JSON.stringify(Array.from(set)));
};

const decorateUsers = (users) => {
  const marked = readMarkedContacts();
  return users.map((user) => normalizeUser({
    ...user,
    markedForContact: marked.has(String(user.id)),
  }));
};

const getSelectedUser = () => state.users.find((user) => String(user.id) === String(state.selectedUserId)) || null;

const getVisibleUsers = () => sortUsers(filterUsers(state.users, state.filters), state.filters.sort);

const buildMetricSections = () => {
  const visibleUsers = getVisibleUsers();
  const stats = buildDashboardStats(state.users);
  const charts = buildChartsData(state.users);
  return { visibleUsers, stats, charts };
};

const renderDeleteModal = () => {
  const { deleteModal, deleteTitle, deleteText, deleteMessage } = getEls();
  if (!deleteModal) return;

  const user = state.users.find((item) => String(item.id) === String(state.deleteUserId));
  if (!user) {
    deleteModal.classList.remove('open');
    deleteModal.setAttribute('aria-hidden', 'true');
    if (deleteMessage) deleteMessage.textContent = '';
    return;
  }

  if (deleteTitle) deleteTitle.textContent = `Excluir ${user.name || user.email}`;
  if (deleteText) deleteText.textContent = `Isso apaga a conta e o progresso de ${user.email}.`;
  if (deleteMessage) deleteMessage.textContent = '';

  deleteModal.classList.add('open');
  deleteModal.setAttribute('aria-hidden', 'false');
};

const closeDeleteModal = () => {
  const { deleteModal, deleteMessage } = getEls();
  state.deleteUserId = null;
  if (deleteMessage) deleteMessage.textContent = '';
  if (!deleteModal) return;
  deleteModal.classList.remove('open');
  deleteModal.setAttribute('aria-hidden', 'true');
};

const renderResetPasswordModal = () => {
  const { resetPasswordModal, resetPasswordTitle, resetPasswordText, resetPasswordInput, resetPasswordMessage } = getEls();
  if (!resetPasswordModal) return;

  const user = state.users.find((item) => String(item.id) === String(state.resetPasswordUserId));
  if (!user) {
    resetPasswordModal.classList.remove('open');
    resetPasswordModal.setAttribute('aria-hidden', 'true');
    if (resetPasswordMessage) resetPasswordMessage.textContent = '';
    if (resetPasswordInput) resetPasswordInput.value = '';
    return;
  }

  if (resetPasswordTitle) resetPasswordTitle.textContent = `Redefinir senha de ${user.name || user.email}`;
  if (resetPasswordText) resetPasswordText.textContent = `Defina uma senha temporaria para ${user.email}. A senha antiga nunca e exibida.`;
  if (resetPasswordMessage) resetPasswordMessage.textContent = '';
  if (resetPasswordInput) {
    resetPasswordInput.value = '';
    requestAnimationFrame(() => resetPasswordInput.focus());
  }

  resetPasswordModal.classList.add('open');
  resetPasswordModal.setAttribute('aria-hidden', 'false');
};

const closeResetPasswordModal = () => {
  const { resetPasswordModal, resetPasswordInput, resetPasswordMessage } = getEls();
  state.resetPasswordUserId = null;
  if (resetPasswordInput) resetPasswordInput.value = '';
  if (resetPasswordMessage) resetPasswordMessage.textContent = '';
  if (!resetPasswordModal) return;
  resetPasswordModal.classList.remove('open');
  resetPasswordModal.setAttribute('aria-hidden', 'true');
};

const lockBodyScroll = () => {
  const body = document.body;
  const html = document.documentElement;
  if (!body || !html || body.classList.contains('ml-panel-open')) return;

  state.lockedScrollY = window.scrollY || window.pageYOffset || 0;
  html.classList.add('ml-scroll-lock');
  body.classList.add('ml-panel-open');
};

const unlockBodyScroll = () => {
  const body = document.body;
  const html = document.documentElement;
  if (!body || !html || !body.classList.contains('ml-panel-open')) return;

  html.classList.remove('ml-scroll-lock');
  body.classList.remove('ml-panel-open');
};

const openSidePanel = (userId) => {
  state.selectedUserId = userId;
  const { sidePanel } = getEls();
  renderSidePanel();
  if (sidePanel) {
    sidePanel.classList.add('open');
    sidePanel.setAttribute('aria-hidden', 'false');
    const panelContent = sidePanel.querySelector('.ml-side-panel__content');
    if (panelContent) panelContent.scrollTop = 0;
  }
  lockBodyScroll();
};

const closeSidePanel = () => {
  const { sidePanel } = getEls();
  if (sidePanel) {
    sidePanel.classList.remove('open');
    sidePanel.setAttribute('aria-hidden', 'true');
  }
  unlockBodyScroll();
};

const renderSidePanel = () => {
  const { sidePanelBody } = getEls();
  if (!sidePanelBody) return;
  sidePanelBody.innerHTML = UserDetailsPanel(getSelectedUser());
};

const stripTableRowActions = () => {
  const { app } = getEls();
  if (!app) return;

  app.querySelectorAll('.ml-table-desktop .ml-row-actions [data-action="open-user"], .ml-table-desktop .ml-row-actions [data-action="copy-email"], .ml-table-desktop .ml-row-actions [data-action="mark-contact"]').forEach((button) => {
    button.remove();
  });

  if (isEmbeddedTracker) {
    app.querySelectorAll('[data-action="back"], [data-action="logout"]').forEach((button) => button.remove());
  }

  if (privateTrackerAuth) {
    app.querySelectorAll('[data-action="migrate-users"], [data-action="migrate-states"], [data-action="reset-password"]').forEach((button) => button.remove());
  }
};

const render = () => {
  const { app } = getEls();
  if (!app) return;

  if (state.loading) {
    app.innerHTML = `${DashboardHeader()}${LoadingSkeleton()}`;
    renderSidePanel();
    return;
  }

  if (state.error) {
    app.innerHTML = `
      ${DashboardHeader()}
      ${EmptyState({
        icon: 'alert',
        title: 'Não foi possível carregar o Intelligence',
        text: state.error,
        actionLabel: 'Tentar novamente',
        action: 'reload',
      })}
    `;
    renderSidePanel();
    return;
  }

  const { visibleUsers, stats, charts } = buildMetricSections();

  app.innerHTML = `
    ${DashboardHeader()}
    ${MetricsGrid(stats)}
    ${CriticalUsersSection(stats.criticalUsers)}
    ${DashboardCharts(charts)}
    <section class="ml-data-section">
      <div class="ml-section-head">
        <div>
          <p class="ml-kicker">Base operacional</p>
          <h2>Tabela premium de usuários</h2>
        </div>
      </div>
      ${UserFilters(state.filters)}
      ${UsersTable(visibleUsers)}
    </section>
  `;

  stripTableRowActions();
  renderSidePanel();
};

const exportVisibleUsers = () => {
  const users = getVisibleUsers();
  if (!users.length) {
    showMessage('Não há dados filtrados para exportar.', 'is-warning');
    return;
  }

  const headers = [
    'name',
    'email',
    'created_at',
    'last_login_at',
    'last_seen_at',
    'access_count',
    'accesses_7d',
    'accesses_30d',
    'time_spent_seconds',
    'campaign_count',
    'active_campaign_count',
    'onboarding_percentage',
  ];

  const rows = users.map((user) => [
    user.name || '',
    user.email || '',
    user.createdAt || '',
    user.lastLoginAt || '',
    user.lastSeenAt || '',
    user.accessCount,
    user.accesses7d,
    user.accesses30d,
    user.timeSpentSeconds,
    user.campaignCount,
    user.activeCampaignCount,
    user.onboardingProgress.percentage,
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `makerline-intelligence-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showMessage('Exportação gerada com sucesso.', 'is-success');
};

const logout = () => {
  try {
    ['ugcQuestLoggedIn', 'ugcQuestToken', 'ugcQuestUserId', 'ugcQuestUserEmail', 'ugcQuestUserName'].forEach((key) => sessionStorage.removeItem(key));
  } catch (error) {}
  try {
    ['ugcQuestSessionLoggedIn', 'ugcQuestSessionToken', 'ugcQuestSessionUserId', 'ugcQuestSessionUserEmail', 'ugcQuestSessionUserName'].forEach((key) => localStorage.removeItem(key));
  } catch (error) {}
  window.location.replace('index.html');
};

const migrateUsersIfNeeded = async (force = false) => {
  if (privateTrackerAuth || window.location.protocol === 'file:' || !sessionToken || (migrationAttempted && !force)) return null;
  migrationAttempted = true;
  const res = await fetch('api/admin_migrate_users.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: sessionToken }),
  });
  const data = await res.json().catch(() => null);
  if (res.status === 401) {
    goToLoginIfTopLevel();
    return null;
  }
  return res.ok && data?.ok ? data : null;
};

const migrateStatesIfNeeded = async (force = false) => {
  if (privateTrackerAuth || window.location.protocol === 'file:' || !sessionToken || (statesMigrationAttempted && !force)) return null;
  statesMigrationAttempted = true;
  const res = await fetch('api/admin_migrate_states.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: sessionToken }),
  });
  const data = await res.json().catch(() => null);
  if (res.status === 401) {
    goToLoginIfTopLevel();
    return null;
  }
  return res.ok && data?.ok ? data : null;
};

const loadUsers = async ({ skipMigration = false, progressImport = false } = {}) => {
  if (window.location.protocol === 'file:') {
    state.loading = false;
    state.error = 'Esse painel precisa rodar no servidor (Apache/XAMPP).';
    render();
    return;
  }

  state.loading = true;
  state.error = '';
  render();
  showMessage('Carregando dados do Intelligence...');

  try {
    if (!skipMigration) {
      await migrateUsersIfNeeded(false).catch(() => null);
      if (progressImport) {
        await migrateStatesIfNeeded(true).catch(() => null);
      }
    }

    const res = await fetch('api/admin_intelligence.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: sessionToken }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      if (res.status === 401) {
        goToLoginIfTopLevel();
        return;
      }
      throw new Error(data?.error || 'Não consegui carregar o Intelligence agora.');
    }

    state.users = decorateUsers(Array.isArray(data.users) ? data.users : []);
    state.loading = false;
    state.error = '';
    render();
    showMessage('');
  } catch (error) {
    state.loading = false;
    state.error = error.message || 'Falha ao carregar dados.';
    render();
    showMessage(state.error, 'is-danger');
  }
};

const copyEmail = async (userId) => {
  const user = state.users.find((item) => String(item.id) === String(userId));
  if (!user?.email) return;
  try {
    await navigator.clipboard.writeText(user.email);
    showMessage(`E-mail copiado: ${user.email}`, 'is-success');
  } catch (error) {
    showMessage('Não consegui copiar o e-mail agora.', 'is-warning');
  }
};

const toggleMarkedContact = (userId) => {
  const marked = readMarkedContacts();
  const key = String(userId);
  if (marked.has(key)) {
    marked.delete(key);
  } else {
    marked.add(key);
  }
  writeMarkedContacts(marked);
  state.users = decorateUsers(state.users);
  render();
  const user = state.users.find((item) => String(item.id) === key);
  showMessage(user?.markedForContact ? 'Usuário marcado para contato.' : 'Marcação removida.', 'is-success');
};

const openDeleteModal = (userId) => {
  if (String(userId) === String(sessionUserId)) {
    showMessage('Essa é sua conta. Não exclua por aqui.', 'is-warning');
    return;
  }
  state.deleteUserId = userId;
  renderDeleteModal();
};

const openResetPasswordModal = (userId) => {
  if (!String(userId || '').trim()) return;
  state.resetPasswordUserId = userId;
  renderResetPasswordModal();
};

const confirmResetPassword = async () => {
  const { resetPasswordInput, resetPasswordMessage } = getEls();
  const userId = String(state.resetPasswordUserId || '');
  const newPassword = String(resetPasswordInput?.value || '').trim();

  if (!userId || !sessionToken) return;
  if (newPassword.length < 6) {
    if (resetPasswordMessage) resetPasswordMessage.textContent = 'A nova senha precisa ter pelo menos 6 caracteres.';
    return;
  }

  if (resetPasswordMessage) resetPasswordMessage.textContent = 'Salvando nova senha...';

  try {
    const res = await fetch('api/admin_reset_password.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: sessionToken, userId, newPassword }),
    });
    const data = await res.json().catch(() => null);
    if (res.status === 401) {
      goToLoginIfTopLevel();
      return;
    }
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || 'Nao consegui redefinir a senha agora.');
    }

    closeResetPasswordModal();
    showMessage('Senha redefinida com sucesso.', 'is-success');
  } catch (error) {
    if (resetPasswordMessage) resetPasswordMessage.textContent = error.message || 'Falha ao redefinir senha.';
    showMessage(error.message || 'Falha ao redefinir senha.', 'is-danger');
  }
};

const confirmDeleteUser = async () => {
  const { deleteMessage } = getEls();
  if (!state.deleteUserId || !sessionToken) return;
  if (deleteMessage) deleteMessage.textContent = 'Excluindo...';

  try {
    const res = await fetch('api/admin_delete_user.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: sessionToken, userId: String(state.deleteUserId) }),
    });
    const data = await res.json().catch(() => null);
    if (res.status === 401) {
      goToLoginIfTopLevel();
      return;
    }
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || 'Não consegui excluir agora.');
    }
    state.users = state.users.filter((user) => String(user.id) !== String(state.deleteUserId));
    if (String(state.selectedUserId) === String(state.deleteUserId)) {
      state.selectedUserId = null;
      closeSidePanel();
    }
    closeDeleteModal();
    render();
    showMessage('Usuário excluído com sucesso.', 'is-success');
  } catch (error) {
    if (deleteMessage) deleteMessage.textContent = error.message || 'Falha ao excluir.';
    showMessage(error.message || 'Falha ao excluir.', 'is-danger');
  }
};

const restoreAppSessionAndBack = () => {
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
  } catch (error) {}
  window.location.href = 'app.html';
};

const handleFilterChange = (target) => {
  const filter = target.dataset.filter;
  if (!filter) return;
  const key = filter === 'sort' ? 'sort' : filter;
  state.filters[key] = target.value;
  const shouldRestoreFocus = filter === 'query';
  render();
  if (shouldRestoreFocus) {
    requestAnimationFrame(() => {
      const input = document.querySelector('[data-filter="query"]');
      if (!input) return;
      input.focus();
      const length = String(state.filters.query || '').length;
      if (typeof input.setSelectionRange === 'function') {
        input.setSelectionRange(length, length);
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  render();
  loadUsers();

  document.body.addEventListener('input', (event) => {
    const target = event.target.closest('[data-filter]');
    if (!target) return;
    handleFilterChange(target);
  });

  document.body.addEventListener('change', (event) => {
    const target = event.target.closest('[data-filter]');
    if (!target) return;
    handleFilterChange(target);
  });

  document.body.addEventListener('click', async (event) => {
    const trigger = event.target.closest('[data-action]');
    if (!trigger) return;
    const action = trigger.dataset.action;
    const userId = trigger.dataset.userId || '';

    if (action === 'logout') logout();
    if (action === 'back') restoreAppSessionAndBack();
    if (action === 'migrate-users') {
      showMessage('Importando usuários...');
      await migrateUsersIfNeeded(true).catch(() => null);
      await loadUsers({ skipMigration: true });
    }
    if (action === 'migrate-states') {
      showMessage('Importando progressos...');
      await migrateStatesIfNeeded(true).catch(() => null);
      await loadUsers({ skipMigration: true });
    }
    if (action === 'export') exportVisibleUsers();
    if (action === 'reload') loadUsers({ skipMigration: true });
    if (action === 'reset-filters') {
      state.filters = { query: '', onboarding: 'all', sort: 'last_activity' };
      render();
    }
    if (action === 'open-user') openSidePanel(userId);
    if (action === 'close-panel') closeSidePanel();
    if (action === 'copy-email') copyEmail(userId);
    if (action === 'mark-contact') toggleMarkedContact(userId);
    if (action === 'reset-password') openResetPasswordModal(userId);
    if (action === 'delete-user') openDeleteModal(userId);
    if (action === 'close-delete') closeDeleteModal();
    if (action === 'close-reset-password') closeResetPasswordModal();
    if (action === 'confirm-delete') confirmDeleteUser();
  });

  const { resetPasswordForm } = getEls();
  if (resetPasswordForm) {
    resetPasswordForm.addEventListener('submit', (event) => {
      event.preventDefault();
      confirmResetPassword();
    });
  }
});

window.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  closeDeleteModal();
  closeResetPasswordModal();
  closeSidePanel();
});
