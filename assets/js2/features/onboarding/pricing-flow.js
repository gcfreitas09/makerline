import { state, saveState } from '../../core/state.js';
import { renderAll } from '../../core/renderers.js?v=20260429d';
import { setActivePage } from '../../core/ui.js?v=20260304b';
import { PRICING_CONFIG } from '../../core/pricing/config.js?v=20260728o';
import { montarPrecificador, respostasPadrao } from '../pricing/quiz.js?v=20260728o';
import { abrirRegistroGuiado } from '../campaigns/register-flow.js?v=20260728o';

/**
 * Onboarding, ramo "tenho campanha ativa": o precificador aparece no overlay do
 * quiz e termina levando ao cadastro da campanha.
 *
 * As perguntas e o calculo nao vivem aqui. Este arquivo so diz onde renderizar,
 * onde guardar as respostas e o que os botoes do resultado fazem.
 */

const ensurePricingState = () => {
  if (!state.progress) state.progress = {};
  if (!state.progress.onboarding || typeof state.progress.onboarding !== 'object') {
    state.progress.onboarding = {};
  }
  const onboarding = state.progress.onboarding;
  if (!onboarding.pricing || typeof onboarding.pricing !== 'object') {
    onboarding.pricing = { cardId: 'intro', respostas: respostasPadrao(), concluido: false };
  }
  const pricing = onboarding.pricing;
  if (typeof pricing.cardId !== 'string') pricing.cardId = 'intro';
  if (!pricing.respostas || typeof pricing.respostas !== 'object') pricing.respostas = respostasPadrao();
  if (typeof pricing.concluido !== 'boolean') pricing.concluido = false;
  return pricing;
};

const getOverlay = () => document.getElementById('pricing-quiz');
const getStage = () => document.getElementById('pricing-stage');

let instancia = null;

const fecharFluxoDePrecificacao = () => {
  const overlay = getOverlay();
  if (overlay) overlay.classList.remove('open');
  if (instancia) {
    instancia.destruir();
    instancia = null;
  }
};

/** Encerra o onboarding e leva pro cadastro da campanha com o valor sugerido. */
const registrarCampanha = (resultado) => {
  const pricing = ensurePricingState();
  const definicao = PRICING_CONFIG.tiposDeConteudo[resultado.detalhamento.tipoDeConteudo];
  const ehFoto = resultado.detalhamento.tipoDeConteudo === 'foto_ugc';

  // Mesmo padrao de state.ui.pendingCampaignBrandId: o cadastro consome e limpa.
  state.ui.pendingCampaignPrefill = {
    value: resultado.justo,
    photoCount: ehFoto ? resultado.detalhamento.quantidade : null,
    videoCount: ehFoto ? null : resultado.detalhamento.quantidade,
    contentType: resultado.detalhamento.tipoDeConteudo,
    contentTypeLabel: definicao ? definicao.label : ''
  };
  // As respostas seguem junto: e delas que sai o checklist de gravação depois.
  state.ui.pendingCampaignPricing = { respostas: pricing.respostas, resultado };

  pricing.concluido = true;
  pricing.resultado = { minimo: resultado.minimo, justo: resultado.justo, ideal: resultado.ideal };
  state.progress.onboarding.quizDone = true;
  saveState();

  fecharFluxoDePrecificacao();
  renderAll();
  setActivePage('campaigns');

  setTimeout(() => {
    if (abrirRegistroGuiado()) return;
    const abrirModal = window.__ugcModals?.openCampaignModal;
    if (typeof abrirModal === 'function') abrirModal();
  }, 180);
};

const pular = () => {
  const pricing = ensurePricingState();
  state.progress.onboarding.quizDone = true;
  pricing.concluido = true;
  saveState();
  fecharFluxoDePrecificacao();
  renderAll();
};

const abrirFluxoDePrecificacao = () => {
  const overlay = getOverlay();
  const stage = getStage();
  if (!overlay || !stage) return false;

  const pricing = ensurePricingState();
  if (instancia) instancia.destruir();

  instancia = montarPrecificador({
    container: stage,
    respostas: pricing.respostas,
    cardId: pricing.cardId,
    intro: {
      titulo: 'Vamos descobrir o valor justo da sua campanha',
      subtitulo: 'Isso leva menos de 1 minuto.',
      cta: 'Começar',
      ctaSecundario: 'Pular por agora'
    },
    acoesDoResultado: [
      { id: 'registrar', label: 'Registrar essa campanha agora' },
      { id: 'depois', label: 'Agora não' }
    ],
    aoMudar: ({ respostas, cardId }) => {
      pricing.respostas = respostas;
      pricing.cardId = cardId;
      saveState();
    },
    aoAgir: (acao, resultado) => {
      if (acao === 'registrar') registrarCampanha(resultado);
      else pular();
    },
    aoSair: pular
  });

  overlay.classList.add('open');
  instancia.render();
  return true;
};

export { abrirFluxoDePrecificacao, fecharFluxoDePrecificacao, ensurePricingState };
