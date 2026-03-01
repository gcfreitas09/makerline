import { state, saveState } from '../../core/state.js';
import { showToast } from '../../core/ui.js?v=20260301g';
import { renderAll } from '../../core/renderers.js';

const syncWeeklySetting = async (enabled) => {
  const token = (() => {
    try {
      return sessionStorage.getItem('ugcQuestToken') || '';
    } catch (e) {
      return '';
    }
  })();

  if (!token) {
    showToast('Sua sessão expirou. Faça login novamente.');
    state.settings.weekly = !enabled;
    saveState();
    renderAll();
    return;
  }

  try {
    const res = await fetch('api/settings.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, weekly: enabled })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao salvar');
    }
    showToast(enabled ? 'Resumo semanal ativado.' : 'Resumo semanal desativado.');
  } catch (error) {
    showToast('Falha ao salvar resumo semanal.');
    state.settings.weekly = !enabled;
    saveState();
    renderAll();
  }
};

export { syncWeeklySetting };
