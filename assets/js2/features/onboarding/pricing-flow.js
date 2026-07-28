import { state, saveState } from '../../core/state.js';
import { renderAll } from '../../core/renderers.js?v=20260429d';
import { setActivePage } from '../../core/ui.js?v=20260304b';
import { PRICING_CONFIG } from '../../core/pricing/config.js?v=20260728a';
import { calcularPrecoCampanha, formatarReais } from '../../core/pricing/calculator.js?v=20260728a';

/**
 * Fluxo de descoberta de preco do onboarding, ramo "tenho campanha ativa".
 *
 * A UI aqui e so apresentacao: todo numero vem de core/pricing. Se um peso
 * mudar no config, nada neste arquivo precisa mudar.
 */

const SIM_NAO = [
  { valor: true, label: 'Sim' },
  { valor: false, label: 'Não' }
];

const CARDS = [
  {
    id: 'intro',
    tipo: 'intro',
    titulo: 'Vamos descobrir o valor justo da sua campanha',
    subtitulo: 'Isso leva menos de 1 minuto.'
  },
  {
    id: 'postaNaPropriaConta',
    tipo: 'escolha',
    pergunta: 'A marca pediu pra você postar o conteúdo na sua própria conta, ou é só produção de vídeo pra marca usar?',
    opcoes: [
      { valor: true, label: 'Vou postar na minha conta' },
      { valor: false, label: 'Só produção, a marca usa por conta dela' }
    ]
  },
  {
    id: 'tipoDeConteudo',
    tipo: 'escolha',
    pergunta: 'Que tipo de conteúdo é?',
    // Vem do config para nao duplicar a lista de tipos em dois lugares.
    opcoes: Object.entries(PRICING_CONFIG.tiposDeConteudo).map(([chave, definicao]) => ({
      valor: chave,
      label: definicao.label
    }))
  },
  {
    id: 'quantidade',
    tipo: 'numero',
    pergunta: 'Quantos vídeos ou peças a marca pediu?'
  },
  {
    id: 'usoComoAnuncio',
    tipo: 'escolha',
    pergunta: 'A marca vai usar esse conteúdo como anúncio pago, ou só postagem orgânica?',
    opcoes: [
      { valor: true, label: 'Anúncio pago' },
      { valor: false, label: 'Só orgânico' }
    ]
  },
  {
    id: 'usoPerpetuo',
    tipo: 'escolha',
    pergunta: 'Por quanto tempo a marca pode usar o conteúdo?',
    opcoes: [
      { valor: false, label: 'Tempo limitado, por exemplo 3 meses' },
      { valor: true, label: 'Uso perpétuo, sem prazo' }
    ]
  },
  {
    id: 'seguidores',
    tipo: 'seguidores',
    pergunta: 'Quantos seguidores você tem?',
    condicao: (respostas) => respostas.postaNaPropriaConta === true
  },
  {
    id: 'exclusividade',
    tipo: 'escolha',
    pergunta: 'A marca pediu exclusividade, ou seja, não trabalhar com marcas concorrentes por um período?',
    opcoes: SIM_NAO
  },
  {
    id: 'footageBruto',
    tipo: 'escolha',
    pergunta: 'A marca pediu o material bruto sem edição?',
    opcoes: SIM_NAO
  },
  {
    id: 'gravacaoPresencial',
    tipo: 'escolha',
    pergunta: 'Essa campanha exige gravação presencial ou deslocamento?',
    opcoes: SIM_NAO
  },
  {
    id: 'viaPlataforma',
    tipo: 'escolha',
    pergunta: 'É uma campanha fechada direto com a marca, ou através de alguma plataforma de UGC?',
    opcoes: [
      { valor: false, label: 'Direto com a marca' },
      { valor: true, label: 'Através de plataforma' }
    ]
  },
  {
    id: 'resultado',
    tipo: 'resultado'
  }
];

/* ── estado do fluxo ────────────────────────────────────────── */

const respostasPadrao = () => ({
  postaNaPropriaConta: null,
  tipoDeConteudo: null,
  quantidade: PRICING_CONFIG.quantidade.padrao,
  usoComoAnuncio: null,
  usoPerpetuo: null,
  seguidores: { instagram: null, tiktok: null },
  exclusividade: null,
  footageBruto: null,
  gravacaoPresencial: null,
  viaPlataforma: null
});

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
  if (!pricing.respostas.seguidores || typeof pricing.respostas.seguidores !== 'object') {
    pricing.respostas.seguidores = { instagram: null, tiktok: null };
  }
  if (typeof pricing.concluido !== 'boolean') pricing.concluido = false;
  return pricing;
};

