/**
 * Configuracao central de precificacao de campanhas UGC.
 *
 * REGRA: nenhum valor numerico de precificacao pode viver fora deste arquivo.
 * Componentes e a logica de calculo apenas leem daqui, entao trocar qualquer
 * peso, percentual ou faixa NAO exige alterar calculator.js nem a UI.
 *
 * Valores marcados com PROVISORIO ainda aguardam validacao externa e devem
 * mudar nos proximos dias. Os demais vieram de pesquisa de mercado confirmada.
 *
 * Ordem de calculo aplicada por calculator.js (a mesma para minimo/justo/ideal):
 *   1. base por peca, conforme o tipo de conteudo
 *   2. multiplicador de anuncio pago (dobra a base)
 *   3. multiplica pela quantidade de pecas
 *   4. desconto por volume
 *   5. adicionais percentuais (footage, perpetuo, exclusividade, conta propria)
 *   6. adicionais fixos (gravacao presencial)
 *   7. regra de plataforma
 *   8. arredondamento
 */

/**
 * @typedef {'reels_stories'|'video_tiktok'|'foto_ugc'|'video_ads'} TipoDeConteudo
 */

/**
 * @typedef {Object} FaixaDeValor
 * @property {number} minimo Piso defensavel para a entrega.
 * @property {number} justo Valor de referencia de mercado.
 * @property {number} ideal Teto realista para quem entrega bem.
 */

/**
 * @typedef {Object} DefinicaoDeConteudo
 * @property {string} label Texto exibido ao usuario.
 * @property {FaixaDeValor} base Valor por peca, antes de qualquer modificador.
 * @property {boolean} jaEhAnuncio Se o proprio tipo ja pressupoe uso em ads.
 */

/**
 * @typedef {Object} DegrauDeVolume
 * @property {number} minimoPecas Quantidade a partir da qual o degrau vale.
 * @property {number} desconto Fracao descontada do total (0.10 = 10%).
 */

/**
 * @typedef {Object} FaixaDeSeguidores
 * @property {number} ate Limite superior da faixa, inclusive.
 * @property {number} adicionalPercentual Fracao somada ao subtotal.
 * @property {string} label Texto curto da faixa.
 */

/**
 * @typedef {Object} PricingConfig
 * @property {number} arredondamento
 * @property {Record<TipoDeConteudo, DefinicaoDeConteudo>} tiposDeConteudo
 * @property {DegrauDeVolume[]} descontoPorVolume
 * @property {Object} modificadores
 * @property {Object} quantidade
 */

/** @type {PricingConfig} */
const PRICING_CONFIG = {
  // Arredonda o resultado final para o multiplo mais proximo, para o numero
  // sair "redondo" na tela em vez de R$ 437.
  arredondamento: 10,

  quantidade: {
    minimo: 1,
    maximo: 100,
    padrao: 1
  },

  tiposDeConteudo: {
    // CONFIRMADO: 1 video entre R$200 e R$300.
    reels_stories: {
      label: 'Reels / Stories',
      base: { minimo: 200, justo: 250, ideal: 300 },
      jaEhAnuncio: false
    },
    // CONFIRMADO: mesma faixa de video.
    video_tiktok: {
      label: 'Vídeo TikTok',
      base: { minimo: 200, justo: 250, ideal: 300 },
      jaEhAnuncio: false
    },
    // CONFIRMADO: R$40 a R$50 na entrega simples, R$60 a R$100 na mais
    // profissional. Em vez de virar mais uma pergunta, a variacao de qualidade
    // aparece na propria banda: piso da simples, teto da profissional.
    foto_ugc: {
      label: 'Foto (UGC estático)',
      base: { minimo: 40, justo: 60, ideal: 100 },
      jaEhAnuncio: false
    },
    // CONFIRMADO: conteudo para ads vale o dobro do organico. O dobro vem do
    // multiplicador em modificadores.anuncioPago, nao da base, para nao contar
    // duas vezes quando o usuario tambem marcar "anuncio pago" no card 5.
    video_ads: {
      label: 'Vídeo para anúncio (ads)',
      base: { minimo: 200, justo: 250, ideal: 300 },
      jaEhAnuncio: true
    }
  },

  // CONFIRMADO: pacote de 3 tem 10% de desconto, pacote de 5 tem 15%.
  // Avaliado de cima para baixo: vale o primeiro degrau que couber.
  descontoPorVolume: [
    { minimoPecas: 5, desconto: 0.15 },
    { minimoPecas: 3, desconto: 0.1 }
  ],

  modificadores: {
    // CONFIRMADO: conteudo usado como anuncio vale o dobro do organico.
    anuncioPago: {
      label: 'Conteúdo usado como anúncio pago',
      multiplicadorBase: 2
    },

    // PROVISORIO: aguarda validacao externa.
    usoPerpetuo: {
      label: 'Uso perpétuo, sem prazo',
      adicionalPercentual: 0.1
    },

    // CONFIRMADO: material bruto sem edicao custa 30% a mais sobre a entrega.
    footageBruto: {
      label: 'Material bruto sem edição',
      adicionalPercentual: 0.3
    },

    // PROVISORIO: aguarda validacao externa.
    exclusividade: {
      label: 'Exclusividade com a marca',
      adicionalPercentual: 0.1
    },

    // PROVISORIO: aguarda validacao externa. Suporta os dois formatos ao mesmo
    // tempo, entao trocar de fixo para percentual e so mexer nestes numeros.
    gravacaoPresencial: {
      label: 'Gravação presencial ou deslocamento',
      adicionalPercentual: 0,
      adicionalFixo: 150
    },

    // PROVISORIO: aguarda validacao externa. Faixas avaliadas de cima para
    // baixo pelo maior numero de seguidores entre Instagram e TikTok.
    postarNaPropriaConta: {
      label: 'Publicação no seu próprio perfil',
      usarMaiorEntrePlataformas: true,
      faixasDeSeguidores: [
        { ate: 10000, adicionalPercentual: 0.2, label: 'até 10 mil seguidores' },
        { ate: 50000, adicionalPercentual: 0.4, label: '10 mil a 50 mil seguidores' },
        { ate: 200000, adicionalPercentual: 0.7, label: '50 mil a 200 mil seguidores' },
        { ate: Infinity, adicionalPercentual: 1, label: 'acima de 200 mil seguidores' }
      ]
    },

    // PROVISORIO: a regra de plataforma ainda nao foi definida. Hoje o
    // multiplicador e neutro. Se ficar decidido que a plataforma entrega valor
    // ja fechado, basta ligar bloqueiaAdicionaisDeNegociacao aqui: a logica ja
    // le essa flag e nao precisa de alteracao.
    viaPlataforma: {
      label: 'Campanha através de plataforma',
      multiplicador: 1,
      bloqueiaAdicionaisDeNegociacao: false
    }
  },

  // Quais modificadores contam como "adicional de negociacao", ou seja, os que
  // deixam de valer quando a plataforma entrega um valor ja fechado. Footage
  // fica de fora de proposito: e escopo de entrega, nao termo de negociacao.
  adicionaisDeNegociacao: ['usoPerpetuo', 'exclusividade', 'gravacaoPresencial', 'postarNaPropriaConta']
};

export { PRICING_CONFIG };
