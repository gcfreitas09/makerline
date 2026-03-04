import { state, todayKey } from '../../core/state.js';
import { showToast } from '../../core/ui.js?v=20260302f';

const ALERTS_KEY = (() => {
  try {
    const userId = sessionStorage.getItem('ugcQuestUserId') || '';
    return userId ? `ugcQuestAlertsLastShown:${userId}` : 'ugcQuestAlertsLastShown';
  } catch (e) {
    return 'ugcQuestAlertsLastShown';
  }
})();

const plural = (value, singular, pluralWord = null) => {
  const safe = Number(value) || 0;
  if (safe === 1) return `1 ${singular}`;
  return `${safe} ${pluralWord || `${singular}s`}`;
};

const buildAlertsMessage = () => {
  const pendentes = state.campaigns.filter((c) => c.status === 'prospeccao' && c.stage === 'abordagem').length;
  const negociando = state.campaigns.filter((c) => c.status === 'prospeccao' && c.stage === 'negociacao').length;
  const realizadosSemValor = state.campaigns.filter(
    (c) => c.status === 'concluida' && c.stage === 'pago' && (!c.value || Number(c.value) <= 0) && !c.barter
  ).length;
  const marcasSemResposta = state.brands.filter((b) => b.status === 'lead').length;

  const parts = [];
  if (pendentes) parts.push(plural(pendentes, 'pendente'));
  if (negociando) parts.push(plural(negociando, 'negociação', 'negociações'));
  if (marcasSemResposta) parts.push(plural(marcasSemResposta, 'marca sem resposta', 'marcas sem resposta'));
  if (realizadosSemValor) parts.push(plural(realizadosSemValor, 'realizado sem valor', 'realizados sem valor'));

  if (!parts.length) return '';

  const head = parts.slice(0, 2).join(' · ');
  const tail = parts.length > 2 ? ` +${parts.length - 2}` : '';
  return `Alertas: ${head}${tail}. Bora dar um passo nisso?`;
};

const runCampaignAlerts = ({ force = false } = {}) => {
  if (!state.settings.alerts) return;

  const key = todayKey();
  const last = localStorage.getItem(ALERTS_KEY) || '';
  if (!force && last === key) return;

  const message = buildAlertsMessage();
  if (message) {
    showToast(message);
  } else if (force) {
    showToast('Sem alertas por enquanto. Tudo certo.');
  }

  try {
    localStorage.setItem(ALERTS_KEY, key);
  } catch (error) {}
};

const clearCampaignAlertsCache = () => {
  try {
    localStorage.removeItem(ALERTS_KEY);
  } catch (error) {}
};

export { runCampaignAlerts, clearCampaignAlertsCache };