const getOverlay = () => document.getElementById('pricing-quiz');
const getStage = () => document.getElementById('pricing-stage');

/** Cards que valem para as respostas atuais, ja sem o card condicional oculto. */
const cardsVisiveis = (respostas) => CARDS.filter((card) => !card.condicao || card.condicao(respostas));

const indiceDoCard = (cardId, respostas) => {
  const visiveis = cardsVisiveis(respostas);
  const indice = visiveis.findIndex((card) => card.id === cardId);
  return indice >= 0 ? indice : 0;
};

/** Uma pergunta so esta respondida quando tem valor util, e nao apenas nao-nulo. */
const cardRespondido = (card, respostas) => {
  if (card.tipo === 'intro' || card.tipo === 'resultado') return true;
  if (card.tipo === 'numero') return Number(respostas.quantidade) >= PRICING_CONFIG.quantidade.minimo;
  if (card.tipo === 'seguidores') {
    const { instagram, tiktok } = respostas.seguidores || {};
    return Number.isFinite(Number(instagram)) || Number.isFinite(Number(tiktok));
  }
  return respostas[card.id] !== null && respostas[card.id] !== undefined;
};

/* ── render ─────────────────────────────────────────────────── */

const renderProgresso = (indice, total) => {
  if (total <= 0) return '';
  const percentual = Math.round((indice / total) * 100);
  return `
    <div class="pricing-progress">
      <div class="pricing-progress-track"><div class="pricing-progress-fill" style="width:${percentual}%"></div></div>
      <span class="pricing-progress-label">${indice} de ${total}</span>
    </div>
  `;
};

const renderVoltar = (podeVoltar) => (podeVoltar
  ? '<button class="pricing-back" data-action="pricing-back" type="button" aria-label="Voltar">&larr;</button>'
  : '<span class="pricing-back-spacer"></span>');

const renderIntro = (card) => `
  <div class="quiz-card pricing-card">
    <div class="quiz-icon">
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="19" stroke="currentColor" stroke-width="2.5"/>
        <path d="M24 14v20M29 19c0-2.2-2.2-3.5-5-3.5s-5 1.3-5 3.5 2.2 3.2 5 3.9 5 1.7 5 3.9-2.2 3.5-5 3.5-5-1.3-5-3.5" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    </div>
    <h2 class="quiz-title">${card.titulo}</h2>
    <p class="quiz-sub">${card.subtitulo}</p>
    <button class="btn btn-primary quiz-cta" data-action="pricing-start" type="button">Começar</button>
    <button class="btn btn-ghost quiz-cta-secondary" data-action="pricing-skip" type="button">Pular por agora</button>
  </div>
`;

const renderEscolha = (card, respostas, indice, total) => {
  const selecionada = respostas[card.id];
  const opcoes = card.opcoes.map((opcao) => {
    const ativa = selecionada !== null && selecionada !== undefined && String(selecionada) === String(opcao.valor);
    return `
      <button class="quiz-option${ativa ? ' is-selected' : ''}" type="button"
              data-action="pricing-select" data-field="${card.id}" data-value="${opcao.valor}">
        ${opcao.label}
      </button>
    `;
  }).join('');

  return `
    <div class="quiz-card pricing-card">
      ${renderVoltar(true)}
      ${renderProgresso(indice, total)}
      <h2 class="quiz-title pricing-question">${card.pergunta}</h2>
      <div class="quiz-options pricing-options">${opcoes}</div>
      <button class="btn btn-primary quiz-cta" data-action="pricing-next" type="button"
              ${cardRespondido(card, respostas) ? '' : 'disabled'}>Continuar</button>
    </div>
  `;
};

const renderNumero = (card, respostas, indice, total) => `
  <div class="quiz-card pricing-card">
    ${renderVoltar(true)}
    ${renderProgresso(indice, total)}
    <h2 class="quiz-title pricing-question">${card.pergunta}</h2>
    <div class="pricing-field">
      <input class="input pricing-input" type="number" inputmode="numeric"
             min="${PRICING_CONFIG.quantidade.minimo}" max="${PRICING_CONFIG.quantidade.maximo}" step="1"
             data-pricing-input="quantidade" value="${Number(respostas.quantidade) || PRICING_CONFIG.quantidade.padrao}" />
    </div>
    <button class="btn btn-primary quiz-cta" data-action="pricing-next" type="button">Continuar</button>
  </div>
`;

