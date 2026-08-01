import { state, saveState } from '../../core/state.js';
import { renderAll } from '../../core/renderers.js?v=20260429d';
import { setActivePage } from '../../core/ui.js?v=20260304b';
import { camposDeExemplo } from './first-campaign-example.js?v=20260728p';

/**
 * Onboarding, ramo "ainda nao tenho campanha ativa".
 *
 * Quem nunca fechou campanha nao tem dado real para precificar, entao aqui o
 * objetivo e so mostrar como vai ser registrar a primeira e deixar um gancho de
 * retorno para quando ela chegar.
 *
 * O card do meio nao e uma tela mockada: ele abre o proprio formulario de
 * campanha em modo preview (features/campaigns/modal.js), preenchido com o
 * exemplo de first-campaign-example.js. Assim, campo novo no cadastro real
 * aparece aqui sozinho.
 */

const CARDS = [
  {
    id: 'abertura',
    tipo: 'abertura',
    titulo: 'Você está começando agora',
    subtitulo: 'Vamos te mostrar como vai ser registrar sua primeira campanha quando ela chegar',
    cta: 'Ver como funciona'
  },
  { id: 'preview', tipo: 'preview' },
  {
    id: 'final',
    tipo: 'final',
    titulo: 'É assim que vai funcionar quando você fechar sua primeira campanha.',
    pergunta: 'Quer que a gente te avise quando for hora de calcular seu preço ideal?',
    opcoes: [
      { valor: true, label: 'Sim, me avisa' },
      { valor: false, label: 'Agora não' }
    ]
  }
];

/* ── estado do fluxo ────────────────────────────────────────── */

const ensureFirstCampaignState = () => {
  if (!state.progress) state.progress = {};
  if (!state.progress.onboarding || typeof state.progress.onboarding !== 'object') {
    state.progress.onboarding = {};
  }
  const onboarding = state.progress.onboarding;
  if (!onboarding.primeiraCampanha || typeof onboarding.primeiraCampanha !== 'object') {
    onboarding.primeiraCampanha = { cardId: 'abertura', concluido: false };
  }
  const primeiraCampanha = onboarding.primeiraCampanha;
  if (typeof primeiraCampanha.cardId !== 'string') primeiraCampanha.cardId = 'abertura';
  if (typeof primeiraCampanha.concluido !== 'boolean') primeiraCampanha.concluido = false;
  return primeiraCampanha;
};

const getOverlay = () => document.getElementById('first-campaign-quiz');
const getStage = () => document.getElementById('first-campaign-stage');

const cardPorId = (cardId) => CARDS.find((card) => card.id === cardId) || CARDS[0];

/* ── render ─────────────────────────────────────────────────── */

const renderVoltar = () =>
  '<button class="pricing-back" data-action="first-campaign-back" type="button" aria-label="Voltar">&larr;</button>';

const renderAbertura = (card) => `
  <div class="quiz-card pricing-card">
    <div class="quiz-icon">
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="9" y="6" width="30" height="36" rx="5" stroke="currentColor" stroke-width="2.5"/>
        <path d="M17 17h14M17 24h14M17 31h8" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
      </svg>
    </div>
    <h2 class="quiz-title">${card.titulo}</h2>
    <p class="quiz-sub">${card.subtitulo}</p>
    <button class="btn btn-primary quiz-cta" data-action="first-campaign-preview" type="button">${card.cta}</button>
  </div>
`;

const renderFinal = (card) => {
  const opcoes = card.opcoes.map((opcao) => `
    <button class="quiz-option" type="button"
            data-action="first-campaign-notify" data-value="${opcao.valor}">
      ${opcao.label}
    </button>
  `).join('');

  return `
    <div class="quiz-card pricing-card">
      ${renderVoltar()}
      <h2 class="quiz-title">${card.titulo}</h2>
      <p class="quiz-sub">${card.pergunta}</p>
      <div class="quiz-options pricing-options">${opcoes}</div>
    </div>
  `;
};

const render = () => {
  const stage = getStage();
  if (!stage) return;

  const primeiraCampanha = ensureFirstCampaignState();
  const card = cardPorId(primeiraCampanha.cardId);

  if (card.tipo === 'preview') {
    stage.innerHTML = '';
    abrirPreview();
    return;
  }

  stage.innerHTML = card.tipo === 'abertura' ? renderAbertura(card) : renderFinal(card);
};

/* ── navegacao ──────────────────────────────────────────────── */

const abrirOverlay = () => {
  const overlay = getOverlay();
  if (!overlay) return false;
  overlay.classList.add('open');
  return true;
};

const fecharOverlay = () => {
  const overlay = getOverlay();
  if (overlay) overlay.classList.remove('open');
};

const irPara = (cardId) => {
  const primeiraCampanha = ensureFirstCampaignState();
  primeiraCampanha.cardId = cardPorId(cardId).id;
  saveState();
  abrirOverlay();
  render();
};

/**
 * O modal de campanha vive abaixo do overlay do onboarding, entao o preview
 * ocupa a tela sozinho e o overlay volta quando ele termina.
 */
const abrirPreview = () => {
  const abrir = window.__ugcModals?.openCampaignPreview;
  if (typeof abrir !== 'function') {
    irPara('final');
    return;
  }

  fecharOverlay();
  const aberto = abrir({
    campos: camposDeExemplo(),
    onVoltar: () => irPara('abertura'),
    onConcluir: () => irPara('final')
  });
  if (!aberto) irPara('final');
};

/* ── conclusao ──────────────────────────────────────────────── */

/**
 * Marca no perfil que essa pessoa quer ser avisada quando fechar a primeira
 * campanha. Quem dispara a notificacao le essa flag depois; aqui so persiste.
 */
const registrarInteresseNoAviso = (querAviso) => {
  if (!state.profile || typeof state.profile !== 'object') state.profile = {};
  state.profile.aguardandoPrimeiraCampanha = querAviso === true;
};

const concluirFluxo = (querAviso) => {
  const primeiraCampanha = ensureFirstCampaignState();
  registrarInteresseNoAviso(querAviso);
  primeiraCampanha.concluido = true;
  state.progress.onboarding.quizDone = true;
  saveState();

  fecharOverlay();
  renderAll();
  setActivePage('dashboard');
};

/* ── api publica ────────────────────────────────────────────── */

const abrirFluxoPrimeiraCampanha = () => {
  const overlay = getOverlay();
  if (!overlay) return false;
  const primeiraCampanha = ensureFirstCampaignState();

  // Retomar direto no preview reabriria um modal sem contexto nenhum, entao
  // quem parou ali volta pela abertura.
  if (primeiraCampanha.cardId === 'preview') primeiraCampanha.cardId = 'abertura';

  abrirOverlay();
  render();
  return true;
};

const handleFirstCampaignFlowAction = (action, el) => {
  if (action === 'first-campaign-preview') {
    irPara('preview');
    return true;
  }

  if (action === 'first-campaign-back') {
    irPara('preview');
    return true;
  }

  if (action === 'first-campaign-notify') {
    concluirFluxo(el.dataset.value === 'true');
    return true;
  }

  return false;
};

export { abrirFluxoPrimeiraCampanha, handleFirstCampaignFlowAction, ensureFirstCampaignState };
