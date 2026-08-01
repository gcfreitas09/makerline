import { MESSAGE_TEMPLATES, TRECHOS } from './message-templates.js?v=20260728k';
import { diasDeAtraso, diasNaEtapaAtual } from './timeline.js?v=20260728k';

/**
 * Monta as mensagens de cobranca a partir dos templates e dos dados reais da
 * campanha. Modulo puro: nao toca no DOM.
 */

const preencher = (texto, dados) =>
  String(texto || '').replace(/\{(\w+)\}/g, (_, chave) => {
    const valor = dados[chave];
    return valor === null || valor === undefined ? '' : String(valor);
  });

const formatarReais = (valor) => {
  const numero = Number(valor) || 0;
  return `R$ ${numero.toLocaleString('pt-BR')}`;
};

const formatarDataBR = (iso) => {
  const bruto = String(iso || '').trim();
  if (!bruto) return 'uma data ainda a combinar';
  const partes = bruto.slice(0, 10).split('-');
  if (partes.length !== 3) return bruto;
  return `${partes[2]}/${partes[1]}`;
};

/** "hoje", "ontem" ou "há N dias" — o texto vem do arquivo de templates. */
const escreverDias = (dias) => {
  const seguro = Math.max(0, Number(dias) || 0);
  if (seguro <= 0) return TRECHOS.diasTexto.hoje;
  if (seguro === 1) return TRECHOS.diasTexto.ontem;
  return preencher(TRECHOS.diasTexto.varios, { dias: seguro });
};

/** Descreve o que foi enviado usando as entregas cadastradas na campanha. */
const descreverEntregas = (campaign, base) => {
  const videos = Math.max(0, Number(campaign?.videoCount) || 0);
  const fotos = Math.max(0, Number(campaign?.photoCount) || 0);
  const partes = [];
  if (videos) partes.push(videos === 1 ? '1 vídeo' : `${videos} vídeos`);
  if (fotos) partes.push(fotos === 1 ? '1 foto' : `${fotos} fotos`);
  if (!partes.length) return base;
  return `${base} de ${partes.join(' e ')}`;
};

const nomeDaMarca = (campaign) => String(campaign?.brand || '').trim() || TRECHOS.marcaSemNome;

/**
 * Gera uma mensagem pronta para copiar.
 *
 * @param {string} templateId Chave de MESSAGE_TEMPLATES.
 * @param {Object} campaign Campanha de origem dos dados.
 * @returns {{id: string, titulo: string, descricao: string, texto: string}|null}
 */
const gerarMensagem = (templateId, campaign) => {
  const template = MESSAGE_TEMPLATES[templateId];
  if (!template || !campaign) return null;

  const dias = diasNaEtapaAtual(campaign);
  const atraso = diasDeAtraso(campaign.paymentDate);

  const dados = {
    marca: nomeDaMarca(campaign),
    dias,
    diasTexto: escreverDias(dias),
    itens: templateId === 'cobranca_roteiro'
      ? descreverEntregas(campaign, TRECHOS.itensPadrao.roteiro)
      : descreverEntregas(campaign, TRECHOS.itensPadrao.conteudo),
    valor: formatarReais(campaign.value),
    prazo: formatarDataBR(campaign.paymentDate),
    atraso,
    atrasoTexto: atraso > 0
      ? preencher(TRECHOS.atrasoTexto.atrasado, { atraso })
      : TRECHOS.atrasoTexto.emDia
  };

  return {
    id: template.id,
    titulo: template.titulo,
    descricao: template.descricao,
    texto: preencher(template.texto, dados).trim()
  };
};

export { gerarMensagem, formatarReais, formatarDataBR, escreverDias };