const renderSeguidores = (card, respostas, indice, total) => {
  const instagram = Number.isFinite(Number(respostas.seguidores?.instagram)) ? respostas.seguidores.instagram : '';
  const tiktok = Number.isFinite(Number(respostas.seguidores?.tiktok)) ? respostas.seguidores.tiktok : '';
  return `
    <div class="quiz-card pricing-card">
      ${renderVoltar(true)}
      ${renderProgresso(indice, total)}
      <h2 class="quiz-title pricing-question">${card.pergunta}</h2>
      <div class="pricing-field pricing-field--split">
        <label class="pricing-label">
          <span>Instagram</span>
          <input class="input pricing-input" type="number" inputmode="numeric" min="0" step="1"
                 data-pricing-input="seguidores.instagram" value="${instagram}" placeholder="0" />
        </label>
        <label class="pricing-label">
          <span>TikTok</span>
          <input class="input pricing-input" type="number" inputmode="numeric" min="0" step="1"
                 data-pricing-input="seguidores.tiktok" value="${tiktok}" placeholder="0" />
        </label>
      </div>
      <button class="btn btn-primary quiz-cta" data-action="pricing-next" type="button">Continuar</button>
    </div>
  `;
};

const renderResultado = (respostas) => {
  const resultado = calcularPrecoCampanha(respostas);

  const aumentos = resultado.fatores.filter((fator) => fator.efeito === 'aumento');
  const reducoes = resultado.fatores.filter((fator) => fator.efeito === 'reducao');

  const listaDeFatores = (titulo, fatores, modificador) => {
    if (!fatores.length) return '';
    return `
      <div class="pricing-factors-group pricing-factors-group--${modificador}">
        <p class="pricing-factors-title">${titulo}</p>
        <ul class="pricing-factors-list">
          ${fatores.map((fator) => `<li><span>${fator.label}</span><strong>${fator.detalhe}</strong></li>`).join('')}
        </ul>
      </div>
    `;
  };

  const semFatores = !resultado.fatores.length
    ? '<p class="pricing-factors-empty">Nenhum adicional ou desconto entrou nessa conta, esse é o valor de referência da entrega.</p>'
    : '';

  return `
    <div class="quiz-card pricing-card pricing-card--result">
      ${renderVoltar(true)}
      <h2 class="quiz-title">Valor sugerido pra essa campanha</h2>

      <div class="pricing-range">
        <div class="pricing-range-item">
          <span class="pricing-range-label">Mínimo</span>
          <strong class="pricing-range-value">${formatarReais(resultado.minimo)}</strong>
        </div>
        <div class="pricing-range-item is-highlight">
          <span class="pricing-range-label">Justo</span>
          <strong class="pricing-range-value">${formatarReais(resultado.justo)}</strong>
        </div>
        <div class="pricing-range-item">
          <span class="pricing-range-label">Ideal</span>
          <strong class="pricing-range-value">${formatarReais(resultado.ideal)}</strong>
        </div>
      </div>

      <div class="pricing-factors">
        ${listaDeFatores('Aumentou o valor', aumentos, 'up')}
        ${listaDeFatores('Reduziu o valor', reducoes, 'down')}
        ${semFatores}
      </div>

      <button class="btn btn-primary quiz-cta" data-action="pricing-register-campaign" type="button">Registrar essa campanha agora</button>
      <button class="btn btn-ghost quiz-cta-secondary" data-action="pricing-skip" type="button">Agora não</button>
    </div>
  `;
};

const render = () => {
  const stage = getStage();
  if (!stage) return;

  const pricing = ensurePricingState();
  const respostas = pricing.respostas;
  const visiveis = cardsVisiveis(respostas);
  const indice = indiceDoCard(pricing.cardId, respostas);
  const card = visiveis[indice];
  const totalDePerguntas = visiveis.filter((item) => item.tipo !== 'intro' && item.tipo !== 'resultado').length;

  let html = '';
  if (card.tipo === 'intro') html = renderIntro(card);
  else if (card.tipo === 'escolha') html = renderEscolha(card, respostas, indice, totalDePerguntas);
  else if (card.tipo === 'numero') html = renderNumero(card, respostas, indice, totalDePerguntas);
  else if (card.tipo === 'seguidores') html = renderSeguidores(card, respostas, indice, totalDePerguntas);
  else if (card.tipo === 'resultado') html = renderResultado(respostas);

  stage.innerHTML = html;
  stage.querySelector('.pricing-input')?.focus();
};

/* ── navegacao ──────────────────────────────────────────────── */

