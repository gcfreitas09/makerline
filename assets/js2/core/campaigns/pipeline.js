/**
 * Ciclo de vida de uma campanha: as 4 macro-etapas, seus micros e a migracao
 * dos dados antigos.
 *
 * REGRA: esta e a unica fonte da estrutura do ciclo. Nenhum outro arquivo pode
 * declarar lista de status, de etapas ou de rotulos. Renomear uma etapa, mudar
 * a ordem ou acrescentar um micro acontece so aqui.
 *
 * Prospeccao nao faz parte do ciclo de campanhas: ela e uma secao propria do
 * app, com dados proprios em `state.prospections`.
 */

/**
 * @typedef {Object} MicroEtapa
 * @property {string} id Chave gravada em `campaign.stage`.
 * @property {string} label Texto exibido.
 */

/**
 * @typedef {Object} MacroEtapa
 * @property {string} id Chave gravada em `campaign.status`.
 * @property {string} label Texto exibido.
 * @property {MicroEtapa[]} micros Na ordem em que acontecem.
 */

/** @type {MacroEtapa[]} */
const CAMPAIGN_PIPELINE = [
  {
    id: 'negociacao',
    label: 'Negociação',
    micros: [
      { id: 'contato_recebido', label: 'Contato recebido' },
      { id: 'escopo_definido', label: 'Escopo definido' },
      { id: 'proposta_enviada', label: 'Proposta enviada' },
      { id: 'aguardando_aprovacao_marca', label: 'Aguardando aprovação da marca' },
      { id: 'negociacao_fechada', label: 'Negociação fechada' }
    ]
  },
  {
    id: 'producao',
    label: 'Produção',
    micros: [
      { id: 'aguardando_produto', label: 'Aguardando produto' },
      { id: 'produto_recebido', label: 'Produto recebido' },
      { id: 'roteiro_enviado', label: 'Roteiro enviado' },
      { id: 'aguardando_aprovacao_roteiro', label: 'Aguardando aprovação do roteiro' },
      { id: 'roteiro_aprovado', label: 'Roteiro aprovado' },
      { id: 'gravacao', label: 'Gravação' },
      { id: 'conteudo_enviado', label: 'Conteúdo enviado' },
      { id: 'aguardando_aprovacao_conteudo', label: 'Aguardando aprovação do conteúdo' },
      { id: 'ajustes', label: 'Regravação / ajustes' }
    ]
  },
  {
    id: 'entrega',
    label: 'Entrega',
    micros: [
      { id: 'conteudo_aprovado', label: 'Conteúdo aprovado' },
      { id: 'aguardando_pagamento', label: 'Aguardando pagamento' }
    ]
  },
  {
    id: 'concluida',
    label: 'Concluída',
    micros: [{ id: 'pago', label: 'Pago' }]
  }
];

const campaignStatusOrder = CAMPAIGN_PIPELINE.map((macro) => macro.id);

const statusLabels = CAMPAIGN_PIPELINE.reduce((acc, macro) => {
  acc[macro.id] = macro.label;
  return acc;
}, {});

const campaignStagesByStatus = CAMPAIGN_PIPELINE.reduce((acc, macro) => {
  acc[macro.id] = macro.micros;
  return acc;
}, {});

const statusDot = CAMPAIGN_PIPELINE.reduce((acc, macro) => {
  acc[macro.id] = `dot-${macro.id}`;
  return acc;
}, {});

const getCampaignStageOptions = (status) => campaignStagesByStatus[String(status || '').trim()] || [];

const getDefaultCampaignStage = (status) => {
  const opcoes = getCampaignStageOptions(status);
  return opcoes.length ? opcoes[0].id : '';
};

const getCampaignStageLabel = (status, stageId) => {
  const procurado = String(stageId || '').trim();
  if (!procurado) return '';
  const encontrado = getCampaignStageOptions(status).find((micro) => micro.id === procurado);
  return encontrado ? encontrado.label : '';
};

