import { state, saveState } from '../../core/state.js';
import { renderAll } from '../../core/renderers.js?v=20260728k';
import { showToast } from '../../core/ui.js?v=20260711a';
import { montarPrecificador } from '../pricing/quiz.js?v=20260728k';

/**
 * Precificador aberto de dentro de uma campanha, no micro "Escopo definido".
 *
 * Diferenca para os outros dois usos: aqui o resultado tem dono. As respostas
 * ficam em `campaign.pricing` (e delas sai o checklist de gravacao depois) e o
 * valor sugerido pode virar o valor da campanha com um clique. Depois disso o
 * valor continua editavel no cadastro normal, como qualquer outro campo.
 */

const getOverlay = () => document.getElementById('campaign-pricing');
const getStage = () => document.getElementById('campaign-pricing-stage');

let instancia = null;
let campanhaAtual = null;

const getCampaign = (campaignId) =>
  (Array.isArray(state.campaigns) ? state.campaigns : []).find((item) => item.id === campaignId) || null;

const fecharPrecificadorDaCampanha = () => {
  const overlay = getOverlay();
  if (overlay) overlay.classList.remove('open');
  if (instancia) {
    instancia.destruir();
    instancia = null;
  }
  campanhaAtual = null;
};

/** Grava o valor calculado na campanha. Continua editável no cadastro. */
const usarComoValorDaCampanha = (campaign, resultado, respostas) => {
  campaign.value = resultado.justo;
  campaign.pricing = {
    respostas,
    resultado: { minimo: resultado.minimo, justo: resultado.justo, ideal: resultado.ideal },
    detalhamento: resultado.detalhamento,
    atualizadoEm: new Date().toISOString()
  };
  campaign.updatedAt = campaign.pricing.atualizadoEm;
  saveState();
};

const abrirPrecificadorDaCampanha = (campaignId) => {
  const overlay = getOverlay();
  const stage = getStage();
  const campaign = getCampaign(campaignId);
  if (!overlay || !stage || !campaign) return false;

  if (instancia) instancia.destruir();
  campanhaAtual = campaign;

  const marca = String(campaign.brand || '').trim();

  instancia = montarPrecificador({
    container: stage,
    respostas: campaign.pricing?.respostas || null,
    cardId: 'intro',
    intro: {
      titulo: marca ? `Quanto cobrar da ${marca}?` : 'Quanto cobrar por essa campanha?',
      subtitulo: 'O valor calculado entra direto nessa campanha, e você pode ajustar depois.',
      cta: 'Começar',
      ctaSecundario: 'Agora não'
    },
    acoesDoResultado: [
      { id: 'usar', label: 'Usar como valor da campanha' },
      { id: 'fechar', label: 'Só conferir, não salvar' }
    ],
    // Salva as respostas conforme responde: se sair no meio, retoma com elas.
    aoMudar: ({ respostas }) => {
      campaign.pricing = { ...(campaign.pricing || {}), respostas };
      saveState();
    },
    aoAgir: (acao, resultado, respostas) => {
      if (acao === 'usar') {
        usarComoValorDaCampanha(campaign, resultado, respostas);
        fecharPrecificadorDaCampanha();
        renderAll();
        showToast('Valor salvo na campanha.');
        return;
      }
      fecharPrecificadorDaCampanha();
    },
    aoSair: fecharPrecificadorDaCampanha
  });

  overlay.classList.add('open');
  instancia.render();
  return true;
};

const getCampanhaDoPrecificador = () => campanhaAtual;

export { abrirPrecificadorDaCampanha, fecharPrecificadorDaCampanha, getCampanhaDoPrecificador };