const irPara = (indiceAlvo) => {
  const pricing = ensurePricingState();
  const visiveis = cardsVisiveis(pricing.respostas);
  const alvo = Math.max(0, Math.min(visiveis.length - 1, indiceAlvo));
  pricing.cardId = visiveis[alvo].id;
  saveState();
  render();
};

/**
 * Le os campos numericos do card atual antes de sair dele, senao o que o
 * usuario digitou se perde ao avancar ou voltar.
 */
const capturarCamposNumericos = () => {
  const stage = getStage();
  if (!stage) return;
  const pricing = ensurePricingState();

  stage.querySelectorAll('[data-pricing-input]').forEach((input) => {
    const campo = input.dataset.pricingInput;
    const bruto = String(input.value || '').trim();
    const valor = bruto === '' ? null : Math.max(0, Math.round(Number(bruto) || 0));

    if (campo === 'quantidade') {
      pricing.respostas.quantidade = valor === null
        ? PRICING_CONFIG.quantidade.padrao
        : Math.max(PRICING_CONFIG.quantidade.minimo, Math.min(PRICING_CONFIG.quantidade.maximo, valor));
      return;
    }
    if (campo === 'seguidores.instagram') pricing.respostas.seguidores.instagram = valor;
    if (campo === 'seguidores.tiktok') pricing.respostas.seguidores.tiktok = valor;
  });
};

const abrirFluxoDePrecificacao = () => {
  const overlay = getOverlay();
  if (!overlay) return false;
  overlay.classList.add('open');
  render();
  return true;
};

const fecharFluxoDePrecificacao = () => {
  const overlay = getOverlay();
  if (overlay) overlay.classList.remove('open');
};

/**
 * Encerra o onboarding e leva pro fluxo de registro guiado de campanha, com os
 * campos que se sobrepoem ja preenchidos.
 */
const registrarCampanha = () => {
  const pricing = ensurePricingState();
  const resultado = calcularPrecoCampanha(pricing.respostas);
  const definicao = PRICING_CONFIG.tiposDeConteudo[resultado.detalhamento.tipoDeConteudo];
  const ehFoto = resultado.detalhamento.tipoDeConteudo === 'foto_ugc';

  // Mesmo padrao de state.ui.pendingCampaignBrandId: o modal consome e limpa.
  state.ui.pendingCampaignPrefill = {
    value: resultado.justo,
    photoCount: ehFoto ? resultado.detalhamento.quantidade : null,
    videoCount: ehFoto ? null : resultado.detalhamento.quantidade,
    contentType: resultado.detalhamento.tipoDeConteudo,
    contentTypeLabel: definicao ? definicao.label : ''
  };

  pricing.concluido = true;
  pricing.resultado = { minimo: resultado.minimo, justo: resultado.justo, ideal: resultado.ideal };
  state.progress.onboarding.quizDone = true;
  saveState();

  fecharFluxoDePrecificacao();
  renderAll();
  setActivePage('campaigns');

  setTimeout(() => {
    const abrirModal = window.__ugcModals?.openCampaignModal;
    if (typeof abrirModal === 'function') {
      abrirModal();
      return;
    }
    document.querySelector('.page-section[data-section="campaigns"] [data-action="new-campaign"]')?.click();
  }, 180);
};

/* ── acoes ──────────────────────────────────────────────────── */

const handlePricingFlowAction = (action, el) => {
  if (action === 'pricing-start') {
    irPara(1);
    return true;
  }

  if (action === 'pricing-select') {
    const pricing = ensurePricingState();
    const campo = el.dataset.field;
    const bruto = el.dataset.value;
    pricing.respostas[campo] = bruto === 'true' ? true : bruto === 'false' ? false : bruto;
    saveState();
    render();
    return true;
  }

  if (action === 'pricing-next') {
    capturarCamposNumericos();
    const pricing = ensurePricingState();
    irPara(indiceDoCard(pricing.cardId, pricing.respostas) + 1);
    return true;
  }

  if (action === 'pricing-back') {
    capturarCamposNumericos();
    const pricing = ensurePricingState();
    irPara(indiceDoCard(pricing.cardId, pricing.respostas) - 1);
    return true;
  }

  if (action === 'pricing-register-campaign') {
    registrarCampanha();
    return true;
  }

  if (action === 'pricing-skip') {
    const pricing = ensurePricingState();
    state.progress.onboarding.quizDone = true;
    pricing.concluido = true;
    saveState();
    fecharFluxoDePrecificacao();
    renderAll();
    return true;
  }

  return false;
};

export { abrirFluxoDePrecificacao, fecharFluxoDePrecificacao, handlePricingFlowAction, ensurePricingState };
