import { PRICING_CONFIG } from './config.js?v=20260728a';

/**
 * Calculo de preco de campanha UGC.
 *
 * Modulo puro: nao toca no DOM, nao le estado global e nao contem nenhum valor
 * de precificacao literal. Tudo vem de config.js.
 */

/**
 * @typedef {Object} RespostasDePrecificacao
 * @property {boolean} postaNaPropriaConta
 * @property {string} tipoDeConteudo Chave de PRICING_CONFIG.tiposDeConteudo.
 * @property {number} quantidade
 * @property {boolean} usoComoAnuncio
 * @property {boolean} usoPerpetuo
 * @property {{instagram?: number, tiktok?: number}} [seguidores]
 * @property {boolean} exclusividade
 * @property {boolean} footageBruto
 * @property {boolean} gravacaoPresencial
 * @property {boolean} viaPlataforma
 */

/**
 * @typedef {Object} Fator
 * @property {string} id
 * @property {string} label
 * @property {'aumento'|'reducao'|'neutro'} efeito
 * @property {string} detalhe Ex: "+30%", "-15%", "+R$ 150".
 */

/**
 * @typedef {Object} ResultadoDePreco
 * @property {number} minimo
 * @property {number} justo
 * @property {number} ideal
 * @property {Fator[]} fatores
 * @property {Object} detalhamento
 */

const BANDAS = ['minimo', 'justo', 'ideal'];

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

/**
 * Resolve o tipo de conteudo, caindo no primeiro tipo configurado quando a
 * resposta vier vazia ou desconhecida.
 */
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

const resolverDescontoDeVolume = (quantidade, config) => {
  const degrau = config.descontoPorVolume.find((item) => quantidade >= item.minimoPecas);
  return degrau ? degrau.desconto : 0;
};

const resolverFaixaDeSeguidores = (seguidores, config) => {
  const regra = config.modificadores.postarNaPropriaConta;
  const instagram = Math.max(0, numero(seguidores?.instagram, 0));
  const tiktok = Math.max(0, numero(seguidores?.tiktok, 0));
  const total = regra.usarMaiorEntrePlataformas
    ? Math.max(instagram, tiktok)
    : instagram + tiktok;
  const faixa = regra.faixasDeSeguidores.find((item) => total <= item.ate);
  return { total, faixa: faixa || regra.faixasDeSeguidores[regra.faixasDeSeguidores.length - 1] };
};

/**
 * @param {RespostasDePrecificacao} respostas
 * @param {typeof PRICING_CONFIG} [config]
 * @returns {ResultadoDePreco}
 */
