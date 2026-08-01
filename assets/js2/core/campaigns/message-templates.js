/**
 * Templates das mensagens que o app gera para o creator mandar para a marca.
 *
 * REGRA: nenhum texto de mensagem pode viver dentro de componente. Ajustar tom,
 * encurtar ou reescrever acontece so aqui, sem tocar em logica.
 *
 * Variaveis disponiveis (o que nao existir vira texto vazio):
 *   {{nome_marca}}     nome da marca, ou "por aí" quando a campanha não tem marca
 *   {{dias_na_etapa}}  número de dias parados na etapa atual
 *   {{tempo_espera}}   "hoje" / "ontem" / "há 4 dias" — já escrito por extenso
 *   {{itens}}          o que foi enviado (ex: "o roteiro dos 2 vídeos")
 *   {{valor}}          valor combinado formatado (ex: R$ 300)
 *   {{prazo}}          prazo de pagamento em dd/mm
 *   {{dias_atraso}}    dias corridos de atraso do pagamento
 *   {{aviso_atraso}}   frase pronta sobre o atraso, vazia quando está em dia
 */

/**
 * @typedef {Object} TemplateDeMensagem
 * @property {string} id
 * @property {string} titulo Cabecalho do bloco de acao na campanha.
 * @property {string} descricao Uma linha explicando o que a mensagem faz.
 * @property {string} texto Corpo com variaveis.
 */

/** @type {Record<string, TemplateDeMensagem>} */
const MESSAGE_TEMPLATES = {
  cobranca_roteiro: {
    id: 'cobranca_roteiro',
    titulo: 'Cobrar aprovação do roteiro',
    descricao: 'Mensagem pronta para lembrar a marca do roteiro parado.',
    texto:
      'Oi, {{nome_marca}}! Tudo bem?\n\n' +
      'Enviei {{itens}} {{tempo_espera}} e queria confirmar se está tudo certo por aí.\n\n' +
      'Assim que você aprovar eu já entro em gravação e sigo com o prazo combinado. ' +
      'Se tiver algum ajuste, me manda que eu resolvo rápido.\n\n' +
      'Obrigado!'
  },

  cobranca_conteudo: {
    id: 'cobranca_conteudo',
    titulo: 'Cobrar aprovação do conteúdo',
    descricao: 'Mensagem pronta para destravar a aprovação do material final.',
    texto:
      'Oi, {{nome_marca}}! Tudo certo?\n\n' +
      'Te enviei {{itens}} {{tempo_espera}} e ainda não recebi retorno.\n\n' +
      'Consegue dar uma olhada e me dizer se está aprovado? ' +
      'Se precisar de algum ajuste, me fala que eu já encaixo na agenda.\n\n' +
      'Obrigado!'
  },

  cobranca_pagamento: {
    id: 'cobranca_pagamento',
    titulo: 'Cobrar pagamento',
    descricao: 'Mensagem pronta com valor, prazo e atraso da campanha.',
    texto:
      'Oi, {{nome_marca}}! Tudo bem?\n\n' +
      'Passando para falar do pagamento da campanha, no valor de {{valor}}, com prazo combinado para {{prazo}}.{{aviso_atraso}}\n\n' +
      'Consegue me confirmar a data do repasse? Se precisar de nota ou algum dado meu, é só pedir.\n\n' +
      'Obrigado!'
  }
};

/** Trechos que mudam conforme o contexto, para a mensagem não soar robótica. */
const TRECHOS = {
  tempo_espera: {
    hoje: 'hoje',
    ontem: 'ontem',
    varios: 'há {{dias_na_etapa}} dias'
  },
  aviso_atraso: {
    emDia: '',
    atrasado: ' O prazo venceu há {{dias_atraso}} dias.'
  },
  marcaSemNome: 'por aí',
  itensPadrao: {
    roteiro: 'o roteiro',
    conteudo: 'o conteúdo'
  }
};

export { MESSAGE_TEMPLATES, TRECHOS };
