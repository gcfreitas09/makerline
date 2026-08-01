import { state, saveState } from '../../core/state.js';
import { PRICING_CONFIG } from '../../core/pricing/config.js?v=20260728a';
import { montarPrecificador } from './quiz.js?v=20260728k';

/**
 * Precificador como secao propria do app: mesmas perguntas do onboarding, sem
 * vinculo com campanha nenhuma. O resultado e informativo, e so vira campanha
 * se o usuario pedir.
 *
 * As respostas ficam em `state.ui.pricingPage` para a pessoa poder sair da
 * secao, voltar e continuar de onde parou.
 */

let instancia = null;

const getContainer = () => document.querySelector('[data-pricing-page]');

/** Primeira tela da seção: aqui não há intro, a pessoa já veio para calcular. */
const PRIMEIRA_TELA = 'grupo_trabalho';

const ensurePricingPageState = () => {
  if (!state.ui || typeof state.ui !== 'object') state.ui = {};
  if (!state.ui.pricingPage || typeof state.ui.pricingPage !== 'object') {
    state.ui.pricingPage = { cardId: PRIMEIRA_TELA, respostas: null };
  }
  return state.ui.pricingPage;
};

/** Leva o valor calculado para o cadastro de campanha, sem salvar nada antes. */
const registrarCampanhaComOValor = (resultado, respostas) => {
  const definicao = PRICING_CONFIG.tiposDeConteudo[resultado.detalhamento.tipoDeConteudo];
  const ehFoto = resultado.detalhamento.tipoDeConteudo === 'foto_ugc';

  state.ui.pendingCampaignPrefill = {
    value: resultado.justo,
    photoCount: ehFoto ? resultado.detalhamento.quantidade : null,
    videoCount: ehFoto ? null : resultado.detalhamento.quantidade,
    contentType: resultado.detalhamento.tipoDeConteudo,
    contentTypeLabel: definicao ? definicao.label : ''
  };
  state.ui.pendingCampaignPricing = { respostas, resultado };
  saveState();

  const abrir = window.__ugcModals?.abrirCadastroDeCampanha || window.__ugcModals?.openCampaignModal;
  if (typeof abrir === 'function') abrir();
};

const recomecar = () => {
  const pagina = ensurePricingPageState();
  pagina.cardId = PRIMEIRA_TELA;
  pagina.respostas = null;
  saveState();
  renderPricingPage({ reiniciar: true });
};

/**
 * Renderiza (ou re-renderiza) o precificador da secao.
 * @param {{reiniciar?: boolean}} [opcoes]
 */
const renderPricingPage = ({ reiniciar = false } = {}) => {
  const container = getContainer();
  if (!container) return;

  const pagina = ensurePricingPageState();
  if (instancia && !reiniciar) {
    instancia.render();
    return;
  }

  if (instancia) instancia.destruir();

  instancia = montarPrecificador({
    container,
    respostas: pagina.respostas,
    cardId: pagina.cardId,
    // A seção agrupa as perguntas em 3 telas. O onboarding continua com uma
    // pergunta por tela: lá a pessoa está conhecendo o produto, aqui ela já
    // sabe o que veio fazer.
    agrupado: true,
    mostrarIntro: false,
    acoesDoResultado: [
      { id: 'registrar', label: 'Registrar campanha com esse valor' },
      { id: 'recomecar', label: 'Calcular outra campanha' }
    ],
    aoMudar: ({ respostas, cardId }) => {
      pagina.respostas = respostas;
      pagina.cardId = cardId;
      saveState();
    },
    aoAgir: (acao, resultado, respostas) => {
      if (acao === 'registrar') registrarCampanhaComOValor(resultado, respostas);
      else recomecar();
    }
  });

  instancia.render();
};

export { renderPricingPage };
