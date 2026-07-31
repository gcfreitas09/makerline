/**
 * Linha do tempo de uma campanha: quando ela entrou em cada etapa.
 *
 * As acoes por etapa precisam responder "ha quantos dias isso esta parado" e
 * "quanto tempo o ciclo inteiro levou". Para isso cada mudanca de etapa deixa um
 * carimbo em `campaign.stageLog`. Campanhas antigas, sem carimbo, caem no
 * `updatedAt`/`createdAt`, entao a conta nunca fica vazia.
 */

const LIMITE_DO_LOG = 80;

const agoraIso = () => new Date().toISOString();

/** Diferenca em dias inteiros entre uma data e agora. Negativo = no futuro. */
const diasDesde = (iso, referencia = new Date()) => {
  const data = iso ? new Date(iso) : null;
  if (!data || Number.isNaN(data.getTime())) return null;
  const inicio = Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate());
  const fim = Date.UTC(referencia.getUTCFullYear(), referencia.getUTCMonth(), referencia.getUTCDate());
  return Math.floor((fim - inicio) / 86400000);
};

const diasEntre = (isoInicio, isoFim) => {
  const fim = isoFim ? new Date(isoFim) : null;
  if (!fim || Number.isNaN(fim.getTime())) return null;
  return diasDesde(isoInicio, fim);
};

/**
 * Grava status e etapa na campanha, carimbando quando isso aconteceu.
 * Use sempre esta funcao para mudar etapa: e ela que alimenta os contadores.
 */
const registrarMudancaDeEtapa = (campaign, { status, stage, occurredAt = '' } = {}) => {
  if (!campaign || typeof campaign !== 'object') return;

  const quando = String(occurredAt || '').trim() || agoraIso();
  const statusFinal = String(status || campaign.status || '').trim();
  const stageFinal = String(stage || campaign.stage || '').trim();

  campaign.status = statusFinal;
  campaign.stage = stageFinal;
  campaign.stageEnteredAt = quando;
  campaign.updatedAt = quando;

  if (!Array.isArray(campaign.stageLog)) campaign.stageLog = [];
  campaign.stageLog.unshift({ status: statusFinal, stage: stageFinal, at: quando });
  if (campaign.stageLog.length > LIMITE_DO_LOG) campaign.stageLog.length = LIMITE_DO_LOG;
};

/** Quando a campanha entrou na etapa em que esta agora. */
const entradaNaEtapaAtual = (campaign) => {
  if (!campaign) return '';
  if (campaign.stageEnteredAt) return campaign.stageEnteredAt;
  return campaign.updatedAt || campaign.createdAt || '';
};

/** Primeira vez que a campanha passou por uma etapa. */
const primeiraEntradaEm = (campaign, stageId) => {
  const log = Array.isArray(campaign?.stageLog) ? campaign.stageLog : [];
  const registros = log.filter((item) => item && item.stage === stageId);
  if (!registros.length) return '';
  // O log e mais recente primeiro, entao a primeira vez esta no fim.
  return registros[registros.length - 1].at || '';
};

const diasNaEtapaAtual = (campaign) => {
  const dias = diasDesde(entradaNaEtapaAtual(campaign));
  return dias === null ? 0 : Math.max(0, dias);
};

/**
 * Ciclo completo: da criacao da campanha ate o pagamento confirmado. Enquanto
 * nao houver pagamento, conta ate hoje, para o numero nunca ficar parado.
 */
const duracaoDoCiclo = (campaign) => {
  const inicio = campaign?.createdAt || primeiraEntradaEm(campaign, 'contato_recebido') || '';
  const pagamentoConfirmado = campaign?.paymentReceivedAt || '';
  const fim = pagamentoConfirmado
    || (campaign?.stage === 'pago' ? (primeiraEntradaEm(campaign, 'pago') || entradaNaEtapaAtual(campaign)) : agoraIso());
  const dias = diasEntre(inicio, fim);
  return dias === null ? 0 : Math.max(0, dias);
};

/** A campanha passou por regravacao/ajustes em algum momento? */
const houveRegravacao = (campaign) => {
  const log = Array.isArray(campaign?.stageLog) ? campaign.stageLog : [];
  return log.some((item) => item && item.stage === 'ajustes');
};

/** Quantas vezes a campanha voltou para ajustes. */
const quantidadeDeRegravacoes = (campaign) => {
  const log = Array.isArray(campaign?.stageLog) ? campaign.stageLog : [];
  return log.filter((item) => item && item.stage === 'ajustes').length;
};

/** Dias de atraso de um prazo em ISO curto (YYYY-MM-DD). 0 = em dia. */
const diasDeAtraso = (prazoIso) => {
  const dias = diasDesde(prazoIso);
  return dias === null ? 0 : Math.max(0, dias);
};

export {
  registrarMudancaDeEtapa,
  entradaNaEtapaAtual,
  primeiraEntradaEm,
  diasNaEtapaAtual,
  duracaoDoCiclo,
  houveRegravacao,
  quantidadeDeRegravacoes,
  diasDesde,
  diasEntre,
  diasDeAtraso
};
