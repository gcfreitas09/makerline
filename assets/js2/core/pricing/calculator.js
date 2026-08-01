import { PRICING_CONFIG } from './config.js?v=20260728p';

/**
 * Calculo de preco de campanha UGC.
 *
 * Modulo puro: nao toca no DOM, nao le estado global e nao contem nenhum valor
 * de precificacao literal. Tudo vem de config.js.
 *
 * O calculo e uma CADEIA: cada modificador incide sobre o valor que saiu do
 * modificador anterior, nao sobre a base. Trocar a ordem muda o resultado, por
 * isso ela esta explicita em ORDEM_DA_CADEIA.
 */

/**
 * @typedef {Object} RespostasDePrecificacao
 * @property {'iniciante'|'intermediario'|'avancado'} nivelDeExperiencia
 * @property {boolean} postaNaPropriaConta
 * @property {string} tipoDeConteudo Chave de PRICING_CONFIG.tiposDeConteudo.
 * @property {number} quantidade
 * @property {boolean} usoComoAnuncio
 * @property {boolean} usoPerpetuo
 * @property {'instagram'|'tiktok'} [redeDePostagem] Onde o conteudo vai sair.
 * @property {number} [seguidores] Seguidores na rede escolhida.
 * @property {boolean} exclusividade
 * @property {string} [duracaoExclusividade] Chave de duracoesDeExclusividade.
 * @property {boolean} footageBruto
 * @property {boolean} viaPlataforma
 */

/**
 * @typedef {Object} Fator
 * @property {string} id
 * @property {string} label
 * @property {'aumento'|'reducao'|'neutro'} efeito
 * @property {string} detalhe Ex: "+30%", "-15%".
 */

/**
 * @typedef {Object} ResultadoDePreco
 * @property {number} minimo
 * @property {number} justo
 * @property {number} ideal
 * @property {Fator[]} fatores
 * @property {Object} detalhamento
 */

/** As duas pontas da faixa. O "justo" e a media, calculada no fim. */
const PONTAS = ['minimo', 'ideal'];

/** A ordem importa: esta e a sequencia que a validacao definiu. */
const ORDEM_DA_CADEIA = ['anuncioPago', 'exclusividade', 'usoPerpetuo', 'postarNaPropriaConta', 'footageBruto'];

const numero = (valor, padrao = 0) => {
  const convertido = Number(valor);
  return Number.isFinite(convertido) ? convertido : padrao;
};

const formatarPercentual = (fracao) => `${Math.round(fracao * 100)}%`;