const calcularPrecoCampanha = (respostas = {}, config = PRICING_CONFIG) => {
  const { chave: tipoChave, definicao: tipo } = resolverTipoDeConteudo(respostas.tipoDeConteudo, config);
  const quantidade = resolverQuantidade(respostas.quantidade, config);
  const mods = config.modificadores;

  const viaPlataforma = Boolean(respostas.viaPlataforma);
  const negociacaoBloqueada = viaPlataforma && Boolean(mods.viaPlataforma.bloqueiaAdicionaisDeNegociacao);
  const negociacaoValida = (id) => !(negociacaoBloqueada && config.adicionaisDeNegociacao.includes(id));

  const fatores = [];

  // 1 e 2. Base por peca, dobrada se o conteudo for para anuncio pago. O tipo
  // "video para ads" ja pressupoe esse uso, entao a duplicacao vale uma vez so
  // mesmo que o usuario tambem marque anuncio pago no card seguinte.
  const ehAnuncio = Boolean(respostas.usoComoAnuncio) || Boolean(tipo.jaEhAnuncio);
  const multiplicadorAnuncio = ehAnuncio ? mods.anuncioPago.multiplicadorBase : 1;
  if (ehAnuncio) {
    fatores.push({
      id: 'anuncioPago',
      label: mods.anuncioPago.label,
      efeito: 'aumento',
      detalhe: `${mods.anuncioPago.multiplicadorBase}x o valor orgânico`
    });
  }

  // 4. Desconto por volume.
  const descontoVolume = resolverDescontoDeVolume(quantidade, config);
  if (descontoVolume > 0) {
    fatores.push({
      id: 'descontoVolume',
      label: `Pacote de ${quantidade} peças`,
      efeito: 'reducao',
      detalhe: `-${formatarPercentual(descontoVolume)}`
    });
  }

  // 5. Adicionais percentuais.
  let somaPercentual = 0;

  if (respostas.usoPerpetuo && negociacaoValida('usoPerpetuo')) {
    somaPercentual += mods.usoPerpetuo.adicionalPercentual;
    fatores.push({
      id: 'usoPerpetuo',
      label: mods.usoPerpetuo.label,
      efeito: 'aumento',
      detalhe: `+${formatarPercentual(mods.usoPerpetuo.adicionalPercentual)}`
    });
  }

  if (respostas.footageBruto && negociacaoValida('footageBruto')) {
    somaPercentual += mods.footageBruto.adicionalPercentual;
    fatores.push({
      id: 'footageBruto',
      label: mods.footageBruto.label,
      efeito: 'aumento',
      detalhe: `+${formatarPercentual(mods.footageBruto.adicionalPercentual)}`
    });
  }

  if (respostas.exclusividade && negociacaoValida('exclusividade')) {
    somaPercentual += mods.exclusividade.adicionalPercentual;
    fatores.push({
      id: 'exclusividade',
      label: mods.exclusividade.label,
      efeito: 'aumento',
      detalhe: `+${formatarPercentual(mods.exclusividade.adicionalPercentual)}`
    });
  }

  if (respostas.gravacaoPresencial && negociacaoValida('gravacaoPresencial')) {
    somaPercentual += mods.gravacaoPresencial.adicionalPercentual;
  }

  let faixaDeSeguidores = null;
  if (respostas.postaNaPropriaConta && negociacaoValida('postarNaPropriaConta')) {
    const resolvido = resolverFaixaDeSeguidores(respostas.seguidores, config);
    faixaDeSeguidores = resolvido.faixa;
    somaPercentual += faixaDeSeguidores.adicionalPercentual;
    fatores.push({
      id: 'postarNaPropriaConta',
      label: `${mods.postarNaPropriaConta.label}, ${faixaDeSeguidores.label}`,
      efeito: 'aumento',
      detalhe: `+${formatarPercentual(faixaDeSeguidores.adicionalPercentual)}`
    });
  }

  // 6. Adicionais fixos.
  let somaFixa = 0;
  if (respostas.gravacaoPresencial && negociacaoValida('gravacaoPresencial')) {
    somaFixa += mods.gravacaoPresencial.adicionalFixo;
    const percentual = mods.gravacaoPresencial.adicionalPercentual;
    const detalhes = [];
    if (mods.gravacaoPresencial.adicionalFixo > 0) detalhes.push(`+${formatarReais(mods.gravacaoPresencial.adicionalFixo)}`);
    if (percentual > 0) detalhes.push(`+${formatarPercentual(percentual)}`);
    fatores.push({
      id: 'gravacaoPresencial',
      label: mods.gravacaoPresencial.label,
      efeito: 'aumento',
      detalhe: detalhes.join(' e ')
    });
  }

  // 7. Regra de plataforma.
  const multiplicadorPlataforma = viaPlataforma ? mods.viaPlataforma.multiplicador : 1;
  if (viaPlataforma && (multiplicadorPlataforma !== 1 || negociacaoBloqueada)) {
    fatores.push({
      id: 'viaPlataforma',
      label: mods.viaPlataforma.label,
      efeito: multiplicadorPlataforma < 1 || negociacaoBloqueada ? 'reducao' : 'aumento',
      detalhe: negociacaoBloqueada ? 'valor já fechado pela plataforma' : `${multiplicadorPlataforma}x`
    });
  }

  const baseUnitaria = {};
  const valores = {};
  BANDAS.forEach((banda) => {
    const base = numero(tipo.base[banda], 0) * multiplicadorAnuncio;
    baseUnitaria[banda] = base;

    let total = base * quantidade;
    total *= 1 - descontoVolume;
    total *= 1 + somaPercentual;
    total += somaFixa;
    total *= multiplicadorPlataforma;

    valores[banda] = Math.max(0, arredondar(total, config.arredondamento));
  });

  // Garante a ordem da faixa mesmo se alguem configurar uma base fora de ordem.
  const ordenados = [valores.minimo, valores.justo, valores.ideal].sort((a, b) => a - b);

  return {
    minimo: ordenados[0],
    justo: ordenados[1],
    ideal: ordenados[2],
    fatores,
    detalhamento: {
      tipoDeConteudo: tipoChave,
      tipoLabel: tipo.label,
      quantidade,
      baseUnitaria,
      multiplicadorAnuncio,
      descontoVolume,
      adicionalPercentual: somaPercentual,
      adicionalFixo: somaFixa,
      multiplicadorPlataforma,
      negociacaoBloqueada,
      faixaDeSeguidores
    }
  };
};

export { calcularPrecoCampanha, formatarReais, formatarPercentual };
