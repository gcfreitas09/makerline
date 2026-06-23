import { state, formatCurrency } from '../../core/state.js';
import { showToast } from '../../core/ui.js';

const buildSnapshot = () => {
  const totalCampaigns = state.campaigns.length;
  const totalReceived = state.campaigns
    .filter((c) => c.status === 'concluida')
    .reduce((sum, c) => sum + (Number(c.value) || 0), 0);
  const pending = state.campaigns.filter((c) => c.status === 'prospeccao').length;
  const negotiating = state.campaigns.filter((c) => c.status === 'prospeccao' && c.stage === 'negociacao').length;
  const done = state.campaigns.filter((c) => c.status === 'concluida').length;

  return {
    totalCampaigns,
    pending,
    negotiating,
    done,
    totalReceived,
    scripts: state.scripts.length,
    streak: state.profile.streak,
    level: state.profile.level,
    xp: state.profile.xp,
    focus: {
      label: state.focus.label,
      current: state.focus.current,
      target: state.focus.target
    }
  };
};

const sendWeeklySummaryNow = async () => {
  const msgEl = document.getElementById('weekly-summary-msg');
  const previewEl = document.getElementById('weekly-summary-preview');
  const actionsEl = document.getElementById('weekly-summary-actions');
  const token = (() => {
    try {
      return sessionStorage.getItem('ugcQuestToken') || '';
    } catch (e) {
      return '';
    }
  })();

  if (previewEl) previewEl.style.display = 'none';
  if (actionsEl) actionsEl.style.display = 'none';

  if (!token) {
    if (msgEl) msgEl.textContent = 'Sua sessão expirou. Faça login novamente.';
    showToast('Sessão expirada.');
    return;
  }

  if (!state.settings.weekly) {
    if (msgEl) msgEl.textContent = 'Ative o resumo semanal acima para poder enviar.';
    showToast('Ative o resumo semanal primeiro.');
    return;
  }

  if (msgEl) msgEl.textContent = 'Enviando...';

  try {
    const res = await fetch('api/weekly_summary.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, snapshot: buildSnapshot() })
    });
    const data = await res.json();
    if (!res.ok) {
      if (msgEl) msgEl.textContent = data.error || 'Não deu pra enviar agora.';
      showToast('Falha ao enviar.');
      return;
    }

    const sent = Number(data.sent) || 0;
    const failed = Number(data.failed) || 0;
    const preview = typeof data.preview === 'string' ? data.preview : '';

    if (sent > 0) {
      const money = formatCurrency(data.snapshot?.totalReceived ?? buildSnapshot().totalReceived);
      if (msgEl) msgEl.textContent = `Resumo enviado. Total recebido: ${money}.`;
      showToast('Resumo enviado!');
      return;
    }

    if (preview) {
      const mailer = data.mailer || {};
      const errorHint =
        mailer && typeof mailer.error === 'string' && mailer.error.trim()
          ? ` (erro: ${mailer.error})`
          : '';

      const smtpHint =
        mailer && mailer.smtpConfigured === false
          ? 'Dica: configura o SMTP no arquivo storage/smtp.json (tem um exemplo ali do lado).'
          : `Se quiser, abre o log ali do lado${errorHint}.`;

      if (msgEl) {
        msgEl.textContent = `Não consegui mandar o email agora, mas o resumo tá aqui embaixo pra você copiar. ${smtpHint}`;
      }
      if (previewEl) {
        previewEl.textContent = preview;
        previewEl.style.display = 'block';
      }
      if (actionsEl) actionsEl.style.display = 'flex';
      showToast('Resumo pronto (sem email).');
      return;
    }

    if (failed > 0) {
      if (msgEl) msgEl.textContent = 'Não deu pra mandar o email agora. Confere o SMTP e abre o log ali do lado.';
      showToast('Email não enviado.');
      return;
    }

    if (msgEl) msgEl.textContent = 'Sem destinatários pra enviar.';
    showToast('Sem destinatários.');
  } catch (error) {
    if (msgEl) msgEl.textContent = 'Erro ao enviar. Confere o servidor local.';
    showToast('Erro ao enviar.');
  }
};

export { sendWeeklySummaryNow };
