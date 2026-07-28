import test from 'node:test';
import assert from 'node:assert/strict';

// A query de versao acompanha a que calculator.js usa, para o teste enxergar
// exatamente a mesma instancia de config que o app carrega no browser.
import { calcularPrecoCampanha } from './calculator.js';
import { PRICING_CONFIG } from './config.js?v=20260728a';

/**
 * Respostas de um usuario que so produz video, sem nenhum extra. Serve de base
 * para os testes sobrescreverem apenas o que importa em cada cenario.
 */
const respostasBase = {
  postaNaPropriaConta: false,
  tipoDeConteudo: 'video_tiktok',
  quantidade: 1,
  usoComoAnuncio: false,
  usoPerpetuo: false,
  seguidores: { instagram: 0, tiktok: 0 },
  exclusividade: false,
  footageBruto: false,
  gravacaoPresencial: false,
  viaPlataforma: false
};

const responder = (extra = {}) => ({ ...respostasBase, ...extra });

const idsDosFatores = (resultado) => resultado.fatores.map((fator) => fator.id);

test('so producao, sem extras, devolve a faixa base do video', () => {
  const resultado = calcularPrecoCampanha(responder());
  assert.deepEqual(
    { minimo: resultado.minimo, justo: resultado.justo, ideal: resultado.ideal },
    { minimo: 200, justo: 250, ideal: 300 }
  );
  assert.deepEqual(resultado.fatores, []);
});

test('producao com ads e footage bruto compoe dobro, desconto de volume e 30%', () => {
  const resultado = calcularPrecoCampanha(responder({
    quantidade: 3,
    usoComoAnuncio: true,
    footageBruto: true
  }));

  // 200x2 = 400 por peca, x3 = 1200, -10% = 1080, +30% = 1404, arredondado.
  assert.equal(resultado.minimo, 1400);
  assert.equal(resultado.justo, 1760);
  assert.equal(resultado.ideal, 2110);
  assert.deepEqual(idsDosFatores(resultado), ['anuncioPago', 'descontoVolume', 'footageBruto']);
});

test('postagem na conta propria com exclusividade soma faixa de seguidores e 10%', () => {
  const resultado = calcularPrecoCampanha(responder({
    tipoDeConteudo: 'reels_stories',
    postaNaPropriaConta: true,
    seguidores: { instagram: 25000, tiktok: 8000 },
    exclusividade: true
  }));

  // 200 x (1 + 0.40 + 0.10) = 300.
  assert.equal(resultado.minimo, 300);
  assert.equal(resultado.justo, 380);
  assert.equal(resultado.ideal, 450);
  assert.deepEqual(idsDosFatores(resultado), ['exclusividade', 'postarNaPropriaConta']);
});

test('foto UGC usa a faixa propria, do piso simples ao teto profissional', () => {
  const resultado = calcularPrecoCampanha(responder({ tipoDeConteudo: 'foto_ugc' }));
  assert.deepEqual(
    { minimo: resultado.minimo, justo: resultado.justo, ideal: resultado.ideal },
    { minimo: 40, justo: 60, ideal: 100 }
  );
});

test('desconto por volume vale o maior degrau que couber', () => {
  const duas = calcularPrecoCampanha(responder({ quantidade: 2 }));
  const tres = calcularPrecoCampanha(responder({ quantidade: 3 }));
  const quatro = calcularPrecoCampanha(responder({ quantidade: 4 }));
  const cinco = calcularPrecoCampanha(responder({ quantidade: 5 }));

  assert.equal(duas.detalhamento.descontoVolume, 0);
  assert.equal(tres.detalhamento.descontoVolume, 0.1);
  assert.equal(quatro.detalhamento.descontoVolume, 0.1);
  assert.equal(cinco.detalhamento.descontoVolume, 0.15);

  assert.equal(duas.minimo, 400);
  assert.equal(tres.minimo, 540);
  assert.equal(cinco.minimo, 850);
});

