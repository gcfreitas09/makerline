import test from 'node:test';
import assert from 'node:assert/strict';

import { calcularPrecoCampanha } from './calculator.js';
import { PRICING_CONFIG } from './config.js?v=20260728p';

/**
 * Respostas de uma criadora iniciante que so produz video, sem nenhum extra.
 * Serve de base para os testes sobrescreverem apenas o que importa em cada
 * cenario.
 */
const respostasBase = {
  nivelDeExperiencia: 'iniciante',
  postaNaPropriaConta: false,
  tipoDeConteudo: 'video_tiktok',
  quantidade: 1,
  usoComoAnuncio: false,
  usoPerpetuo: false,
  redeDePostagem: 'instagram',
  seguidores: 0,
  exclusividade: false,
  duracaoExclusividade: '',
  footageBruto: false,
  viaPlataforma: false
};

const responder = (extra = {}) => ({ ...respostasBase, ...extra });

const idsDosFatores = (resultado) => resultado.fatores.map((fator) => fator.id);

const faixa = (resultado) => ({
  minimo: resultado.minimo,
  justo: resultado.justo,
  ideal: resultado.ideal
});

/* ── base por nivel ─────────────────────────────────────────── */

test('so producao, sem extras, devolve a faixa base do nivel', () => {
  const resultado = calcularPrecoCampanha(responder());
  // Iniciante, video: 200 a 250. O justo e o meio da faixa.
  assert.deepEqual(faixa(resultado), { minimo: 200, justo: 230, ideal: 250 });
  assert.deepEqual(resultado.fatores, []);
});

test('cada nivel tem sua propria base, para video e para foto', () => {
  const video = (nivel) => faixa(calcularPrecoCampanha(responder({ nivelDeExperiencia: nivel })));
  const foto = (nivel) => faixa(calcularPrecoCampanha(responder({ nivelDeExperiencia: nivel, tipoDeConteudo: 'foto_ugc' })));

  assert.deepEqual(video('iniciante'), { minimo: 200, justo: 230, ideal: 250 });
  assert.deepEqual(video('intermediario'), { minimo: 500, justo: 530, ideal: 550 });
  assert.deepEqual(video('avancado'), { minimo: 700, justo: 750, ideal: 800 });

  assert.deepEqual(foto('iniciante'), { minimo: 40, justo: 50, ideal: 50 });
  assert.deepEqual(foto('intermediario'), { minimo: 60, justo: 70, ideal: 80 });
  assert.deepEqual(foto('avancado'), { minimo: 90, justo: 100, ideal: 100 });
});

test('nivel ausente ou desconhecido cai no padrao configurado', () => {
  assert.equal(calcularPrecoCampanha({}).detalhamento.nivelDeExperiencia, PRICING_CONFIG.nivelPadrao);
  assert.equal(
    calcularPrecoCampanha(responder({ nivelDeExperiencia: 'lenda' })).detalhamento.nivelDeExperiencia,
    PRICING_CONFIG.nivelPadrao
  );
});

/* ── os tres cenarios de sempre ─────────────────────────────── */

test('producao com ads e footage bruto compoe a cadeia e o desconto de pacote', () => {
  const resultado = calcularPrecoCampanha(responder({
    quantidade: 3,
    usoComoAnuncio: true,
    footageBruto: true
  }));

  // Minimo: 200 x1.3 (ads) x1.3 (footage) = 338 por peca, x3 = 1014, -10% = 912,6.
  assert.equal(resultado.minimo, 910);
  // Ideal: 250 x1.5 x1.3 = 487,5 por peca, x3 = 1462,5, -10% = 1316,25.
  assert.equal(resultado.ideal, 1320);
  assert.equal(resultado.justo, 1120);
  assert.deepEqual(idsDosFatores(resultado), ['anuncioPago', 'footageBruto', 'descontoPacote']);
});

test('postagem na conta propria com exclusividade multiplica em cadeia', () => {
  const resultado = calcularPrecoCampanha(responder({
    tipoDeConteudo: 'reels_stories',
    postaNaPropriaConta: true,
    redeDePostagem: 'instagram',
    seguidores: 25000,
    exclusividade: true,
    duracaoExclusividade: 'um_mes'
  }));

  // 200 x1.1 (1 mes) x1.3 (10 a 50 mil) = 286.
  assert.equal(resultado.minimo, 290);
  // 250 x1.1 x1.3 = 357,5.
  assert.equal(resultado.ideal, 360);
  assert.deepEqual(idsDosFatores(resultado), ['exclusividade', 'postarNaPropriaConta']);
});

