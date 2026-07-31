import { state, saveState } from '../../core/state.js';
import { getAcaoDoMicro, getCampaignStageLabel } from '../../core/campaigns/pipeline.js?v=20260728o';
import { diasNaEtapaAtual, diasDeAtraso } from '../../core/campaigns/timeline.js?v=20260728o';
import { gerarMensagem } from '../../core/campaigns/messages.js?v=20260728o';
import { montarChecklistDeGravacao, rotuloDoTipoDeConteudo } from '../../core/campaigns/shooting-checklist.js?v=20260728o';

/**
 * A acao real da etapa em que a campanha esta, exibida no detalhe da campanha.
 *
 * Que etapa tem qual acao e decidido em core/campaigns/pipeline.js, junto da
 * definicao do ciclo. Aqui fica so a apresentacao. Etapa sem acao nao mostra
 * bloco nenhum: nada de texto de enfeite.
 */

const escapar = (texto) => String(texto ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const plural = (quantidade, singular, plural_) => (quantidade === 1 ? singular : plural_);

/* ── blocos ─────────────────────────────────────────────────── */

const renderMensagem = (campaign, templateId) => {
  const mensagem = gerarMensagem(templateId, campaign);
  if (!mensagem) return '';

  const atraso = templateId === 'cobranca_pagamento' ? diasDeAtraso(campaign.paymentDate) : 0;
  const selo = atraso > 0
    ? `<span class="stage-action-badge is-late">${atraso} ${plural(atraso, 'dia', 'dias')} de atraso</span>`
    : '';

  return `
    <div class="stage-action-head">
      <div>
        <strong class="stage-action-title">${escapar(mensagem.titulo)}</strong>
        <p class="stage-action-sub">${escapar(mensagem.descricao)}</p>
      </div>
      ${selo}
    </div>
    <pre class="stage-action-message" data-stage-message>${escapar(mensagem.texto)}</pre>
    <button class="btn btn-primary btn-small" data-action="copy-stage-message" type="button">Copiar mensagem</button>
  `;
};

const renderContador = (campaign) => {
  const dias = diasNaEtapaAtual(campaign);
  return `
    <div class="stage-action-head">
      <div>
        <strong class="stage-action-title">Aguardando o produto chegar</strong>
        <p class="stage-action-sub">Essa etapa depende da logística da marca.</p>
      </div>
      <span class="stage-action-badge">${dias} ${plural(dias, 'dia', 'dias')}</span>
    </div>
  `;
};

const renderChecklist = (campaign) => {
  const itens = montarChecklistDeGravacao(campaign);
  const marcados = campaign.checklistGravacao && typeof campaign.checklistGravacao === 'object'
    ? campaign.checklistGravacao
    : {};
  const concluidos = itens.filter((item) => marcados[item.id] === true).length;
  const tipo = rotuloDoTipoDeConteudo(campaign);

  const semPrecificacao = !campaign.pricing
    ? '<p class="stage-action-sub">Esse checklist fica mais específico se você usar o precificador nessa campanha.</p>'
    : '';

  return `
    <div class="stage-action-head">
      <div>
        <strong class="stage-action-title">Checklist de gravação${tipo ? ` · ${escapar(tipo)}` : ''}</strong>
        <p class="stage-action-sub">Montado a partir do que essa campanha combinou.</p>
      </div>
      <span class="stage-action-badge">${concluidos}/${itens.length}</span>
    </div>
    ${semPrecificacao}
    <ul class="stage-checklist">
      ${itens.map((item) => `
        <li class="stage-checklist-item${marcados[item.id] ? ' is-done' : ''}">
          <label>
            <input type="checkbox" data-stage-checklist-item="${item.id}" ${marcados[item.id] ? 'checked' : ''} />
            <span>${escapar(item.texto)}</span>
          </label>
        </li>
      `).join('')}
    </ul>
  `;
};

const renderPrecificar = (campaign) => {
  const jaTem = campaign.pricing && campaign.pricing.resultado;
  const valorAtual = Number(campaign.value) || 0;
  return `
    <div class="stage-action-head">
      <div>
        <strong class="stage-action-title">Escopo definido: quanto cobrar?</strong>
        <p class="stage-action-sub">${jaTem
          ? 'Você já calculou essa campanha. Dá para refazer se o escopo mudou.'
          : 'Responda o que a marca pediu e leve o valor direto para a campanha.'}</p>
      </div>
      ${valorAtual ? `<span class="stage-action-badge">R$ ${valorAtual.toLocaleString('pt-BR')}</span>` : ''}
    </div>
    <button class="btn btn-primary btn-small" data-action="open-campaign-pricing" data-campaign-id="${campaign.id}" type="button">
      ${jaTem ? 'Refazer precificação' : 'Calcular valor da campanha'}
    </button>
  `;
};

const renderRetrospectivaAtalho = (campaign) => `
  <div class="stage-action-head">
    <div>
      <strong class="stage-action-title">Campanha fechada</strong>
      <p class="stage-action-sub">Veja como foi esse ciclo do começo ao fim.</p>
    </div>
  </div>
  <button class="btn btn-primary btn-small" data-action="open-campaign-retrospective" data-campaign-id="${campaign.id}" type="button">
    Ver retrospectiva
  </button>
`;

/* ── api ────────────────────────────────────────────────────── */

/**
 * HTML do bloco de acao da etapa atual, ou string vazia quando a etapa nao tem
 * acao propria.
 */
const renderStageAction = (campaign) => {
  if (!campaign) return '';
  const definicao = getAcaoDoMicro(campaign.stage);
  if (!definicao) return '';

  let corpo = '';
  if (definicao.tipo === 'mensagem') corpo = renderMensagem(campaign, definicao.template);
  else if (definicao.tipo === 'contador') corpo = renderContador(campaign);
  else if (definicao.tipo === 'checklist') corpo = renderChecklist(campaign);
  else if (definicao.tipo === 'precificar') corpo = renderPrecificar(campaign);
  else if (definicao.tipo === 'retrospectiva') corpo = renderRetrospectivaAtalho(campaign);
  if (!corpo) return '';

  return `
    <section class="stage-action" data-stage-action data-campaign-id="${campaign.id}">
      <span class="stage-action-step">${escapar(getCampaignStageLabel(campaign.status, campaign.stage))}</span>
      ${corpo}
    </section>
  `;
};

/** Marca ou desmarca um item do checklist de gravação. */
const alternarItemDoChecklist = (campaignId, itemId, marcado) => {
  const campaign = (Array.isArray(state.campaigns) ? state.campaigns : []).find((item) => item.id === campaignId);
  if (!campaign || !itemId) return null;
  if (!campaign.checklistGravacao || typeof campaign.checklistGravacao !== 'object') {
    campaign.checklistGravacao = {};
  }
  campaign.checklistGravacao[itemId] = marcado === true;
  campaign.updatedAt = new Date().toISOString();
  saveState();
  return campaign;
};

export { renderStageAction, alternarItemDoChecklist };