test('tipo video para ads ja dobra sozinho e nao dobra duas vezes', () => {
  const semMarcar = calcularPrecoCampanha(responder({ tipoDeConteudo: 'video_ads' }));
  const marcando = calcularPrecoCampanha(responder({ tipoDeConteudo: 'video_ads', usoComoAnuncio: true }));

  assert.equal(semMarcar.minimo, 400);
  assert.equal(marcando.minimo, 400);
  assert.equal(marcando.detalhamento.multiplicadorAnuncio, 2);
});

test('uso perpetuo soma o adicional configurado', () => {
  const resultado = calcularPrecoCampanha(responder({ usoPerpetuo: true }));
  assert.equal(resultado.detalhamento.adicionalPercentual, PRICING_CONFIG.modificadores.usoPerpetuo.adicionalPercentual);
  assert.equal(resultado.minimo, 220);
});

test('gravacao presencial entra como adicional fixo depois do percentual', () => {
  const resultado = calcularPrecoCampanha(responder({ gravacaoPresencial: true }));
  assert.equal(resultado.detalhamento.adicionalFixo, 150);
  assert.equal(resultado.minimo, 350);
  assert.ok(idsDosFatores(resultado).includes('gravacaoPresencial'));
});

test('faixa de seguidores usa a maior entre Instagram e TikTok', () => {
  const resultado = calcularPrecoCampanha(responder({
    postaNaPropriaConta: true,
    seguidores: { instagram: 3000, tiktok: 120000 }
  }));
  assert.equal(resultado.detalhamento.faixaDeSeguidores.ate, 200000);
  assert.equal(resultado.detalhamento.adicionalPercentual, 0.7);
});

test('sem postar na propria conta os seguidores sao ignorados', () => {
  const resultado = calcularPrecoCampanha(responder({
    postaNaPropriaConta: false,
    seguidores: { instagram: 500000, tiktok: 500000 }
  }));
  assert.equal(resultado.detalhamento.adicionalPercentual, 0);
  assert.equal(resultado.minimo, 200);
});

test('via plataforma hoje e neutro e nao cria fator', () => {
  const resultado = calcularPrecoCampanha(responder({ viaPlataforma: true }));
  assert.equal(resultado.minimo, 200);
  assert.equal(idsDosFatores(resultado).includes('viaPlataforma'), false);
});

test('ligar o bloqueio de plataforma no config derruba os adicionais de negociacao sem tocar na logica', () => {
  const config = structuredClone(PRICING_CONFIG);
  config.modificadores.viaPlataforma.bloqueiaAdicionaisDeNegociacao = true;

  const respostas = responder({
    viaPlataforma: true,
    usoPerpetuo: true,
    exclusividade: true,
    gravacaoPresencial: true,
    footageBruto: true,
    postaNaPropriaConta: true,
    seguidores: { instagram: 300000, tiktok: 0 }
  });

  const resultado = calcularPrecoCampanha(respostas, config);

  // Footage sobrevive porque e escopo de entrega, nao termo de negociacao.
  assert.equal(resultado.detalhamento.adicionalPercentual, config.modificadores.footageBruto.adicionalPercentual);
  assert.equal(resultado.detalhamento.adicionalFixo, 0);
  assert.equal(resultado.minimo, 260);
  assert.ok(idsDosFatores(resultado).includes('viaPlataforma'));
});

test('trocar um peso no config muda o resultado sem alterar o calculo', () => {
  const config = structuredClone(PRICING_CONFIG);
  config.modificadores.exclusividade.adicionalPercentual = 0.5;

  const padrao = calcularPrecoCampanha(responder({ exclusividade: true }));
  const ajustado = calcularPrecoCampanha(responder({ exclusividade: true }), config);

  assert.equal(padrao.minimo, 220);
  assert.equal(ajustado.minimo, 300);
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
    responder({ tipoDeConteudo: 'foto_ugc', quantidade: 10, exclusividade: true }),
    responder({ postaNaPropriaConta: true, seguidores: { instagram: 900000 }, gravacaoPresencial: true })
  ];

  combinacoes.forEach((respostas) => {
    const resultado = calcularPrecoCampanha(respostas);
    assert.ok(resultado.minimo <= resultado.justo, 'minimo deve ser menor ou igual ao justo');
    assert.ok(resultado.justo <= resultado.ideal, 'justo deve ser menor ou igual ao ideal');
  });
});
