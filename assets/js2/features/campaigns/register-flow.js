/**
 * Cadastro de campanha em cards: uma pergunta por tela, no mesmo formato do
 * fluxo de precificacao. Vale para toda campanha nova, no onboarding ou no
 * "Nova campanha" do dia a dia. Editar campanha continua no modal.
 *
 * Nao existe formulario paralelo aqui. O proprio `#campaign-form` e movido para
 * dentro do card e so uma linha fica visivel por vez, entao:
 *   - os campos, a ordem e as regras sao exatamente os do cadastro real;
 *   - campo novo no cadastro real vira card sozinho;
 *   - salvar passa pelo mesmo submit de sempre, criando a campanha de verdade.
 */

const OVERLAY_ID = 'register-quiz';
const STAGE_ID = 'register-stage';
const LINHA_OCULTA = 'register-row-hidden';

let indiceAtual = 0;
let ativo = false;
let tentouSalvar = false;
let listenersLigados = false;

const getOverlay = () => document.getElementById(OVERLAY_ID);
const getStage = () => document.getElementById(STAGE_ID);
const getForm = () => document.getElementById('campaign-form');
const getModal = () => document.getElementById('campaign-modal');

/* ── campos ─────────────────────────────────────────────────── */

/**
 * Linhas do formulario real que valem como card agora, na ordem do DOM.
 * Linhas condicionais (ex: "Conta mais", "Tipo personalizado") entram e saem
 * conforme o proprio formulario as mostra, por isso a lista e recalculada a
 * cada navegacao.
 */
const linhasElegiveis = () => {
  const form = getForm();
  if (!form) return [];
  return Array.from(form.querySelectorAll('.form-row[data-campaign-step]'))
    .filter((linha) => linha.style.display !== 'none');
};

/** O titulo do card e o proprio rotulo do campo, sem texto inventado. */
const tituloDaLinha = (linha) => {
  const rotulo = linha.querySelector('label');
  return rotulo ? String(rotulo.textContent || '').trim() : 'Sua campanha';
};

/* ── render ─────────────────────────────────────────────────── */

const montarCard = () => {
  const stage = getStage();
  const form = getForm();
  if (!stage || !form) return null;

  stage.innerHTML = `
    <div class="quiz-card pricing-card register-card">
      <button class="pricing-back" data-action="register-back" type="button" aria-label="Voltar">&larr;</button>
      <button class="register-close" data-action="register-close" type="button" aria-label="Fechar">&times;</button>
      <div class="pricing-progress">
        <div class="pricing-progress-track"><div class="pricing-progress-fill" data-register-progress style="width:0%"></div></div>
        <span class="pricing-progress-label" data-register-count></span>
      </div>
      <h2 class="quiz-title pricing-question" data-register-title></h2>
      <div class="register-slot" data-register-slot></div>
      <button class="btn btn-primary quiz-cta" data-action="register-next" type="button">Continuar</button>
    </div>
  `;

  // O formulario real passa a morar dentro do card. Como e o mesmo no do DOM,
  // continua sendo o mesmo form para o FormData e para o submit.
  stage.querySelector('[data-register-slot]').appendChild(form);
  form.classList.add('campaign-form--cards');

  // O card fica em um overlay bem acima dos modais. Sem isso, o modal de nova
  // marca abre atras do card e some da tela.
  document.body.classList.add('register-cards-open');
  return stage;
};

const render = () => {
  const form = getForm();
  const stage = getStage();
  if (!form || !stage) return;

  const linhas = linhasElegiveis();
  if (!linhas.length) return;

  indiceAtual = Math.max(0, Math.min(linhas.length - 1, indiceAtual));
  const atual = linhas[indiceAtual];

  linhas.forEach((linha) => linha.classList.toggle(LINHA_OCULTA, linha !== atual));

  const titulo = stage.querySelector('[data-register-title]');
  if (titulo) titulo.textContent = tituloDaLinha(atual);

  const contador = stage.querySelector('[data-register-count]');
  if (contador) contador.textContent = `${indiceAtual + 1} de ${linhas.length}`;

  const barra = stage.querySelector('[data-register-progress]');
  if (barra) barra.style.width = `${Math.round((indiceAtual / linhas.length) * 100)}%`;

  // Depois de uma tentativa de salvar, o botao continua sendo "salvar" em
  // qualquer card: quem corrige um campo recusado quer salvar de novo, nao
  // refazer o caminho todo. Para revisar o resto ainda existe o "voltar".
  const avancar = stage.querySelector('[data-action="register-next"], [data-action="register-save"]');
  const salvando = tentouSalvar || indiceAtual >= linhas.length - 1;
  if (avancar) {
    avancar.textContent = salvando ? 'Salvar campanha' : 'Continuar';
    avancar.dataset.action = salvando ? 'register-save' : 'register-next';
  }

  const campo = atual.querySelector('input:not([type="hidden"]), select, textarea');
  if (campo && campo.type !== 'file') campo.focus({ preventScroll: true });
};