test('cenario novo: video intermediario com ads, exclusividade de 3 meses e uso perpetuo', () => {
  const resultado = calcularPrecoCampanha(responder({
    nivelDeExperiencia: 'intermediario',
    usoComoAnuncio: true,
    exclusividade: true,
    duracaoExclusividade: 'tres_meses',
    usoPerpetuo: true
  }));

  // Minimo: 500 x1.3 = 650, x1.3 (3 meses) = 845, x1.5 (perpetuo) = 1267,5.
  assert.equal(resultado.minimo, 1270);
  // Ideal: 550 x1.5 = 825, x1.3 = 1072,5, x1.5 = 1608,75.
  assert.equal(resultado.ideal, 1610);
  assert.equal(resultado.justo, 1440);

  // A ordem da cadeia e o que garante esses numeros.
  assert.deepEqual(resultado.detalhamento.cadeia, ['anuncioPago', 'exclusividade', 'usoPerpetuo']);
  assert.equal(resultado.detalhamento.mesesDeExclusividade, 3);
});

/* ── cadeia ─────────────────────────────────────────────────── */

test('a cadeia aplica cada modificador sobre o resultado do anterior, nao sobre a base', () => {
  const emCadeia = calcularPrecoCampanha(responder({
    usoComoAnuncio: true,
    usoPerpetuo: true
  }));

  // Em cadeia: 200 x1.3 x1.5 = 390. Se fosse soma de percentuais sobre a base,
  // daria 200 x (1 + 0.3 + 0.5) = 360.
  assert.equal(emCadeia.minimo, 390);
  assert.notEqual(emCadeia.minimo, 360);
});

test('exclusividade cobra 10% por mes de duracao', () => {
  const meses = (duracao) => calcularPrecoCampanha(responder({ exclusividade: true, duracaoExclusividade: duracao })).minimo;

  assert.equal(meses('um_mes'), 220); // 200 x1.1
  assert.equal(meses('tres_meses'), 260); // 200 x1.3
  assert.equal(meses('seis_meses'), 320); // 200 x1.6
  assert.equal(meses('mais_de_seis'), 440); // 200 x2.2, "mais de 6" conta 12 meses
});

test('uso perpetuo acrescenta metade do valor acumulado ate ele', () => {
  const semPerpetuo = calcularPrecoCampanha(responder({ usoComoAnuncio: true }));
  const comPerpetuo = calcularPrecoCampanha(responder({ usoComoAnuncio: true, usoPerpetuo: true }));
  assert.equal(comPerpetuo.minimo, semPerpetuo.minimo * 1.5);
  assert.equal(PRICING_CONFIG.modificadores.usoPerpetuo.adicionalPercentual, 0.5);
});

/* ── seguidores ─────────────────────────────────────────────── */

test('o adicional de seguidores sai da rede escolhida, sem somar as duas', () => {
  const noTikTok = calcularPrecoCampanha(responder({
    postaNaPropriaConta: true,
    redeDePostagem: 'tiktok',
    seguidores: { instagram: 300000, tiktok: 4000 }
  }));

  // Vale a faixa do TikTok (4 mil, +20%), nao a do Instagram nem a soma.
  assert.equal(noTikTok.detalhamento.seguidores.rede, 'tiktok');
  assert.equal(noTikTok.detalhamento.seguidores.total, 4000);
  assert.equal(noTikTok.minimo, 240); // 200 x1.2
});

test('as tres faixas de seguidores valem 20%, 30% e 40%', () => {
  const comSeguidores = (quantos) => calcularPrecoCampanha(responder({
    postaNaPropriaConta: true,
    seguidores: quantos
  }));

  assert.equal(comSeguidores(5000).detalhamento.adicionais.postarNaPropriaConta.minimo, 0.2);
  assert.equal(comSeguidores(30000).detalhamento.adicionais.postarNaPropriaConta.minimo, 0.3);
  assert.equal(comSeguidores(80000).detalhamento.adicionais.postarNaPropriaConta.minimo, 0.4);
});

test('sem postar na propria conta os seguidores sao ignorados', () => {
  const resultado = calcularPrecoCampanha(responder({
    postaNaPropriaConta: false,
    seguidores: 500000
  }));
  assert.equal(resultado.detalhamento.seguidores, null);
  assert.equal(resultado.minimo, 200);
});

/* ── pacote ─────────────────────────────────────────────────── */

