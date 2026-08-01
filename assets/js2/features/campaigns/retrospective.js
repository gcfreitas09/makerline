import { state, saveState } from '../../core/state.js';
import { PRICING_CONFIG } from '../../core/pricing/config.js?v=20260728p';
import { formatarReais } from '../../core/campaigns/messages.js?v=20260728p';
import {
  duracaoDoCiclo,
  primeiraEntradaEm,
  quantidadeDeRegravacoes
} from '../../core/campaigns/timeline.js?v=20260728p';

/**
 * Retrospectiva da campanha, aberta quando ela chega em "Pago".
 *
 * E o fechamento do ciclo: o momento em que o creator ve, junto, o que ganhou e
 * quanto tempo levou. Por isso e uma tela de conquista, e nao mais uma tabela.
 */

const getOverlay = () => document.getElementById('campaign-retrospective');
const getStage = () => document.getElementById('campaign-retrospective-stage');

const escapar = (texto) => String(texto ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const formatarDataBR = (iso) => {
  const bruto = String(iso || '').trim();
  if (!bruto) return '—';
  const partes = bruto.slice(0, 10).split('-');
  if (partes.length !== 3) return bruto;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
};

const plural = (quantidade, singular, plural_) => (quantidade === 1 ? singular : plural_);

/**
 * Junta os numeros do ciclo. Modulo de leitura: nao altera a campanha.
 * @returns {Object} dados prontos para exibir.
 */
const montarRetrospectiva = (campaign) => {
  const dias = duracaoDoCiclo(campaign);
  const regravacoes = quantidadeDeRegravacoes(campaign);
  const tipo = String(campaign?.pricing?.respostas?.tipoDeConteudo || '').trim();
  const definicao = PRICING_CONFIG.tiposDeConteudo[tipo];

  const entregas = [];
  const videos = Math.max(0, Number(campaign?.videoCount) || 0);
  const fotos = Math.max(0, Number(campaign?.photoCount) || 0);
  if (videos) entregas.push(`${videos} ${plural(videos, 'vídeo', 'vídeos')}`);
  if (fotos) entregas.push(`${fotos} ${plural(fotos, 'foto', 'fotos')}`);

  const valor = Number(campaign?.value) || 0;
  const valorPorDia = dias > 0 ? Math.round(valor / dias) : valor;

  return {
    marca: String(campaign?.brand || '').trim() || 'Sem marca vinculada',
    valor,
    valorFormatado: formatarReais(valor),
    dias,
    inicio: campaign?.createdAt || primeiraEntradaEm(campaign, 'contato_recebido') || '',
    pagamento: campaign?.paymentReceivedAt || primeiraEntradaEm(campaign, 'pago') || '',
    tipoDeConteudo: definicao ? definicao.label : (entregas.length ? entregas.join(' e ') : 'Não informado'),
    entregas: entregas.length ? entregas.join(' e ') : '—',
    regravacoes,
    houveRegravacao: regravacoes > 0,
    valorPorDia,
    permuta: campaign?.barter === true
  };
};

const render = (campaign) => {
  const stage = getStage();
  if (!stage) return;
  const dados = montarRetrospectiva(campaign);

  const linhas = [
    { label: 'Valor final', valor: dados.permuta ? `${dados.valorFormatado} + permuta` : dados.valorFormatado },
    { label: 'Ciclo completo', valor: `${dados.dias} ${plural(dados.dias, 'dia', 'dias')}` },
    { label: 'Da criação ao pagamento', valor: `${formatarDataBR(dados.inicio)} → ${formatarDataBR(dados.pagamento)}` },
    { label: 'Tipo de conteúdo', valor: dados.tipoDeConteudo },
    { label: 'Entregas', valor: dados.entregas },
    {
      label: 'Regravações',
      valor: dados.houveRegravacao
        ? `${dados.regravacoes} ${plural(dados.regravacoes, 'vez', 'vezes')}`
        : 'Nenhuma, aprovou de primeira'
    }
  ];

  stage.innerHTML = `
    <div class="quiz-card pricing-card retrospective-card">
      <button class="register-close" data-action="close-campaign-retrospective" type="button" aria-label="Fechar">&times;</button>

      <div class="retrospective-crest">
        <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="24" cy="24" r="20" stroke="var(--accent)" stroke-width="2.5"/>
          <path d="M15 24l6 6 12-13" stroke="var(--accent)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>

      <p class="retrospective-eyebrow">Campanha paga</p>
      <h2 class="quiz-title">${escapar(dados.marca)}</h2>
      <p class="retrospective-highlight">${escapar(dados.valorFormatado)}</p>
      <p class="quiz-sub">Fechada em ${dados.dias} ${plural(dados.dias, 'dia', 'dias')}, o que dá ${formatarReais(dados.valorPorDia)} por dia de ciclo.</p>

      <ul class="retrospective-list">
        ${linhas.map((linha) => `
          <li><span>${escapar(linha.label)}</span><strong>${escapar(linha.valor)}</strong></li>
        `).join('')}
      </ul>

      <button class="btn btn-primary quiz-cta" data-action="close-campaign-retrospective" type="button">Fechar</button>
    </div>
  `;
};

const abrirRetrospectiva = (campaignId) => {
  const overlay = getOverlay();
  const campaign = (Array.isArray(state.campaigns) ? state.campaigns : []).find((item) => item.id === campaignId);
  if (!overlay || !campaign) return false;

  // Guarda o resumo na campanha: e o registro do ciclo, util depois em métricas.
  campaign.retrospectiva = { ...montarRetrospectiva(campaign), geradaEm: new Date().toISOString() };
  saveState();

  render(campaign);
  overlay.classList.add('open');
  return true;
};

const fecharRetrospectiva = () => {
  const overlay = getOverlay();
  if (overlay) overlay.classList.remove('open');
  const stage = getStage();
  if (stage) stage.innerHTML = '';
};

export { abrirRetrospectiva, fecharRetrospectiva, montarRetrospectiva };
