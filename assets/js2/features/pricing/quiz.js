import { PRICING_CONFIG } from '../../core/pricing/config.js?v=20260728a';
import { calcularPrecoCampanha, formatarReais } from '../../core/pricing/calculator.js?v=20260728a';

/**
 * Precificador em cards: uma pergunta por tela.
 *
 * Este modulo e a UI, e nada mais. O calculo vive em core/pricing/calculator.js
 * e os numeros em core/pricing/config.js.
 *
 * Ele nao sabe de onde foi chamado: quem monta diz onde renderizar, de onde vem
 * as respostas, onde salva-las e quais botoes aparecem no resultado. Por isso o
 * mesmo quiz serve o onboarding, a secao propria do menu e uma campanha
 * especifica, sem nenhuma copia de pergunta.
 */

const SIM_NAO = [
  { valor: true, label: 'Sim' },
  { valor: false, label: 'Não' }
];

/** As perguntas, na ordem. Trocar texto ou ordem acontece so aqui. */
const CARDS = [
  {
    id: 'intro',
    tipo: 'intro'
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

/**
 * Modo agrupado: as mesmas perguntas, distribuidas em 3 telas em vez de uma por
 * pergunta. Usado na secao do menu, onde a pessoa ja sabe o que veio fazer e
 * responder tudo de uma vez e mais rapido. O onboarding continua uma por tela.
 */
const GRUPOS_DE_PERGUNTAS = [
  {
    id: 'grupo_trabalho',
    titulo: 'O que a marca pediu',
    campos: ['postaNaPropriaConta', 'tipoDeConteudo', 'quantidade']
  },
  {
    id: 'grupo_uso',
    titulo: 'Como a marca vai usar',
    campos: ['usoComoAnuncio', 'usoPerpetuo', 'exclusividade', 'footageBruto']
  },
  {
    id: 'grupo_producao',
    titulo: 'Você e a produção',
    campos: ['seguidores', 'gravacaoPresencial', 'viaPlataforma']
  }
];

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

/** Aceita respostas parciais vindas de qualquer lugar e completa o que faltar. */
const normalizarRespostas = (respostas) => {
  const base = respostasPadrao();
  if (!respostas || typeof respostas !== 'object') return base;
  const seguidores = respostas.seguidores && typeof respostas.seguidores === 'object'
    ? { instagram: respostas.seguidores.instagram ?? null, tiktok: respostas.seguidores.tiktok ?? null }
    : base.seguidores;
  return { ...base, ...respostas, seguidores };
};

const cardsVisiveis = (respostas) => CARDS.filter((card) => !card.condicao || card.condicao(respostas));

const indiceDoCard = (cardId, respostas) => {
  const visiveis = cardsVisiveis(respostas);
  const indice = visiveis.findIndex((card) => card.id === cardId);
  return indice >= 0 ? indice : 0;
};

const cardPorId = (id) => CARDS.find((card) => card.id === id) || null;

/** Uma pergunta so conta como respondida quando tem valor util. */
const perguntaRespondida = (card, respostas) => {
  if (!card) return true;
  if (card.tipo === 'numero') return Number(respostas.quantidade) >= PRICING_CONFIG.quantidade.minimo;
  if (card.tipo === 'seguidores') {
    const { instagram, tiktok } = respostas.seguidores || {};
    return Number.isFinite(Number(instagram)) || Number.isFinite(Number(tiktok));
  }
  return respostas[card.id] !== null && respostas[card.id] !== undefined;
};

/**
 * Telas do fluxo, na ordem. No modo agrupado cada tela carrega varias perguntas;
 * no modo normal, uma. Perguntas condicionais somem das duas formas.
 */
const montarTelas = (respostas, { agrupado = false, mostrarIntro = true } = {}) => {
  if (!agrupado) {
    return cardsVisiveis(respostas)
      .filter((card) => card.tipo !== 'intro' || mostrarIntro)
      .map((card) => ({ id: card.id, tipo: card.tipo, card }));
  }

  const telas = [];
  if (mostrarIntro) telas.push({ id: 'intro', tipo: 'intro' });

  GRUPOS_DE_PERGUNTAS.forEach((grupo) => {
    const perguntas = grupo.campos
      .map(cardPorId)
      .filter((card) => card && (!card.condicao || card.condicao(respostas)));
    if (perguntas.length) telas.push({ id: grupo.id, tipo: 'grupo', grupo, perguntas });
  });

  telas.push({ id: 'resultado', tipo: 'resultado' });
  return telas;
};

const indiceDaTela = (telas, telaId) => {
  const indice = telas.findIndex((tela) => tela.id === telaId);
  return indice >= 0 ? indice : 0;
};

/* ── render ─────────────────────────────────────────────────── */

/** `posicao` é 1-based: a primeira pergunta é "1 de N", não "0 de N". */
const renderProgresso = (posicao, total) => {
  if (total <= 0) return '';
  const percentual = Math.round((posicao / total) * 100);
  return `
    <div class="pricing-progress">
      <div class="pricing-progress-track"><div class="pricing-progress-fill" style="width:${percentual}%"></div></div>
      <span class="pricing-progress-label">${posicao} de ${total}</span>
    </div>
  `;
};

const renderVoltar = () =>
  '<button class="pricing-back" data-pricing-action="voltar" type="button" aria-label="Voltar">&larr;</button>';

const renderIntro = (intro) => `
  <div class="quiz-card pricing-card">
    <div class="quiz-icon">
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="24" cy="24" r="19" stroke="currentColor" stroke-width="2.5"/>
        <path d="M24 14v20M29 19c0-2.2-2.2-3.5-5-3.5s-5 1.3-5 3.5 2.2 3.2 5 3.9 5 1.7 5 3.9-2.2 3.5-5 3.5-5-1.3-5-3.5" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    </div>
    <h2 class="quiz-title">${intro.titulo}</h2>
    ${intro.subtitulo ? `<p class="quiz-sub">${intro.subtitulo}</p>` : ''}
    <button class="btn btn-primary quiz-cta" data-pricing-action="comecar" type="button">${intro.cta}</button>
    ${intro.ctaSecundario
      ? `<button class="btn btn-ghost quiz-cta-secondary" data-pricing-action="sair" type="button">${intro.ctaSecundario}</button>`
      : ''}
  </div>
`;

const renderEscolha = (card, respostas, indice, total) => {
  const selecionada = respostas[card.id];
  const opcoes = card.opcoes.map((opcao) => {
    const ativa = selecionada !== null && selecionada !== undefined && String(selecionada) === String(opcao.valor);
    return `
      <button class="quiz-option${ativa ? ' is-selected' : ''}" type="button"
              data-pricing-action="responder" data-field="${card.id}" data-value="${opcao.valor}">
        ${opcao.label}
      </button>
    `;
  }).join('');

  // Sem botao de continuar: escolher a opcao ja e a resposta, e o proprio
  // clique leva para a proxima pergunta.
  return `
    <div class="quiz-card pricing-card">
      ${renderVoltar()}
      ${renderProgresso(indice, total)}
      <h2 class="quiz-title pricing-question">${card.pergunta}</h2>
      <div class="quiz-options pricing-options">${opcoes}</div>
    </div>
  `;
};

const renderNumero = (card, respostas, indice, total) => `
  <div class="quiz-card pricing-card">
    ${renderVoltar()}
    ${renderProgresso(indice, total)}
    <h2 class="quiz-title pricing-question">${card.pergunta}</h2>
    <div class="pricing-field">
      <input class="input pricing-input" type="number" inputmode="numeric"
             min="${PRICING_CONFIG.quantidade.minimo}" max="${PRICING_CONFIG.quantidade.maximo}" step="1"
             data-pricing-input="quantidade" value="${Number(respostas.quantidade) || PRICING_CONFIG.quantidade.padrao}" />
    </div>
    <button class="btn btn-primary quiz-cta" data-pricing-action="avancar" type="button">Continuar</button>
  </div>
`;

const renderSeguidores = (card, respostas, indice, total) => {
  const instagram = Number.isFinite(Number(respostas.seguidores?.instagram)) ? respostas.seguidores.instagram : '';
  const tiktok = Number.isFinite(Number(respostas.seguidores?.tiktok)) ? respostas.seguidores.tiktok : '';
  return `
    <div class="quiz-card pricing-card">
      ${renderVoltar()}
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
      <button class="btn btn-primary quiz-cta" data-pricing-action="avancar" type="button">Continuar</button>
    </div>
  `;
};

/* ── modo agrupado ──────────────────────────────────────────── */

const renderOpcoesDoGrupo = (card, respostas) => {
  const selecionada = respostas[card.id];
  return card.opcoes.map((opcao) => {
    const ativa = selecionada !== null && selecionada !== undefined && String(selecionada) === String(opcao.valor);
    return `
      <button class="quiz-option${ativa ? ' is-selected' : ''}" type="button"
              data-pricing-action="marcar" data-field="${card.id}" data-value="${opcao.valor}">
        ${opcao.label}
      </button>
    `;
  }).join('');
};

const renderPerguntaNoGrupo = (card, respostas) => {
  if (card.tipo === 'numero') {
    return `
      <div class="pricing-group-field">
        <p class="pricing-group-question">${card.pergunta}</p>
        <input class="input pricing-input" type="number" inputmode="numeric"
               min="${PRICING_CONFIG.quantidade.minimo}" max="${PRICING_CONFIG.quantidade.maximo}" step="1"
               data-pricing-input="quantidade" value="${Number(respostas.quantidade) || PRICING_CONFIG.quantidade.padrao}" />
      </div>
    `;
  }

  if (card.tipo === 'seguidores') {
    const instagram = Number.isFinite(Number(respostas.seguidores?.instagram)) ? respostas.seguidores.instagram : '';
    const tiktok = Number.isFinite(Number(respostas.seguidores?.tiktok)) ? respostas.seguidores.tiktok : '';
    return `
      <div class="pricing-group-field">
        <p class="pricing-group-question">${card.pergunta}</p>
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
      </div>
    `;
  }

  return `
    <div class="pricing-group-field">
      <p class="pricing-group-question">${card.pergunta}</p>
      <div class="quiz-options pricing-options">${renderOpcoesDoGrupo(card, respostas)}</div>
    </div>
  `;
};

const renderGrupo = (tela, respostas, indice, posicao, total, ehUltimo) => {
  const faltaResponder = tela.perguntas.some((card) => !perguntaRespondida(card, respostas));
  return `
    <div class="quiz-card pricing-card pricing-card--group">
      ${indice > 0 ? renderVoltar() : ''}
      ${renderProgresso(posicao, total)}
      <h2 class="quiz-title pricing-question">${tela.grupo.titulo}</h2>
      <div class="pricing-group-fields">
        ${tela.perguntas.map((card) => renderPerguntaNoGrupo(card, respostas)).join('')}
      </div>
      <button class="btn btn-primary quiz-cta" data-pricing-action="avancar" type="button"
              ${faltaResponder ? 'disabled' : ''}>${ehUltimo ? 'Ver valor sugerido' : 'Continuar'}</button>
    </div>
  `;
};

const renderResultado = (respostas, acoes) => {
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

  const botoes = acoes.map((acao, posicao) => {
    const classe = posicao === 0 ? 'btn btn-primary quiz-cta' : 'btn btn-ghost quiz-cta-secondary';
    return `<button class="${classe}" data-pricing-action="acao" data-acao="${acao.id}" type="button">${acao.label}</button>`;
  }).join('');

  return `
    <div class="quiz-card pricing-card pricing-card--result">
      ${renderVoltar()}
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

      ${botoes}
    </div>
  `;
};

/* ── instancia ──────────────────────────────────────────────── */

/**
 * Monta um precificador dentro de um container.
 *
 * @param {Object} opcoes
 * @param {HTMLElement} opcoes.container Onde os cards sao renderizados.
 * @param {Object} [opcoes.respostas] Respostas ja conhecidas (ex: as da campanha).
 * @param {string} [opcoes.cardId] Card onde comecar, para retomar de onde parou.
 * @param {Object} [opcoes.intro] Titulo, subtitulo e CTAs do primeiro card.
 * @param {{id: string, label: string}[]} [opcoes.acoesDoResultado] Botoes finais.
 * @param {(dados: {respostas: Object, cardId: string}) => void} [opcoes.aoMudar] Persistencia.
 * @param {(idDaAcao: string, resultado: Object, respostas: Object) => void} [opcoes.aoAgir]
 * @param {() => void} [opcoes.aoSair] Chamado pelo CTA secundario da intro.
 * @returns {{render: () => void, destruir: () => void, getRespostas: () => Object}}
 */
const montarPrecificador = ({
  container,
  respostas: respostasIniciais = null,
  cardId = 'intro',
  intro = {},
  acoesDoResultado = [],
  agrupado = false,
  mostrarIntro = true,
  aoMudar = null,
  aoAgir = null,
  aoSair = null
}) => {
  if (!container) return null;

  const respostas = normalizarRespostas(respostasIniciais);
  const introFinal = {
    titulo: intro.titulo || 'Vamos descobrir o valor justo da sua campanha',
    subtitulo: intro.subtitulo || 'Isso leva menos de 1 minuto.',
    cta: intro.cta || 'Começar',
    ctaSecundario: intro.ctaSecundario || ''
  };

  let cardAtual = cardId;

  const avisarMudanca = () => {
    if (typeof aoMudar === 'function') aoMudar({ respostas, cardId: cardAtual });
  };

  const telasAtuais = () => montarTelas(respostas, { agrupado, mostrarIntro });

  const render = () => {
    const telas = telasAtuais();
    const indice = indiceDaTela(telas, cardAtual);
    const tela = telas[indice];
    const perguntas = telas.filter((item) => item.tipo !== 'intro' && item.tipo !== 'resultado');
    const totalDePerguntas = perguntas.length;
    const posicao = perguntas.findIndex((item) => item.id === tela.id) + 1;

    let html = '';
    if (tela.tipo === 'intro') html = renderIntro(introFinal);
    else if (tela.tipo === 'grupo') {
      const ultimoGrupo = telas[indice + 1] && telas[indice + 1].tipo === 'resultado';
      html = renderGrupo(tela, respostas, indice, posicao, totalDePerguntas, ultimoGrupo);
    } else if (tela.tipo === 'escolha') html = renderEscolha(tela.card, respostas, posicao, totalDePerguntas);
    else if (tela.tipo === 'numero') html = renderNumero(tela.card, respostas, posicao, totalDePerguntas);
    else if (tela.tipo === 'seguidores') html = renderSeguidores(tela.card, respostas, posicao, totalDePerguntas);
    else if (tela.tipo === 'resultado') html = renderResultado(respostas, acoesDoResultado);

    container.innerHTML = html;
    if (!agrupado) container.querySelector('.pricing-input')?.focus();
  };

  const irPara = (indiceAlvo) => {
    const telas = telasAtuais();
    const alvo = Math.max(0, Math.min(telas.length - 1, indiceAlvo));
    cardAtual = telas[alvo].id;
    avisarMudanca();
    render();
  };

  /**
   * Le os campos numericos antes de sair do card, senao o que o usuario digitou
   * se perde ao avancar ou voltar.
   */
  const capturarCamposNumericos = () => {
    container.querySelectorAll('[data-pricing-input]').forEach((input) => {
      const campo = input.dataset.pricingInput;
      const bruto = String(input.value || '').trim();
      const valor = bruto === '' ? null : Math.max(0, Math.round(Number(bruto) || 0));

      if (campo === 'quantidade') {
        respostas.quantidade = valor === null
          ? PRICING_CONFIG.quantidade.padrao
          : Math.max(PRICING_CONFIG.quantidade.minimo, Math.min(PRICING_CONFIG.quantidade.maximo, valor));
        return;
      }
      if (campo === 'seguidores.instagram') respostas.seguidores.instagram = valor;
      if (campo === 'seguidores.tiktok') respostas.seguidores.tiktok = valor;
    });
  };

  /**
   * No modo agrupado o CTA só libera quando todas as perguntas da tela têm
   * resposta. Como nada é redesenhado a cada clique, o botão é atualizado aqui.
   */
  const atualizarBotaoDoGrupo = () => {
    const botao = container.querySelector('[data-pricing-action="avancar"]');
    if (!botao) return;
    const telas = telasAtuais();
    const tela = telas[indiceDaTela(telas, cardAtual)];
    if (!tela || tela.tipo !== 'grupo') return;
    capturarCamposNumericos();
    botao.disabled = tela.perguntas.some((card) => !perguntaRespondida(card, respostas));
  };

  const aoClicar = (evento) => {
    const alvo = evento.target.closest('[data-pricing-action]');
    if (!alvo || !container.contains(alvo)) return;
    const acao = alvo.dataset.pricingAction;

    if (acao === 'comecar') {
      irPara(1);
      return;
    }

    const guardarResposta = (campo, bruto) => {
      respostas[campo] = bruto === 'true' ? true : bruto === 'false' ? false : bruto;
    };

    // Uma pergunta por tela: escolher já é responder, e o clique avança.
    if (acao === 'responder') {
      guardarResposta(alvo.dataset.field, alvo.dataset.value);
      irPara(indiceDaTela(telasAtuais(), alvo.dataset.field) + 1);
      return;
    }

    // Modo agrupado: marcar uma opção não avança, porque a tela tem mais
    // perguntas embaixo. Também não redesenha o card: só a opção clicada muda
    // de estado, senão o que já foi digitado pisca a cada clique.
    if (acao === 'marcar') {
      guardarResposta(alvo.dataset.field, alvo.dataset.value);
      alvo.closest('.pricing-group-field')?.querySelectorAll('[data-pricing-action="marcar"]').forEach((botao) => {
        botao.classList.toggle('is-selected', botao === alvo);
      });
      atualizarBotaoDoGrupo();
      avisarMudanca();
      return;
    }

    if (acao === 'avancar') {
      capturarCamposNumericos();
      irPara(indiceDaTela(telasAtuais(), cardAtual) + 1);
      return;
    }

    if (acao === 'voltar') {
      capturarCamposNumericos();
      irPara(indiceDaTela(telasAtuais(), cardAtual) - 1);
      return;
    }

    if (acao === 'sair') {
      if (typeof aoSair === 'function') aoSair();
      return;
    }

    if (acao === 'acao') {
      if (typeof aoAgir !== 'function') return;
      aoAgir(alvo.dataset.acao || '', calcularPrecoCampanha(respostas), respostas);
    }
  };

  // Digitar quantidade ou seguidores também pode liberar o CTA do grupo.
  const aoDigitar = (evento) => {
    if (!evento.target.matches('[data-pricing-input]')) return;
    atualizarBotaoDoGrupo();
  };

  container.addEventListener('click', aoClicar);
  container.addEventListener('input', aoDigitar);

  return {
    render,
    destruir: () => {
      container.removeEventListener('click', aoClicar);
      container.removeEventListener('input', aoDigitar);
      container.innerHTML = '';
    },
    getRespostas: () => respostas
  };
};

export { montarPrecificador, respostasPadrao, normalizarRespostas };