const formatarReais = (valor) => `R$ ${Math.round(valor).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

const arredondar = (valor, passo) => {
  if (!Number.isFinite(passo) || passo <= 1) return Math.round(valor);
  return Math.round(valor / passo) * passo;
};

/** Nivel de experiencia, caindo no padrao configurado quando vier vazio. */
const resolverNivel = (nivel, config) => {
  const chave = String(nivel || '').trim();
  if (chave && config.niveis[chave]) return { chave, definicao: config.niveis[chave] };
  const padrao = config.niveis[config.nivelPadrao] ? config.nivelPadrao : Object.keys(config.niveis)[0];
  return { chave: padrao, definicao: config.niveis[padrao] };
};

/** Tipo de conteudo, caindo no primeiro configurado quando vier desconhecido. */
const resolverTipoDeConteudo = (tipo, config) => {
  const tipos = config.tiposDeConteudo;
  if (tipo && tipos[tipo]) return { chave: tipo, definicao: tipos[tipo] };
  const primeira = Object.keys(tipos)[0];
  return { chave: primeira, definicao: tipos[primeira] };
};

const resolverQuantidade = (quantidade, config) => {
  const bruta = Math.round(numero(quantidade, config.quantidade.padrao));
  return Math.max(config.quantidade.minimo, Math.min(config.quantidade.maximo, bruta));
};

const resolverDescontoDePacote = (quantidade, config) => {
  const degrau = config.descontoPorPacote.find((item) => quantidade >= item.minimoPecas);
  return degrau ? degrau.desconto : 0;
};

/** Meses de exclusividade a partir da duracao escolhida. */
const resolverMesesDeExclusividade = (duracao, config) => {
  const definicao = config.duracoesDeExclusividade[String(duracao || '').trim()];
  if (definicao) return { meses: definicao.meses, label: definicao.label };
  const primeira = Object.values(config.duracoesDeExclusividade)[0];
  return { meses: primeira.meses, label: primeira.label };
};

/**
 * Faixa de seguidores da rede onde o conteudo vai ser publicado. Aceita tanto o
 * numero direto quanto o objeto por rede que as respostas antigas usavam.
 */
const resolverFaixaDeSeguidores = (respostas, config) => {
  const regra = config.modificadores.postarNaPropriaConta;
  const rede = regra.redes[String(respostas.redeDePostagem || '').trim()]
    ? String(respostas.redeDePostagem).trim()
    : regra.redePadrao;

  const bruto = respostas.seguidores;
  const total = bruto && typeof bruto === 'object'
    ? Math.max(0, numero(bruto[rede], 0))
    : Math.max(0, numero(bruto, 0));

  const faixa = regra.faixasDeSeguidores.find((item) => total <= item.ate)
    || regra.faixasDeSeguidores[regra.faixasDeSeguidores.length - 1];

  return { rede, redeLabel: regra.redes[rede].label, total, faixa };
};

/**
 * @param {RespostasDePrecificacao} respostas
 * @param {typeof PRICING_CONFIG} [config]
 * @returns {ResultadoDePreco}
 */
const calcularPrecoCampanha = (respostas = {}, config = PRICING_CONFIG) => {
  const { chave: nivelChave, definicao: nivel } = resolverNivel(respostas.nivelDeExperiencia, config);
  const { chave: tipoChave, definicao: tipo } = resolverTipoDeConteudo(respostas.tipoDeConteudo, config);
  const quantidade = resolverQuantidade(respostas.quantidade, config);
  const mods = config.modificadores;

  const viaPlataforma = Boolean(respostas.viaPlataforma);
  const negociacaoBloqueada = viaPlataforma && Boolean(mods.viaPlataforma.bloqueiaAdicionaisDeNegociacao);
  const negociacaoValida = (id) => !(negociacaoBloqueada && config.adicionaisDeNegociacao.includes(id));

  const fatores = [];

  /**
   * Cada elo da cadeia devolve o percentual a acrescentar, por ponta da faixa.
   * Percentual 0 significa que o elo nao se aplica a esta campanha.
   */
  const elos = {};

  // 2. Anuncio pago: a faixa 30%~50% vira as duas pontas do resultado.
  const ehAnuncio = Boolean(respostas.usoComoAnuncio);
  if (ehAnuncio) {
    const faixa = mods.anuncioPago.adicionalPercentual;
    elos.anuncioPago = { minimo: faixa.minimo, ideal: faixa.ideal };
    fatores.push({
      id: 'anuncioPago',
      label: mods.anuncioPago.label,
      efeito: 'aumento',
      detalhe: `+${formatarPercentual(faixa.minimo)} a ${formatarPercentual(faixa.ideal)}`
    });
  }

  // 3. Exclusividade: +10% por mes, sobre o valor que ja veio com anuncio.
  let mesesDeExclusividade = 0;
  if (respostas.exclusividade && negociacaoValida('exclusividade')) {
    const duracao = resolverMesesDeExclusividade(respostas.duracaoExclusividade, config);
    mesesDeExclusividade = duracao.meses;
    const percentual = mods.exclusividade.adicionalPercentualPorMes * duracao.meses;
    elos.exclusividade = { minimo: percentual, ideal: percentual };
    fatores.push({
      id: 'exclusividade',
      label: `${mods.exclusividade.label}, ${duracao.label}`,
      efeito: 'aumento',
      detalhe: `+${formatarPercentual(percentual)}`
    });
  }

  // 4. Uso perpetuo: acrescenta metade do que veio acumulado ate aqui.
  if (respostas.usoPerpetuo && negociacaoValida('usoPerpetuo')) {
    const percentual = mods.usoPerpetuo.adicionalPercentual;
    elos.usoPerpetuo = { minimo: percentual, ideal: percentual };
    fatores.push({
      id: 'usoPerpetuo',
      label: mods.usoPerpetuo.label,
      efeito: 'aumento',
      detalhe: `+${formatarPercentual(percentual)}`
    });
  }

  // 5. Postagem na propria conta, pela faixa da rede escolhida.
  let seguidoresResolvidos = null;
  if (respostas.postaNaPropriaConta && negociacaoValida('postarNaPropriaConta')) {
    seguidoresResolvidos = resolverFaixaDeSeguidores(respostas, config);
    const percentual = seguidoresResolvidos.faixa.adicionalPercentual;
    elos.postarNaPropriaConta = { minimo: percentual, ideal: percentual };
    fatores.push({
      id: 'postarNaPropriaConta',
      label: `${mods.postarNaPropriaConta.label} no ${seguidoresResolvidos.redeLabel}, ${seguidoresResolvidos.faixa.label}`,
      efeito: 'aumento',
      detalhe: `+${formatarPercentual(percentual)}`
    });
  }

  // 6. Footage bruto: incide sobre o valor da entrega ja composto.
  if (respostas.footageBruto) {
    const percentual = mods.footageBruto.adicionalPercentual;
    elos.footageBruto = { minimo: percentual, ideal: percentual };
    fatores.push({
      id: 'footageBruto',
      label: mods.footageBruto.label,
      efeito: 'aumento',
      detalhe: `+${formatarPercentual(percentual)}`
    });
  }

  // 7. Desconto de pacote, sobre o total de todas as pecas.
  const descontoPacote = resolverDescontoDePacote(quantidade, config);
  if (descontoPacote > 0) {
    fatores.push({
      id: 'descontoPacote',
      label: `Pacote de ${quantidade} peças`,
      efeito: 'reducao',
      detalhe: `-${formatarPercentual(descontoPacote)}`
    });
  }

  const multiplicadorPlataforma = viaPlataforma ? mods.viaPlataforma.multiplicador : 1;
  if (viaPlataforma && (multiplicadorPlataforma !== 1 || negociacaoBloqueada)) {
    fatores.push({
      id: 'viaPlataforma',
      label: mods.viaPlataforma.label,
      efeito: multiplicadorPlataforma < 1 || negociacaoBloqueada ? 'reducao' : 'aumento',
      detalhe: negociacaoBloqueada ? 'valor já fechado pela plataforma' : `${multiplicadorPlataforma}x`
    });
  }

  const baseDaFamilia = nivel.base[tipo.familia] || nivel.base.video;
  const baseUnitaria = {};
  const valorPorPeca = {};
  const valores = {};

  PONTAS.forEach((ponta) => {
    const base = numero(baseDaFamilia[ponta], 0);
    baseUnitaria[ponta] = base;

    // A cadeia: cada elo multiplica o que veio do anterior.
    let porPeca = base;
    ORDEM_DA_CADEIA.forEach((id) => {
      const elo = elos[id];
      if (elo) porPeca *= 1 + elo[ponta];
    });
    valorPorPeca[ponta] = porPeca;

    let total = porPeca * quantidade;
    total *= 1 - descontoPacote;
    total *= multiplicadorPlataforma;

    valores[ponta] = Math.max(0, arredondar(total, config.arredondamento));
  });

  // O "justo" e o meio da faixa: nao existe tabela propria para ele.
  const justo = arredondar((valores.minimo + valores.ideal) / 2, config.arredondamento);
  const ordenados = [valores.minimo, justo, valores.ideal].sort((a, b) => a - b);

  return {
    minimo: ordenados[0],
    justo: ordenados[1],
    ideal: ordenados[2],
    fatores,
    detalhamento: {
      nivelDeExperiencia: nivelChave,
      nivelLabel: nivel.label,
      tipoDeConteudo: tipoChave,
      tipoLabel: tipo.label,
      familia: tipo.familia,
      quantidade,
      baseUnitaria,
      valorPorPeca,
      cadeia: ORDEM_DA_CADEIA.filter((id) => elos[id]),
      adicionais: elos,
      mesesDeExclusividade,
      descontoPacote,
      multiplicadorPlataforma,
      negociacaoBloqueada,
      seguidores: seguidoresResolvidos
    }
  };
};

export { calcularPrecoCampanha, formatarReais, formatarPercentual, ORDEM_DA_CADEIA };
