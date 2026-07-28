/**
 * Templates das mensagens que o app gera para o creator mandar para a marca.
 *
 * REGRA: nenhum texto de mensagem pode viver dentro de componente. Ajustar tom,
 * encurtar ou reescrever acontece so aqui, sem tocar em logica.
 *
 * Placeholders disponiveis (o que nao existir vira texto vazio):
 *   {marca}        nome da marca, ou "por aí" quando a campanha não tem marca
 *   {creator}      primeiro nome de quem está usando o app
 *   {dias}         dias parados na etapa atual
 *   {diasTexto}    "há 3 dias" / "hoje" — já escrito por extenso
 *   {itens}        o que foi enviado (ex: "o roteiro dos 2 vídeos")
 *   {valor}        valor combinado formatado (ex: R$ 300)
 *   {prazo}        prazo de pagamento em dd/mm
 *   {atraso}       dias de atraso do pagamento
 *   {atrasoTexto}  trecho pronto sobre o atraso, vazio quando está em dia
 */

/**
 * @typedef {Object} TemplateDeMensagem
 * @property {string} id
 * @property {string} titulo Cabecalho do bloco de acao na campanha.
 * @property {string} descricao Uma linha explicando o que a mensagem faz.
 * @property {string} texto Corpo com placeholders.
 */

/** @type {Record<string, TemplateDeMensagem>} */
const MESSAGE_TEMPLATES = {
  cobranca_roteiro: {
    id: 'cobranca_roteiro',
    titulo: 'Cobrar aprovação do roteiro',
    descricao: 'Mensagem pronta para lembrar a marca do roteiro parado.',
    texto:
      'Oi, {marca}! Tudo bem?\n\n' +
      'Enviei {itens} {diasTexto} e queria confirmar se está tudo certo por aí.\n\n' +
      'Assim que você aprovar eu já entro em gravação e sigo com o prazo combinado. ' +
      'Se tiver algum ajuste, me manda que eu resolvo rápido.\n\n' +
      'Obrigado!'
  },

  cobranca_conteudo: {
    id: 'cobranca_conteudo',
    titulo: 'Cobrar aprovação do conteúdo',
    descricao: 'Mensagem pronta para destravar a aprovação do material final.',
    texto:
      'Oi, {marca}! Tudo certo?\n\n' +
      'Te enviei {itens} {diasTexto} e ainda não recebi retorno.\n\n' +
      'Consegue dar uma olhada e me dizer se está aprovado? ' +
      'Se precisar de algum ajuste, me fala que eu já encaixo na agenda.\n\n' +
      'Obrigado!'
  },

  cobranca_pagamento: {
    id: 'cobranca_pagamento',
    titulo: 'Cobrar pagamento',
    descricao: 'Mensagem pronta com valor, prazo e atraso da campanha.',
    texto:
      'Oi, {marca}! Tudo bem?\n\n' +
      'Passando para falar do pagamento da campanha, no valor de {valor}, com prazo combinado para {prazo}.{atrasoTexto}\n\n' +
      'Consegue me confirmar a data do repasse? Se precisar de nota ou algum dado meu, é só pedir.\n\n' +
      'Obrigado!'
  }
};

/** Trechos que mudam conforme o contexto, para a mensagem não soar robótica. */
const TRECHOS = {
  diasTexto: {
    hoje: 'hoje',
    ontem: 'ontem',
    varios: 'há {dias} dias'
  },
  atrasoTexto: {
    emDia: '',
    atrasado: ' O prazo venceu há {atraso} dias.'
  },
  marcaSemNome: 'por aí',
  itensPadrao: {
    roteiro: 'o roteiro',
    conteudo: 'o conteúdo'
  }
};

export { MESSAGE_TEMPLATES, TRECHOS };
