import { PRICING_CONFIG } from '../pricing/config.js?v=20260728p';

/**
 * Checklist de gravacao montado a partir do que a campanha ja respondeu no
 * precificador. Nada aqui e generico: cada item so aparece porque uma resposta
 * pediu por ele.
 *
 * Modulo puro: recebe a campanha, devolve a lista.
 */

/** Itens que valem para qualquer gravacao. */
const ITENS_BASE = [
  { id: 'briefing', texto: 'Reler o briefing e os pontos que a marca pediu para destacar' },
  { id: 'produto', texto: 'Separar o produto e conferir que está apresentável na câmera' },
  { id: 'luz_audio', texto: 'Testar luz e áudio antes de gravar a primeira take' }
];

/** Itens que dependem do tipo de conteudo escolhido na precificacao. */
const ITENS_POR_TIPO = {
  reels_stories: [
    { id: 'vertical', texto: 'Gravar na vertical 9:16, com margem para legendas e stickers' },
    { id: 'gancho', texto: 'Gravar 2 opções de gancho para os 3 primeiros segundos' }
  ],
  video_tiktok: [
    { id: 'vertical', texto: 'Gravar na vertical 9:16, som ambiente limpo para narrar por cima' },
    { id: 'gancho', texto: 'Gravar 2 opções de gancho para os 3 primeiros segundos' }
  ],
  video_ads: [
    { id: 'variacoes', texto: 'Gravar variações de abertura para a marca testar como anúncio' },
    { id: 'cta', texto: 'Gravar a chamada final (CTA) em pelo menos duas entonações' }
  ],
  foto_ugc: [
    { id: 'angulos', texto: 'Fotografar em pelo menos 3 ângulos e 2 fundos diferentes' },
    { id: 'resolucao', texto: 'Conferir resolução e enquadramento antes de encerrar' }
  ]
};

/**
 * Monta o checklist da campanha.
 *
 * @param {Object} campaign Campanha com `pricing.respostas` preenchido.
 * @returns {{id: string, texto: string}[]} Vazio nunca: sempre volta o básico.
 */
const montarChecklistDeGravacao = (campaign) => {
  const respostas = campaign?.pricing?.respostas || {};
  const itens = [...ITENS_BASE];

  const tipo = String(respostas.tipoDeConteudo || '').trim();
  if (ITENS_POR_TIPO[tipo]) itens.push(...ITENS_POR_TIPO[tipo]);

  const quantidade = Math.max(0, Number(respostas.quantidade) || 0);
  if (quantidade > 1) {
    itens.push({
      id: 'quantidade',
      texto: `Cobrir as ${quantidade} peças combinadas antes de desmontar o set`
    });
  }

  // A marca pediu o material bruto: nao da para apagar as takes cruas.
  if (respostas.footageBruto === true) {
    itens.push({
      id: 'footage',
      texto: 'Separar arquivo bruto sem edição para entrega'
    });
  }

  // Exclusividade restringe o que pode aparecer em cena.
  if (respostas.exclusividade === true) {
    itens.push({
      id: 'exclusividade',
      texto: 'Conferir que nenhuma marca concorrente aparece em cena, no fundo ou na roupa'
    });
  }

  if (respostas.postaNaPropriaConta === true) {
    itens.push({
      id: 'conta_propria',
      texto: 'Preparar legenda e @ da marca: esse conteúdo vai no seu perfil'
    });
  } else if (respostas.postaNaPropriaConta === false) {
    itens.push({
      id: 'so_producao',
      texto: 'Gravar sem elementos do seu perfil: o material é da marca para usar por conta dela'
    });
  }

  if (respostas.usoComoAnuncio === true) {
    itens.push({
      id: 'anuncio',
      texto: 'Deixar espaço de sobra no enquadramento para cortes de anúncio'
    });
  }

  return itens;
};

/** Rotulo do tipo de conteudo, para exibir no cabecalho do checklist. */
const rotuloDoTipoDeConteudo = (campaign) => {
  const tipo = String(campaign?.pricing?.respostas?.tipoDeConteudo || '').trim();
  const definicao = PRICING_CONFIG.tiposDeConteudo[tipo];
  return definicao ? definicao.label : '';
};

export { montarChecklistDeGravacao, rotuloDoTipoDeConteudo };
