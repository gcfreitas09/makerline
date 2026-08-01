/**
 * Campanha ficticia usada no preview do onboarding, ramo "ainda nao tenho
 * campanha".
 *
 * REGRA: todo texto, valor e prazo do exemplo vive aqui. O preview so recebe o
 * resultado de `camposDeExemplo()` e joga nos campos reais do formulario de
 * campanha, entao editar o exemplo nunca exige mexer em componente.
 *
 * As chaves de `camposDeExemplo()` sao os proprios `name` dos campos do
 * formulario real (`#campaign-form`). Se um campo novo entrar la, basta
 * acrescentar a chave aqui para ele aparecer preenchido no preview.
 */

/** @typedef {Object} CampanhaDeExemplo */
const CAMPANHA_DE_EXEMPLO = {
  marca: 'Skinera Cosméticos',

  // Precisa ser um dos values do select "Como começou" do formulario real.
  comoComecou: 'instagram',

  contato: 'Marina Duarte',
  email: 'marina@skinera.com.br',

  // Valor de mercado de 1 Reels para marca pequena/media.
  valor: 300,
  permuta: false,
  // Atalho de pagamento do formulario: 0, 50 ou 100.
  percentualPago: 50,

  fotos: 0,
  videos: 1,

  // Precisa ser um dos values do select "Próxima ação" do formulario real.
  proximaAcao: 'enviar_roteiro',
  observacao: 'Enviar roteiro do Reels pra Marina aprovar',

  // Prazos em dias a partir de hoje, para o exemplo nunca aparecer vencido.
  diasAteAEntrega: 12,
  diasAteOPagamento: 30,
  diasAteAProximaAcao: 3
};

/** Data futura em ISO curto (YYYY-MM-DD), o formato que os inputs date usam. */
const dataEmDias = (dias) => {
  const data = new Date();
  data.setDate(data.getDate() + (Number(dias) || 0));
  return data.toISOString().slice(0, 10);
};

/**
 * Traduz o exemplo para os campos do formulario real de campanha.
 * @returns {Record<string, string|number>} chave = atributo name do campo.
 */
const camposDeExemplo = () => ({
  brandName: CAMPANHA_DE_EXEMPLO.marca,
  startMethod: CAMPANHA_DE_EXEMPLO.comoComecou,
  contactName: CAMPANHA_DE_EXEMPLO.contato,
  contactEmail: CAMPANHA_DE_EXEMPLO.email,
  value: CAMPANHA_DE_EXEMPLO.valor,
  paymentPreset: String(CAMPANHA_DE_EXEMPLO.percentualPago),
  barter: CAMPANHA_DE_EXEMPLO.permuta ? '1' : '0',
  paymentDate: dataEmDias(CAMPANHA_DE_EXEMPLO.diasAteOPagamento),
  dueDate: dataEmDias(CAMPANHA_DE_EXEMPLO.diasAteAEntrega),
  photoCount: CAMPANHA_DE_EXEMPLO.fotos,
  videoCount: CAMPANHA_DE_EXEMPLO.videos,
  nextActionType: CAMPANHA_DE_EXEMPLO.proximaAcao,
  nextActionDate: dataEmDias(CAMPANHA_DE_EXEMPLO.diasAteAProximaAcao),
  nextActionNote: CAMPANHA_DE_EXEMPLO.observacao
});

export { CAMPANHA_DE_EXEMPLO, camposDeExemplo };