/* ── navegacao ──────────────────────────────────────────────── */

const irPara = (proximoIndice) => {
  indiceAtual = proximoIndice;
  render();
};

const mostrarMensagem = (texto) => {
  const msg = document.getElementById('campaign-msg');
  if (msg) msg.textContent = texto || '';
};

/**
 * Um campo invalido escondido em outro card nao pode ser focado pelo navegador,
 * entao a validacao leva o usuario ate o card do problema.
 */
const irParaOCampo = (campo) => {
  if (!campo) return false;
  const linha = campo.closest('.form-row[data-campaign-step]');
  const alvo = linha ? linhasElegiveis().indexOf(linha) : -1;
  if (alvo < 0) return false;
  irPara(alvo);
  return true;
};

const salvar = () => {
  const form = getForm();
  if (!form) return;
  tentouSalvar = true;

  if (!form.checkValidity()) {
    if (irParaOCampo(form.querySelector(':invalid'))) {
      mostrarMensagem('Preencha esse campo para salvar a campanha.');
      return;
    }
  }

  mostrarMensagem('');
  form.requestSubmit();

  // Se o cadastro recusou alguma regra propria dele, o formulario continua
  // montado e diz qual campo travou: o card volta para esse campo com a
  // mensagem que o proprio cadastro escreveu.
  if (!ativo) return;
  const msg = document.getElementById('campaign-msg');
  const nome = msg ? msg.dataset.campoInvalido : '';
  if (!nome) return;
  const texto = msg.textContent;
  irParaOCampo(form.querySelector(`[name="${nome}"]`));
  mostrarMensagem(texto);
};

/* ── montagem e desmontagem ─────────────────────────────────── */

/** Devolve o formulario para o modal e limpa o que o registro guiado mudou. */
const desmontar = () => {
  const form = getForm();
  const modal = getModal();
  if (form) {
    form.classList.remove('campaign-form--cards');
    form.querySelectorAll(`.${LINHA_OCULTA}`).forEach((linha) => linha.classList.remove(LINHA_OCULTA));
    const painel = modal ? modal.querySelector('.modal-panel') : null;
    if (painel) painel.appendChild(form);
  }
  const stage = getStage();
  if (stage) stage.innerHTML = '';
  const overlay = getOverlay();
  if (overlay) overlay.classList.remove('open');
  document.body.classList.remove('register-cards-open');
  indiceAtual = 0;
  tentouSalvar = false;
  ativo = false;
};

/** Sai do registro guiado sem salvar nada. */
const sair = () => {
  const fechar = window.__ugcModals?.closeCampaignModal;
  desmontar();
  if (typeof fechar === 'function') fechar();
};

/**
 * Abre o cadastro de campanha em cards.
 * @returns {boolean} false quando o overlay ou o formulario nao existem, para o
 * chamador cair no modal padrao.
 */
const abrirRegistroGuiado = () => {
  const overlay = getOverlay();
  const abrirModal = window.__ugcModals?.openCampaignModal;
  const desligarWizard = window.__ugcModals?.disableCampaignWizard;
  if (!overlay || !getForm() || typeof abrirModal !== 'function') return false;

  // Reaproveita todo o preparo do cadastro real: reset, marcas e o prefill que
  // veio da precificacao.
  abrirModal();
  if (typeof desligarWizard === 'function') desligarWizard();

  const modal = getModal();
  if (modal) {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  if (!montarCard()) return false;
  overlay.classList.add('open');
  ativo = true;
  indiceAtual = 0;
  tentouSalvar = false;
  render();
  return true;
};

const initRegisterFlow = () => {
  if (listenersLigados) return;
  listenersLigados = true;

  // O submit bem-sucedido do formulario fecha o modal; como o formulario esta
  // dentro do card nesse momento, ele precisa voltar para o lugar antes disso.
  document.addEventListener('ugc:campaigns-changed', (evento) => {
    if (!ativo) return;
    if (evento.detail?.reason !== 'create') return;
    desmontar();
  });
};

const handleRegisterFlowAction = (action) => {
  if (!ativo) return false;

  if (action === 'register-next') {
    mostrarMensagem('');
    irPara(indiceAtual + 1);
    return true;
  }

  if (action === 'register-back') {
    mostrarMensagem('');
    if (indiceAtual <= 0) {
      sair();
      return true;
    }
    irPara(indiceAtual - 1);
    return true;
  }

  if (action === 'register-close') {
    sair();
    return true;
  }

  if (action === 'register-save') {
    salvar();
    return true;
  }

  return false;
};

export { abrirRegistroGuiado, handleRegisterFlowAction, initRegisterFlow };
