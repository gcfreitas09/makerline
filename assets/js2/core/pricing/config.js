/**
 * Configuracao central de precificacao de campanhas UGC.
 *
 * REGRA: nenhum valor numerico de precificacao pode viver fora deste arquivo.
 * Componentes e a logica de calculo apenas leem daqui, entao trocar qualquer
 * peso, percentual ou faixa NAO exige alterar calculator.js nem a UI.
 *
 * Todos os numeros abaixo foram validados com usuaria parceira. Sao definitivos
 * ate nova validacao, e nao provisorios como na versao anterior.
 *
 * Ordem de calculo aplicada por calculator.js. Cada passo incide sobre o
 * resultado do passo anterior, nao sobre a base isolada:
 *   1. valor base por peca, conforme nivel de experiencia e familia (video/foto)
 *   2. anuncio pago
 *   3. exclusividade, +10% por mes de duracao
 *   4. uso perpetuo, +50%
 *   5. postagem na propria conta, por faixa de seguidores da rede escolhida
 *   6. footage bruto, +30%
 *   7. multiplica pela quantidade e aplica o desconto de pacote sobre o total
 *   8. arredondamento
 */

/**
 * @typedef {'iniciante'|'intermediario'|'avancado'} NivelDeExperiencia
 */

/**
 * @typedef {'video'|'foto'} FamiliaDeConteudo
 */

/**
 * @typedef {'reels_stories'|'video_tiktok'|'foto_ugc'} TipoDeConteudo
 */

/**
 * @typedef {Object} FaixaDeValor
 * @property {number} minimo Piso defensavel para a entrega.
 * @property {number} ideal Teto realista para quem entrega bem.
 */

/**
 * @typedef {Object} DefinicaoDeNivel
 * @property {string} label Texto exibido ao usuario.
 * @property {string} descricao Uma linha que ajuda a pessoa a se reconhecer.
 * @property {Record<FamiliaDeConteudo, FaixaDeValor>} base Valor por peca.
 */

/**
 * @typedef {Object} DefinicaoDeConteudo
 * @property {string} label Texto exibido ao usuario.
 * @property {FamiliaDeConteudo} familia De qual tabela de base ele puxa o valor.
 */

/**
 * @typedef {Object} DegrauDePacote
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
 * @property {NivelDeExperiencia} nivelPadrao
 * @property {Record<NivelDeExperiencia, DefinicaoDeNivel>} niveis
 * @property {Record<TipoDeConteudo, DefinicaoDeConteudo>} tiposDeConteudo
 * @property {Record<string, {label: string, meses: number}>} duracoesDeExclusividade
 * @property {DegrauDePacote[]} descontoPorPacote
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

  nivelPadrao: 'iniciante',

  // VALIDADO: o nivel de experiencia define o valor base de tudo, tanto video
  // quanto foto. E a primeira pergunta do formulario por isso.
  niveis: {
    iniciante: {
      label: 'Iniciante',
      descricao: 'Comecei agora, ainda montando portfólio',
      base: {
        video: { minimo: 200, ideal: 250 },
        foto: { minimo: 40, ideal: 50 }
      }
    },
    intermediario: {
      label: 'Intermediário',
      descricao: 'Já entrego com constância para marcas',
      base: {
        video: { minimo: 500, ideal: 550 },
        foto: { minimo: 60, ideal: 80 }
      }
    },
    avancado: {
      label: 'Avançado',
      descricao: 'Tenho portfólio forte e clientes recorrentes',
      base: {
        video: { minimo: 700, ideal: 800 },
        foto: { minimo: 90, ideal: 100 }
      }
    }
  },

  // O tipo nao carrega mais valor: ele so diz de qual tabela de base puxar.
  tiposDeConteudo: {
    reels_stories: { label: 'Reels / Stories', familia: 'video' },
    video_tiktok: { label: 'Vídeo TikTok', familia: 'video' },
    foto_ugc: { label: 'Foto (UGC estático)', familia: 'foto' }
  },

  // VALIDADO: exclusividade cobra +10% por mes de duracao. "Mais de 6 meses"
  // conta como um ano fechado.
  duracoesDeExclusividade: {
    um_mes: { label: '1 mês', meses: 1 },
    tres_meses: { label: '3 meses', meses: 3 },
    seis_meses: { label: '6 meses', meses: 6 },
    mais_de_seis: { label: 'Mais de 6 meses', meses: 12 }
  },

  // VALIDADO: pacote de 3 tem 10% de desconto, pacote de 5 tem 15%. Avaliado de
  // cima para baixo: vale o primeiro degrau que couber.
  descontoPorPacote: [
    { minimoPecas: 5, desconto: 0.15 },
    { minimoPecas: 3, desconto: 0.1 }
  ],

  modificadores: {
    // VALIDADO: uso em anuncio pago acrescenta de 30% a 50%. O piso vale para a
    // banda minima e o teto para a ideal, entao a incerteza aparece na faixa em
    // vez de virar mais uma pergunta.
    anuncioPago: {
      label: 'Conteúdo usado como anúncio pago',
      adicionalPercentual: { minimo: 0.3, ideal: 0.5 }
    },

    // VALIDADO: +10% por mes de exclusividade, sobre o valor que ja veio com
    // anuncio pago aplicado.
    exclusividade: {
      label: 'Exclusividade com a marca',
      adicionalPercentualPorMes: 0.1
    },

    // VALIDADO: uso sem prazo acrescenta metade do valor acumulado ate aqui.
    usoPerpetuo: {
      label: 'Uso perpétuo, sem prazo',
      adicionalPercentual: 0.5
    },

    // VALIDADO: material bruto sem edicao custa 30% a mais sobre a entrega.
    footageBruto: {
      label: 'Material bruto sem edição',
      adicionalPercentual: 0.3
    },

    // VALIDADO: o adicional sai da rede onde o conteudo vai ser publicado.
    // Somar os seguidores das duas redes cobraria por audiencia que nao vai ver
    // o post, entao a rede escolhida e a unica que conta.
    postarNaPropriaConta: {
      label: 'Publicação no seu próprio perfil',
      redes: {
        instagram: { label: 'Instagram' },
        tiktok: { label: 'TikTok' }
      },
      redePadrao: 'instagram',
      faixasDeSeguidores: [
        { ate: 10000, adicionalPercentual: 0.2, label: 'até 10 mil seguidores' },
        { ate: 50000, adicionalPercentual: 0.3, label: '10 mil a 50 mil seguidores' },
        { ate: Infinity, adicionalPercentual: 0.4, label: 'acima de 50 mil seguidores' }
      ]
    },

    // A regra de plataforma continua neutra. Se ficar decidido que a plataforma
    // entrega valor ja fechado, basta ligar bloqueiaAdicionaisDeNegociacao: a
    // logica ja le essa flag e nao precisa de alteracao.
    viaPlataforma: {
      label: 'Campanha através de plataforma',
      multiplicador: 1,
      bloqueiaAdicionaisDeNegociacao: false
    }
  },

  // Quais modificadores contam como "adicional de negociacao", ou seja, os que
  // deixam de valer quando a plataforma entrega um valor ja fechado. Footage
  // fica de fora de proposito: e escopo de entrega, nao termo de negociacao.
  adicionaisDeNegociacao: ['usoPerpetuo', 'exclusividade', 'postarNaPropriaConta']
};

export { PRICING_CONFIG };