/** Macro-etapa onde um micro vive, independente do status gravado. */
const getStatusDoMicro = (stageId) => {
  const procurado = String(stageId || '').trim();
  if (!procurado) return '';
  const macro = CAMPAIGN_PIPELINE.find((item) => item.micros.some((micro) => micro.id === procurado));
  return macro ? macro.id : '';
};

/* ── migracao ───────────────────────────────────────────────── */

/**
 * Macro-etapas antigas. `prospeccao` saiu do ciclo e virou `negociacao`;
 * `finalizacao` virou `entrega`. Os nomes antigos de status (pendente,
 * negociando, realizado) vem de versoes ainda anteriores.
 */
const STATUS_ANTIGOS = {
  prospeccao: 'negociacao',
  finalizacao: 'entrega',
  realizado: 'entrega',
  pendente: 'negociacao',
  negociando: 'negociacao'
};

/**
 * Status legados que ja diziam em que ponto da conversa a campanha estava.
 * Sem eles, "negociando" cairia no primeiro micro e pareceria mais atrasada do
 * que esta de verdade.
 */
const MICRO_PADRAO_DO_STATUS_ANTIGO = {
  pendente: 'contato_recebido',
  negociando: 'proposta_enviada'
};

/**
 * Micros antigos da extinta macro Prospeccao. Quem estava "negociando" ja tinha
 * mandado numero para a marca, entao cai em proposta enviada.
 */
const MICROS_ANTIGOS = {
  abordagem: 'contato_recebido',
  negociacao: 'proposta_enviada',
  aprovado: 'negociacao_fechada'
};

/**
 * Traduz o par status/etapa de uma campanha para a estrutura atual.
 *
 * @param {Object} entrada
 * @param {string} entrada.status Status gravado hoje na campanha.
 * @param {string} entrada.stage Etapa gravada hoje na campanha.
 * @param {number} entrada.paymentPercent Usado so pelo legado `realizado`.
 * @returns {{status: string, stage: string}} Par sempre valido.
 */
const migrarStatusEEtapa = ({ status = '', stage = '', paymentPercent = 0 } = {}) => {
  const statusBruto = String(status || '').trim().toLowerCase();
  const stageBruto = String(stage || '').trim();

  // Legado `realizado`: quem ja recebeu tudo esta concluido, o resto ficou
  // parado esperando o pagamento.
  if (statusBruto === 'realizado') {
    return Number(paymentPercent) >= 100
      ? { status: 'concluida', stage: 'pago' }
      : { status: 'entrega', stage: 'aguardando_pagamento' };
  }

  const statusAlvo = campaignStatusOrder.includes(statusBruto)
    ? statusBruto
    : STATUS_ANTIGOS[statusBruto] || '';

  const stageAlvo = MICROS_ANTIGOS[stageBruto]
    || stageBruto
    || MICRO_PADRAO_DO_STATUS_ANTIGO[statusBruto]
    || '';

  // A etapa manda: se ela existe em alguma macro, o status segue a etapa. Isso
  // conserta sozinho pares desencontrados vindos de versoes antigas.
  const statusDaEtapa = getStatusDoMicro(stageAlvo);
  if (statusDaEtapa) return { status: statusDaEtapa, stage: stageAlvo };

  const statusFinal = statusAlvo || campaignStatusOrder[0];
  return { status: statusFinal, stage: getDefaultCampaignStage(statusFinal) };
};

/** Filtros salvos na interface que apontam para macro-etapas renomeadas. */
const migrarFiltroDeStatus = (filtro) => {
  const bruto = String(filtro || '').trim().toLowerCase();
  if (!bruto || bruto === 'all') return 'all';
  if (campaignStatusOrder.includes(bruto)) return bruto;
  return STATUS_ANTIGOS[bruto] || 'all';
};

export {
  CAMPAIGN_PIPELINE,
  campaignStatusOrder,
  campaignStagesByStatus,
  statusLabels,
  statusDot,
  getCampaignStageOptions,
  getDefaultCampaignStage,
  getCampaignStageLabel,
  getStatusDoMicro,
  migrarStatusEEtapa,
  migrarFiltroDeStatus
};