test('desconto por pacote vale o maior degrau que couber, sobre o total', () => {
  const pecas = (quantidade) => calcularPrecoCampanha(responder({ quantidade }));

  assert.equal(pecas(2).detalhamento.descontoPacote, 0);
  assert.equal(pecas(3).detalhamento.descontoPacote, 0.1);
  assert.equal(pecas(4).detalhamento.descontoPacote, 0.1);
  assert.equal(pecas(5).detalhamento.descontoPacote, 0.15);

  assert.equal(pecas(2).minimo, 400);
  assert.equal(pecas(3).minimo, 540); // 600 -10%
  assert.equal(pecas(5).minimo, 850); // 1000 -15%
});

/* ── configuracao ───────────────────────────────────────────── */

test('gravacao presencial saiu da precificacao e nao altera mais o valor', () => {
  const semCampo = calcularPrecoCampanha(responder());
  const comCampoAntigo = calcularPrecoCampanha(responder({ gravacaoPresencial: true }));

  assert.equal(comCampoAntigo.minimo, semCampo.minimo);
  assert.equal(idsDosFatores(comCampoAntigo).includes('gravacaoPresencial'), false);
  assert.equal(PRICING_CONFIG.modificadores.gravacaoPresencial, undefined);
});

test('trocar um peso no config muda o resultado sem alterar o calculo', () => {
  const config = structuredClone(PRICING_CONFIG);
  config.modificadores.exclusividade.adicionalPercentualPorMes = 0.2;

  const padrao = calcularPrecoCampanha(responder({ exclusividade: true, duracaoExclusividade: 'tres_meses' }));
  const ajustado = calcularPrecoCampanha(responder({ exclusividade: true, duracaoExclusividade: 'tres_meses' }), config);

  assert.equal(padrao.minimo, 260); // 200 x1.3
  assert.equal(ajustado.minimo, 320); // 200 x1.6
});

test('ligar o bloqueio de plataforma no config derruba os adicionais de negociacao sem tocar na logica', () => {
  const config = structuredClone(PRICING_CONFIG);
  config.modificadores.viaPlataforma.bloqueiaAdicionaisDeNegociacao = true;

  const respostas = responder({
    viaPlataforma: true,
    usoPerpetuo: true,
    exclusividade: true,
    duracaoExclusividade: 'seis_meses',
    footageBruto: true,
    postaNaPropriaConta: true,
    seguidores: 300000
  });

  const resultado = calcularPrecoCampanha(respostas, config);

  // Footage sobrevive porque e escopo de entrega, nao termo de negociacao.
  assert.deepEqual(resultado.detalhamento.cadeia, ['footageBruto']);
  assert.equal(resultado.minimo, 260); // 200 x1.3
  assert.ok(idsDosFatores(resultado).includes('viaPlataforma'));
});

test('quantidade fora do intervalo e normalizada', () => {
  assert.equal(calcularPrecoCampanha(responder({ quantidade: 0 })).detalhamento.quantidade, 1);
  assert.equal(calcularPrecoCampanha(responder({ quantidade: -5 })).detalhamento.quantidade, 1);
  assert.equal(calcularPrecoCampanha(responder({ quantidade: 999 })).detalhamento.quantidade, PRICING_CONFIG.quantidade.maximo);
  assert.equal(calcularPrecoCampanha(responder({ quantidade: '4' })).detalhamento.quantidade, 4);
});

test('tipo de conteudo desconhecido cai no primeiro configurado', () => {
  const resultado = calcularPrecoCampanha(responder({ tipoDeConteudo: 'nao_existe' }));
  assert.equal(resultado.detalhamento.tipoDeConteudo, Object.keys(PRICING_CONFIG.tiposDeConteudo)[0]);
});

test('a faixa devolvida sempre respeita minimo, justo e ideal', () => {
  const combinacoes = [
    responder({ quantidade: 5, usoComoAnuncio: true, footageBruto: true, usoPerpetuo: true }),
    responder({ nivelDeExperiencia: 'avancado', tipoDeConteudo: 'foto_ugc', quantidade: 10, exclusividade: true, duracaoExclusividade: 'mais_de_seis' }),
    responder({ nivelDeExperiencia: 'intermediario', postaNaPropriaConta: true, seguidores: 900000 })
  ];

  combinacoes.forEach((respostas) => {
    const resultado = calcularPrecoCampanha(respostas);
    assert.ok(resultado.minimo <= resultado.justo, 'minimo deve ser menor ou igual ao justo');
    assert.ok(resultado.justo <= resultado.ideal, 'justo deve ser menor ou igual ao ideal');
  });
});
