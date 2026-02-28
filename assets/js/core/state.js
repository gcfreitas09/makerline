const STORAGE_KEY_BASE = 'ugcQuestState';
const PREFS_KEY_BASE = 'ugcQuestPrefs';

const getSessionUserId = () => {
  try {
    return sessionStorage.getItem('ugcQuestUserId') || '';
  } catch (error) {
    return '';
  }
};

const getSessionUserEmail = () => {
  try {
    return (sessionStorage.getItem('ugcQuestUserEmail') || '').trim().toLowerCase();
  } catch (error) {
    return '';
  }
};

const storageKeyFor = (baseKey) => {
  const userId = getSessionUserId();
  return userId ? `${baseKey}:${userId}` : baseKey;
};

const STORAGE_KEY = storageKeyFor(STORAGE_KEY_BASE);
const PREFS_KEY = storageKeyFor(PREFS_KEY_BASE);
const todayKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const weekKey = () => {
  const now = new Date();
  const target = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

const DAILY_XP = 20;

const missionPool = [
  { id: 'd-organize-pipeline', label: 'Organizar 2 campanhas (status/valor/prazo)', total: 2, xp: DAILY_XP, type: 'diária' },
  { id: 'd-advance-stage', label: 'Avançar 2 campanhas no status', total: 2, xp: DAILY_XP, type: 'diária' },
  { id: 'd-deadlines', label: 'Definir/editar prazos em 2 campanhas', total: 2, xp: DAILY_XP, type: 'diária' },
  { id: 'd-create-campaign', label: 'Criar 1 nova campanha', total: 1, xp: DAILY_XP, type: 'diária' },
  { id: 'd-pause-archive', label: 'Arquivar ou pausar 1 campanha', total: 1, xp: DAILY_XP, type: 'diária' },
  { id: 'd-production', label: 'Mover 1 campanha para Produção', total: 1, xp: DAILY_XP, type: 'diária' },
  { id: 'd-finish-campaign', label: 'Finalizar 1 campanha', total: 1, xp: DAILY_XP, type: 'diária' },
  { id: 'd-create-scripts', label: 'Criar 2 roteiros', total: 2, xp: DAILY_XP, type: 'diária' },
  { id: 'd-finish-script', label: 'Finalizar 1 roteiro', total: 1, xp: DAILY_XP, type: 'diária' },
  { id: 'd-complete-campaign', label: 'Completar os campos obrigatórios de 1 campanha', total: 1, xp: DAILY_XP, type: 'diária' },
  { id: 'd-brand-contacts', label: 'Registrar contato com 3 marcas', total: 3, xp: DAILY_XP, type: 'diária' },
  { id: 'd-review-active', label: 'Revisar todas as campanhas ativas', total: 1, xp: DAILY_XP, type: 'diária' },
  { id: 'd-resume-stale', label: 'Retomar 1 campanha sem atualização', total: 1, xp: DAILY_XP, type: 'diária' },
  { id: 'd-linked-script', label: 'Criar 1 roteiro vinculado a uma campanha', total: 1, xp: DAILY_XP, type: 'diária' },
  { id: 'd-update-status', label: 'Atualizar o status de 3 campanhas diferentes', total: 3, xp: DAILY_XP, type: 'diária' }
];
const weeklyChallengePool = [
  { id: 'w-organize-pipeline', label: 'Semana organizada: organizar 4 campanhas', total: 4, xp: 200, type: 'semanal' },
  { id: 'w-consistent', label: 'Criador consistente: completar missões em 5 dias', total: 5, xp: 250, type: 'semanal' },
  { id: 'w-scripts', label: 'Máquina de produção: criar 4 roteiros', total: 4, xp: 200, type: 'semanal' },
  { id: 'w-contacts', label: 'Avanço comercial: registrar contato com 10 marcas', total: 10, xp: 250, type: 'semanal' },
  { id: 'w-finish-campaigns', label: 'Entregador confiável: finalizar 2 campanhas', total: 2, xp: 300, type: 'semanal' },
  { id: 'w-clean-week', label: 'Semana limpa: atualizar campanhas ativas em 5 dias', total: 5, xp: 200, type: 'semanal' }
];
const focusPool = [
  { id: 'f-short-videos', label: 'Postar 3 vídeos curtos', target: 3, xp: 120 },
  { id: 'f-scripts', label: 'Criar 2 roteiros caprichados', target: 2, xp: 120 },
  { id: 'f-pipeline', label: 'Organizar 4 campanhas no pipeline', target: 4, xp: 120 },
  { id: 'f-deadlines', label: 'Definir prazos em 3 campanhas', target: 3, xp: 120 },
  { id: 'f-contacts', label: 'Fazer contato com 5 marcas', target: 5, xp: 150 },
  { id: 'f-followup', label: 'Fazer 3 follow-ups com marcas', target: 3, xp: 120 },
  { id: 'f-finish', label: 'Finalizar 1 campanha', target: 1, xp: 150 }
];

const hairItems = [
  { id: 'hair-classic', name: 'Corte clássico', level: 1, premium: false },
  { id: 'hair-fade', name: 'Fade clean', level: 4, premium: false },
  { id: 'hair-wave', name: 'Waves curtas', level: 6, premium: false },
  { id: 'hair-color', name: 'Color neon', level: 8, premium: true }
];

const outfitItems = [
  { id: 'outfit-basic', name: 'Jaqueta preta', level: 1, premium: false },
  { id: 'outfit-tech', name: 'Tech street', level: 5, premium: false },
  { id: 'outfit-run', name: 'Fit creator', level: 7, premium: false },
  { id: 'outfit-prem', name: 'Premium drop', level: 9, premium: true }
];

const shoeItems = [
  { id: 'shoe-default', name: 'Sneaker clean', level: 1, premium: false },
  { id: 'shoe-run', name: 'Runner neon', level: 5, premium: false },
  { id: 'shoe-high', name: 'High top', level: 7, premium: false },
  { id: 'shoe-prem', name: 'Drop exclusivo', level: 10, premium: true }
];

const defaultState = {
  meta: {
    updatedAt: null
  },
  profile: {
    name: 'criador',
    email: '',
    level: 1,
    xp: 0,
    streak: 0
  },
  focus: {
    id: 'f-short-videos',
    week: weekKey(),
    roll: 0,
    label: 'Postar 3 vídeos curtos',
    current: 0,
    target: 3,
    xp: 120
  },
  missions: [],
  challenges: [],
  campaigns: [],
  brands: [],
  scripts: [],
  metrics: {
    rangeDays: 7,
    avgTime: 12,
    proposals: 24,
    responseRate: 0.42,
    steps: [
      { label: 'Contato enviado', value: 1 },
      { label: 'Marca respondeu', value: 1 },
      { label: 'Negociacao', value: 0 },
      { label: 'Roteiro pronto', value: 1 },
      { label: 'Gravacao', value: 0 },
      { label: 'Edicao', value: 1 }
    ]
  },
  settings: {
    weekly: false,
    alerts: true,
    backup: true
  },
  progress: {
    daily: {
      date: todayKey(),
      bonusDate: null,
      lastCompleteDate: null,
      unique: {}
    },
    weekly: {
      date: weekKey(),
      challengeId: null,
      dailyCompleteDays: [],
      campaignUpdateDays: [],
      organizedCampaignIds: [],
      finishedCampaignIds: []
    },
    streak: {
      lastSeenDate: null
    },
    achievements: {
      version: 2,
      unlocked: [],
      active: []
    }
  },
  avatar: {
    premium: false,
    unlocked: ['hair-classic', 'outfit-basic', 'shoe-default'],
    selected: {
      hair: 'hair-classic',
      outfit: 'outfit-basic',
      shoes: 'shoe-default'
    }
  },
  ui: {
    activePage: 'dashboard',
    campaignFilter: 'all',
    campaignPaymentFilter: 'all',
    openMetric: 'pocket',
    openScript: null,
    brandComposer: {
      brandId: null,
      type: 'first',
      text: ''
    },
    missionDate: todayKey(),
    weeklyDate: weekKey()
  }
};

const statusLabels = {
  prospeccao: 'Prospecção',
  producao: 'Produção',
  finalizacao: 'Finalização',
  concluida: 'Concluída'
};

const campaignStatusOrder = ['prospeccao', 'producao', 'finalizacao', 'concluida'];

const campaignStagesByStatus = {
  prospeccao: [
    { id: 'abordagem', label: 'Abordagem/Inscrição' },
    { id: 'negociacao', label: 'Negociação' },
    { id: 'aprovado', label: 'Aprovado' }
  ],
  producao: [
    { id: 'aguardando_produto', label: 'Aguardando produto' },
    { id: 'produto_recebido', label: 'Produto recebido' },
    { id: 'roteiro_enviado', label: 'Roteiro enviado' },
    { id: 'aguardando_aprovacao_roteiro', label: 'Aguardando aprovação do roteiro' },
    { id: 'roteiro_aprovado', label: 'Roteiro aprovado' },
    { id: 'gravacao', label: 'Gravação' },
    { id: 'conteudo_enviado', label: 'Conteúdo enviado' },
    { id: 'aguardando_aprovacao_conteudo', label: 'Aguardando aprovação do conteúdo' },
    { id: 'ajustes', label: 'Regravação / ajustes' }
  ],
  finalizacao: [
    { id: 'conteudo_aprovado', label: 'Conteúdo aprovado' },
    { id: 'aguardando_pagamento', label: 'Aguardando pagamento' }
  ],
  concluida: [{ id: 'pago', label: 'Pago' }]
};

const getCampaignStageOptions = (status) => campaignStagesByStatus[String(status || '').trim()] || [];

const getDefaultCampaignStage = (status) => getCampaignStageOptions(status)[0]?.id || '';

const getCampaignStageLabel = (status, stageId) => {
  const wanted = String(stageId || '').trim();
  if (!wanted) return '';
  const options = getCampaignStageOptions(status);
  const found = options.find((opt) => opt.id === wanted);
  return found ? found.label : '';
};

const typeLabels = {
  review: 'Review',
  unboxing: 'Unboxing',
  tutorial: 'Tutorial',
  storytelling: 'Storytelling'
};

const statusDot = {
  prospeccao: 'dot-prospeccao',
  producao: 'dot-producao',
  finalizacao: 'dot-finalizacao',
  concluida: 'dot-concluida'
};

const brandStatuses = {
  enviado: 'Mandei msg',
  negociando: 'Negociando',
  fechado: 'Fechou'
};

const brandOptions = Object.keys(brandStatuses);

const deepClone = (value) => JSON.parse(JSON.stringify(value));

const stripUgcPrefix = (value) => String(value || '').replace(/^UGC\s*[-–—]\s*/i, '').trim();

const normalizeCampaignTitles = (currentState) => {
  if (!currentState || typeof currentState !== 'object') return;
  const campaigns = Array.isArray(currentState.campaigns) ? currentState.campaigns : [];
  campaigns.forEach((campaign) => {
    if (!campaign || typeof campaign !== 'object') return;
    if (campaign.title) campaign.title = stripUgcPrefix(campaign.title);
    if (campaign.brand) campaign.brand = stripUgcPrefix(campaign.brand);
  });
};

const normalizeCampaignPipeline = (currentState) => {
  if (!currentState || typeof currentState !== 'object') return;

  const campaigns = Array.isArray(currentState.campaigns) ? currentState.campaigns : [];
  campaigns.forEach((campaign) => {
    if (!campaign || typeof campaign !== 'object') return;

    const rawStatus = String(campaign.status || '').trim().toLowerCase();
    const rawStage = String(campaign.stage || '').trim();
    const rawPipeline = String(campaign.pipeline || '').trim().toLowerCase();

    const paymentPercentRaw = Number.isFinite(campaign.paymentPercent)
      ? campaign.paymentPercent
      : parseInt(String(campaign.paymentPercent || ''), 10);
    const paymentPercent = Number.isFinite(paymentPercentRaw) ? Math.max(0, Math.min(100, Math.round(paymentPercentRaw))) : 0;

    // Migração de status antigo (pendente/negociando/realizado).
    if (rawStatus === 'pendente') {
      campaign.status = 'prospeccao';
      if (!rawStage) campaign.stage = 'abordagem';
    } else if (rawStatus === 'negociando') {
      campaign.status = 'prospeccao';
      if (!rawStage) campaign.stage = 'negociacao';
    } else if (rawStatus === 'realizado') {
      if (paymentPercent >= 100) {
        campaign.status = 'concluida';
        campaign.stage = 'pago';
      } else {
        campaign.status = 'finalizacao';
        if (!rawStage) campaign.stage = 'aguardando_pagamento';
      }
    }

    // Migração simples do campo antigo "pipeline" (quando existir).
    if (rawPipeline && !String(campaign.stage || '').trim()) {
      if (rawPipeline === 'entrega') {
        campaign.status = 'producao';
        campaign.stage = 'conteudo_enviado';
      }
    }

    // Garante status válido.
    const statusSafe = String(campaign.status || '').trim();
    if (!campaignStatusOrder.includes(statusSafe)) {
      campaign.status = 'prospeccao';
    }

    // Garante etapa válida pro status.
    const stageSafe = String(campaign.stage || '').trim();
    const options = getCampaignStageOptions(campaign.status);
    const hasStage = stageSafe && options.some((opt) => opt.id === stageSafe);
    if (!hasStage) {
      campaign.stage = getDefaultCampaignStage(campaign.status);
    }

    // Limpa campo legado.
    if (campaign.pipeline !== undefined) delete campaign.pipeline;
  });

  // Migra o filtro antigo salvo no UI.
  if (currentState.ui && typeof currentState.ui === 'object') {
    const filter = String(currentState.ui.campaignFilter || 'all').trim().toLowerCase();
    if (filter === 'pendente' || filter === 'negociando') currentState.ui.campaignFilter = 'prospeccao';
    if (filter === 'realizado') currentState.ui.campaignFilter = 'finalizacao';
  }
};

const normalizeBrandIds = (currentState) => {
  if (!currentState || typeof currentState !== 'object') return;
  const brands = Array.isArray(currentState.brands) ? currentState.brands : [];
  const seen = new Set();

  brands.forEach((brand, index) => {
    if (!brand || typeof brand !== 'object') return;

    let id = String(brand.id || '').trim();
    if (!id) {
      id = `b-${Date.now()}-${index}`;
    }

    let uniqueId = id;
    let attempt = 1;
    while (seen.has(uniqueId)) {
      uniqueId = `${id}-${attempt}`;
      attempt += 1;
    }

    brand.id = uniqueId;
    seen.add(uniqueId);
  });
};

const mergeState = (base, incoming) => {
  if (Array.isArray(base)) {
    return Array.isArray(incoming) ? incoming : base;
  }

  if (base && typeof base === 'object') {
    const merged = { ...base };
    Object.keys(base).forEach((key) => {
      merged[key] = mergeState(base[key], incoming ? incoming[key] : undefined);
    });
    if (incoming && typeof incoming === 'object') {
      Object.keys(incoming).forEach((key) => {
        if (merged[key] === undefined) {
          merged[key] = incoming[key];
        }
      });
    }
    return merged;
  }

  return incoming !== undefined ? incoming : base;
};

const loadState = () => {
  let stored = localStorage.getItem(STORAGE_KEY);
  let prefsRaw = localStorage.getItem(PREFS_KEY);
  const sessionEmail = getSessionUserEmail();

  if (!stored && sessionEmail && STORAGE_KEY !== STORAGE_KEY_BASE) {
    const legacy = localStorage.getItem(STORAGE_KEY_BASE);
    if (legacy) {
      try {
        const parsed = JSON.parse(legacy);
        const legacyEmail = String(parsed?.profile?.email || '').trim().toLowerCase();
        if (legacyEmail && legacyEmail === sessionEmail) {
          stored = legacy;
        }
      } catch (error) {}
    }
  }

  if (!prefsRaw && sessionEmail && PREFS_KEY !== PREFS_KEY_BASE) {
    prefsRaw = localStorage.getItem(PREFS_KEY_BASE);
  }
  let prefs = null;
  try {
    prefs = prefsRaw ? JSON.parse(prefsRaw) : null;
  } catch (error) {
    prefs = null;
  }

  let nextState = deepClone(defaultState);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      nextState = mergeState(defaultState, parsed);
    } catch (error) {
      nextState = deepClone(defaultState);
    }
  }

  if (prefs && typeof prefs === 'object' && prefs.settings && typeof prefs.settings === 'object') {
    nextState.settings = { ...nextState.settings, ...prefs.settings };
  }

  normalizeCampaignTitles(nextState);
  normalizeCampaignPipeline(nextState);
  normalizeBrandIds(nextState);
  return nextState;
};

let state = loadState();

let remoteSaveTimer = null;
let remoteSaveInFlight = false;
let remoteSavePending = false;
let remoteSaveEnabled = false;
const REMOTE_SAVE_DEBOUNCE_MS = 900;

const enableRemoteSave = () => { remoteSaveEnabled = true; };

const getSessionToken = () => {
  try {
    return sessionStorage.getItem('ugcQuestToken') || '';
  } catch (error) {
    return '';
  }
};

const isLoggedIn = () => {
  try {
    return sessionStorage.getItem('ugcQuestLoggedIn') === '1';
  } catch (error) {
    return false;
  }
};

const canRemoteSync = () => {
  if (typeof window === 'undefined') return false;
  if (window.location?.protocol === 'file:') return false;
  return isLoggedIn() && Boolean(getSessionToken());
};

const flushRemoteSave = async () => {
  if (!remoteSavePending) return;
  if (remoteSaveInFlight) return;
  if (!canRemoteSync()) {
    remoteSavePending = false;
    return;
  }

  remoteSavePending = false;
  remoteSaveInFlight = true;

  try {
    const token = getSessionToken();
    console.log('[Sync] Salvando estado no servidor...');
    const res = await fetch('api/state.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'save', token, state })
    });
    
    if (!res.ok) {
      console.error('[Sync] Erro ao salvar estado:', res.status, res.statusText);
    } else {
      const data = await res.json().catch(() => null);
      if (data?.success) {
        console.log('[Sync] Estado salvo com sucesso no servidor');
      } else {
        console.warn('[Sync] Resposta inesperada do servidor:', data);
      }
    }
  } catch (error) {
    console.error('[Sync] Falha ao salvar estado no servidor:', error);
  } finally {
    remoteSaveInFlight = false;
    if (remoteSavePending) {
      scheduleRemoteSave();
    }
  }
};

const scheduleRemoteSave = () => {
  if (!remoteSaveEnabled) return;
  if (!canRemoteSync()) return;
  remoteSavePending = true;
  if (remoteSaveTimer) {
    window.clearTimeout(remoteSaveTimer);
  }
  remoteSaveTimer = window.setTimeout(flushRemoteSave, REMOTE_SAVE_DEBOUNCE_MS);
};

const saveState = () => {
  try {
    state.meta = state.meta && typeof state.meta === 'object' ? state.meta : {};
    state.meta.updatedAt = new Date().toISOString();
  } catch (error) {}

  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ settings: state.settings }));
  } catch (error) {}

  if (state.settings?.backup) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } else {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {}
  }

  scheduleRemoteSave();
};

const replaceState = (nextState) => {
  if (!nextState || typeof nextState !== 'object') return;
  const merged = mergeState(defaultState, nextState);
  normalizeCampaignTitles(merged);
  normalizeBrandIds(merged);
  state = merged;
};

const xpForLevel = (level) => {
  const safeLevel = Number.isFinite(level) ? Math.floor(level) : parseInt(level, 10) || 1;
  if (safeLevel >= 10) return 0;
  const clamped = Math.max(1, safeLevel);
  const step = clamped - 1;
  return 180 + step * 25 + step * step * 5;
};

const isCampaignActive = (campaign) => {
  if (!campaign || typeof campaign !== 'object') return false;
  if (campaign.archived) return false;
  if (campaign.paused) return false;
  return campaign.status !== 'concluida';
};

const dateDiffDays = (isoOrDate, now = new Date()) => {
  const date = isoOrDate ? new Date(isoOrDate) : null;
  if (!date || Number.isNaN(date.getTime())) return Infinity;
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return Math.floor((end - start) / 86400000);
};

const achievementPoolLegacy = [
  {
    id: 'ach-first-campaign',
    title: 'Primeiro passo',
    desc: 'Criar a primeira campanha.',
    xp: 100,
    isUnlocked: (current) => (Array.isArray(current.campaigns) ? current.campaigns.length : 0) >= 1
  },
  {
    id: 'ach-organizer',
    title: 'Organizador nato',
    desc: 'Deixar 10 campanhas com tudo preenchido.',
    xp: 200,
    isUnlocked: (current) => {
      const campaigns = Array.isArray(current.campaigns) ? current.campaigns : [];
        const isComplete = (campaign) => {
          if (!campaign || typeof campaign !== 'object') return false;
          const brandOk = Boolean(String(campaign.brand || '').trim());
          const barterOk = Boolean(campaign.barter);
          const valueOk = (Number.isFinite(campaign.value) && campaign.value > 0) || barterOk;
          const statusOk = campaignStatusOrder.includes(String(campaign.status || '').trim());
          const stageOk = Boolean(getCampaignStageLabel(campaign.status, campaign.stage));
          const dueOk = Boolean(campaign.dueDate);
          return brandOk && valueOk && statusOk && stageOk && dueOk;
        };
      return campaigns.filter(isComplete).length >= 10;
    }
  },
  {
    id: 'ach-writer',
    title: 'Roteirista ativo',
    desc: 'Criar 10 roteiros.',
    xp: 200,
    isUnlocked: (current) => (Array.isArray(current.scripts) ? current.scripts.length : 0) >= 10
  },
  {
    id: 'ach-production',
    title: 'Em movimento',
    desc: 'Levar 5 campanhas para Produção ou além.',
    xp: 250,
    isUnlocked: (current) => {
      const campaigns = Array.isArray(current.campaigns) ? current.campaigns : [];
      return campaigns.filter((c) => ['producao', 'finalizacao', 'concluida'].includes(c.status)).length >= 5;
    }
  },
  {
    id: 'ach-finalizer',
    title: 'Finalizador',
    desc: 'Finalizar 5 campanhas.',
    xp: 300,
    isUnlocked: (current) =>
      (Array.isArray(current.campaigns) ? current.campaigns : []).filter((c) => ['finalizacao', 'concluida'].includes(c.status)).length >= 5
  },
  {
    id: 'ach-contact',
    title: 'Contato constante',
    desc: 'Registrar 20 contatos com marcas.',
    xp: 250,
    isUnlocked: (current) => (Array.isArray(current.brands) ? current.brands.length : 0) >= 20
  },
  {
    id: 'ach-streak7',
    title: 'Criador consistente',
    desc: 'Completar missões em 7 dias seguidos.',
    xp: 300,
    isUnlocked: (current) => (current.profile?.streak || 0) >= 7
  },
  {
    id: 'ach-clean-pipeline',
    title: 'Pipeline limpo',
    desc: 'Nenhuma campanha parada há 7 dias.',
    xp: 300,
    isUnlocked: (current) => {
      const campaigns = Array.isArray(current.campaigns) ? current.campaigns : [];
      const active = campaigns.filter(isCampaignActive);
      if (!active.length) return false;
      return active.every((c) => dateDiffDays(c.updatedAt || c.createdAt, new Date()) < 7);
    }
  },
  {
    id: 'ach-level5',
    title: 'Usuário avançado',
    desc: 'Atingir o nível 5.',
    xp: 400,
    isUnlocked: (current) => (current.profile?.level || 0) >= 5
  },
  {
    id: 'ach-level10',
    title: 'UGC disciplinado',
    desc: 'Atingir o nível 10.',
    xp: 500,
    isUnlocked: (current) => (current.profile?.level || 0) >= 10
  },
  {
    id: 'ach-first-script',
    title: 'Roteiro no ar',
    desc: 'Criar o primeiro roteiro.',
    xp: 100,
    isUnlocked: (current) => (Array.isArray(current.scripts) ? current.scripts.length : 0) >= 1
  },
  {
    id: 'ach-script-finisher',
    title: 'Roteiro redondinho',
    desc: 'Finalizar 3 roteiros.',
    xp: 200,
    isUnlocked: (current) =>
      (Array.isArray(current.scripts) ? current.scripts : []).filter((s) => Boolean(s.finalized)).length >= 3
  },
  {
    id: 'ach-first-contact',
    title: 'Primeiro contato',
    desc: 'Registrar a primeira marca.',
    xp: 100,
    isUnlocked: (current) => (Array.isArray(current.brands) ? current.brands.length : 0) >= 1
  },
  {
    id: 'ach-contacts-10',
    title: 'Agenda cheia',
    desc: 'Registrar 10 contatos com marcas.',
    xp: 200,
    isUnlocked: (current) => (Array.isArray(current.brands) ? current.brands.length : 0) >= 10
  },
  {
    id: 'ach-3-campaigns',
    title: 'Aquecimento',
    desc: 'Criar 3 campanhas.',
    xp: 150,
    isUnlocked: (current) => (Array.isArray(current.campaigns) ? current.campaigns.length : 0) >= 3
  },
  {
    id: 'ach-10-campaigns',
    title: 'Mão na massa',
    desc: 'Criar 10 campanhas.',
    xp: 250,
    isUnlocked: (current) => (Array.isArray(current.campaigns) ? current.campaigns.length : 0) >= 10
  },
  {
    id: 'ach-first-close',
    title: 'Primeiro fechado',
    desc: 'Finalizar 1 campanha.',
    xp: 150,
    isUnlocked: (current) =>
      (Array.isArray(current.campaigns) ? current.campaigns : []).filter((c) => ['finalizacao', 'concluida'].includes(c.status)).length >= 1
  },
  {
    id: 'ach-2-closes',
    title: 'Dois fechados',
    desc: 'Finalizar 2 campanhas.',
    xp: 200,
    isUnlocked: (current) =>
      (Array.isArray(current.campaigns) ? current.campaigns : []).filter((c) => ['finalizacao', 'concluida'].includes(c.status)).length >= 2
  },
  {
    id: 'ach-level3',
    title: 'Subindo rápido',
    desc: 'Atingir o nível 3.',
    xp: 200,
    isUnlocked: (current) => (current.profile?.level || 0) >= 3
  }
];

const achievementPool = [
  {
    id: 'ach-first-campaign',
    unlockLevel: 1,
    title: 'Primeiro passo',
    desc: 'Criar a primeira campanha.',
    xp: 100,
    isUnlocked: (current) => (Array.isArray(current.campaigns) ? current.campaigns.length : 0) >= 1
  },
  {
    id: 'ach-streak7',
    unlockLevel: 2,
    title: 'Criador consistente',
    desc: 'Completar missões em 7 dias seguidos.',
    xp: 300,
    isUnlocked: (current) => (current.profile?.streak || 0) >= 7
  },
  {
    id: 'ach-writer',
    unlockLevel: 3,
    title: 'Roteirista ativo',
    desc: 'Criar 10 roteiros.',
    xp: 200,
    isUnlocked: (current) => (Array.isArray(current.scripts) ? current.scripts.length : 0) >= 10
  },
  {
    id: 'ach-production',
    unlockLevel: 4,
    title: 'Em produção',
    desc: 'Levar 5 campanhas para Produção ou além.',
    xp: 250,
    isUnlocked: (current) => {
      const campaigns = Array.isArray(current.campaigns) ? current.campaigns : [];
      return campaigns.filter((c) => ['producao', 'finalizacao', 'concluida'].includes(c.status)).length >= 5;
    }
  },
  {
    id: 'ach-level5',
    unlockLevel: 5,
    title: 'Usuário avançado',
    desc: 'Atingir o nível 5.',
    xp: 400,
    isUnlocked: (current) => (current.profile?.level || 0) >= 5
  },
  {
    id: 'ach-contact',
    unlockLevel: 6,
    title: 'Contato constante',
    desc: 'Registrar 20 contatos com marcas.',
    xp: 250,
    isUnlocked: (current) => (Array.isArray(current.brands) ? current.brands.length : 0) >= 20
  },
  {
    id: 'ach-finalizer',
    unlockLevel: 7,
    title: 'Finalizador',
    desc: 'Finalizar 5 campanhas.',
    xp: 300,
    isUnlocked: (current) =>
      (Array.isArray(current.campaigns) ? current.campaigns : []).filter((c) => ['finalizacao', 'concluida'].includes(c.status)).length >= 5
  },
  {
    id: 'ach-organizer',
    unlockLevel: 8,
    title: 'Organizador nato',
    desc: 'Deixar 10 campanhas com tudo preenchido.',
    xp: 200,
    isUnlocked: (current) => {
      const campaigns = Array.isArray(current.campaigns) ? current.campaigns : [];
      const isComplete = (campaign) => {
        if (!campaign || typeof campaign !== 'object') return false;
        const brandOk = Boolean(String(campaign.brand || '').trim());
        const barterOk = Boolean(campaign.barter);
        const valueOk = (Number.isFinite(campaign.value) && campaign.value > 0) || barterOk;
        const statusOk = campaignStatusOrder.includes(String(campaign.status || '').trim());
        const stageOk = Boolean(getCampaignStageLabel(campaign.status, campaign.stage));
        const dueOk = Boolean(campaign.dueDate);
        return brandOk && valueOk && statusOk && stageOk && dueOk;
      };
      return campaigns.filter(isComplete).length >= 10;
    }
  },
  {
    id: 'ach-clean-pipeline',
    unlockLevel: 9,
    title: 'Pipeline limpo',
    desc: 'Nenhuma campanha parada há 7 dias.',
    xp: 300,
    isUnlocked: (current) => {
      const campaigns = Array.isArray(current.campaigns) ? current.campaigns : [];
      const active = campaigns.filter(isCampaignActive);
      if (!active.length) return false;
      return active.every((c) => dateDiffDays(c.updatedAt || c.createdAt, new Date()) < 7);
    }
  },
  {
    id: 'ach-level10',
    unlockLevel: 10,
    title: 'UGC disciplinado',
    desc: 'Atingir o nível 10.',
    xp: 500,
    isUnlocked: (current) => (current.profile?.level || 0) >= 10
  }
];

const achievementCatalog = [
  ...achievementPool,
  {
    id: 'ach-deadlines-8',
    unlockLevel: 5,
    title: 'Agenda em dia',
    desc: 'Definir prazo em 8 campanhas.',
    xp: 400,
    isUnlocked: (current) => {
      const campaigns = Array.isArray(current.campaigns) ? current.campaigns : [];
      return campaigns.filter((campaign) => Boolean(String(campaign?.dueDate || '').trim())).length >= 8;
    }
  },
  {
    id: 'ach-negotiations-3',
    unlockLevel: 6,
    title: 'Negociação quente',
    desc: 'Ter 3 campanhas na etapa de Negociação.',
    xp: 250,
    isUnlocked: (current) => {
      const campaigns = Array.isArray(current.campaigns) ? current.campaigns : [];
      return campaigns.filter((campaign) => campaign?.status === 'prospeccao' && campaign?.stage === 'negociacao' && isCampaignActive(campaign)).length >= 3;
    }
  },
  {
    id: 'ach-focus-2',
    unlockLevel: 7,
    title: 'Foco total',
    desc: 'Completar o foco da semana 2 vezes.',
    xp: 300,
    isUnlocked: (current) => (current.focus?.roll || 0) >= 2
  },
  {
    id: 'ach-scripts-15',
    unlockLevel: 8,
    title: 'Roteiro em série',
    desc: 'Criar 15 roteiros.',
    xp: 200,
    isUnlocked: (current) => (Array.isArray(current.scripts) ? current.scripts.length : 0) >= 15
  },
  {
    id: 'ach-no-overdue',
    unlockLevel: 9,
    title: 'Sem atraso',
    desc: 'Nenhuma campanha ativa com prazo vencido.',
    xp: 300,
    isUnlocked: (current) => {
      const campaigns = Array.isArray(current.campaigns) ? current.campaigns : [];
      const active = campaigns.filter(isCampaignActive);
      if (active.length < 3) return false;
      const today = todayKey();
      return active.every((campaign) => {
        const due = String(campaign?.dueDate || '').trim();
        if (!due) return false;
        return due >= today;
      });
    }
  },
  {
    id: 'ach-focus-5',
    unlockLevel: 10,
    title: 'Modo lenda',
    desc: 'Completar o foco da semana 5 vezes.',
    xp: 500,
    isUnlocked: (current) => (current.focus?.roll || 0) >= 5
  },
  {
    id: 'ach-first-script',
    unlockLevel: 1,
    title: 'Roteiro no ar',
    desc: 'Criar o primeiro roteiro.',
    xp: 100,
    isUnlocked: (current) => (Array.isArray(current.scripts) ? current.scripts.length : 0) >= 1
  },
  {
    id: 'ach-first-contact',
    unlockLevel: 1,
    title: 'Primeiro contato',
    desc: 'Registrar a primeira marca.',
    xp: 100,
    isUnlocked: (current) => (Array.isArray(current.brands) ? current.brands.length : 0) >= 1
  },
  {
    id: 'ach-3-campaigns',
    unlockLevel: 2,
    title: 'Aquecimento',
    desc: 'Criar 3 campanhas.',
    xp: 150,
    isUnlocked: (current) => (Array.isArray(current.campaigns) ? current.campaigns.length : 0) >= 3
  },
  {
    id: 'ach-first-close',
    unlockLevel: 2,
    title: 'Primeiro fechado',
    desc: 'Finalizar 1 campanha.',
    xp: 150,
    isUnlocked: (current) =>
      (Array.isArray(current.campaigns) ? current.campaigns : []).filter((c) => ['finalizacao', 'concluida'].includes(c.status)).length >= 1
  },
  {
    id: 'ach-contacts-10',
    unlockLevel: 2,
    title: 'Agenda cheia',
    desc: 'Registrar 10 contatos com marcas.',
    xp: 200,
    isUnlocked: (current) => (Array.isArray(current.brands) ? current.brands.length : 0) >= 10
  },
  {
    id: 'ach-script-finisher',
    unlockLevel: 3,
    title: 'Roteiro redondinho',
    desc: 'Finalizar 3 roteiros.',
    xp: 200,
    isUnlocked: (current) =>
      (Array.isArray(current.scripts) ? current.scripts : []).filter((script) => Boolean(script.finalized)).length >= 3
  },
  {
    id: 'ach-2-closes',
    unlockLevel: 3,
    title: 'Dois fechados',
    desc: 'Finalizar 2 campanhas.',
    xp: 200,
    isUnlocked: (current) =>
      (Array.isArray(current.campaigns) ? current.campaigns : []).filter((campaign) => ['finalizacao', 'concluida'].includes(campaign.status)).length >= 2
  },
  {
    id: 'ach-level3',
    unlockLevel: 3,
    title: 'Subindo rápido',
    desc: 'Atingir o nível 3.',
    xp: 200,
    isUnlocked: (current) => (current.profile?.level || 0) >= 3
  },
  {
    id: 'ach-10-campaigns',
    unlockLevel: 4,
    title: 'Mão na massa',
    desc: 'Criar 10 campanhas.',
    xp: 250,
    isUnlocked: (current) => (Array.isArray(current.campaigns) ? current.campaigns.length : 0) >= 10
  }
];

const achievementCatalogById = new Map(achievementCatalog.map((achievement) => [achievement.id, achievement]));
const getAchievementById = (id) => achievementCatalogById.get(String(id)) || null;

const achievementOptionsByLevel = {
  1: ['ach-first-campaign', 'ach-first-script', 'ach-first-contact'],
  2: ['ach-streak7', 'ach-3-campaigns', 'ach-first-close', 'ach-contacts-10'],
  3: ['ach-writer', 'ach-script-finisher', 'ach-level3', 'ach-2-closes'],
  4: ['ach-production', 'ach-10-campaigns'],
  5: ['ach-level5', 'ach-deadlines-8'],
  6: ['ach-contact', 'ach-negotiations-3'],
  7: ['ach-finalizer', 'ach-focus-2'],
  8: ['ach-organizer', 'ach-scripts-15'],
  9: ['ach-clean-pipeline', 'ach-no-overdue'],
  10: ['ach-level10', 'ach-focus-5']
};

const formatCurrency = (value) => {
  const safeValue = Number.isFinite(value) ? Math.round(value) : 0;
  const stringValue = safeValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${stringValue}`;
};

const formatPercent = (value) => `${Math.round(value * 100)}%`;

export {
  STORAGE_KEY,
  PREFS_KEY,
  defaultState,
  statusLabels,
  campaignStatusOrder,
  campaignStagesByStatus,
  getCampaignStageOptions,
  getDefaultCampaignStage,
  getCampaignStageLabel,
  typeLabels,
  statusDot,
  brandStatuses,
  brandOptions,
  deepClone,
  mergeState,
  loadState,
  saveState,
  replaceState,
  enableRemoteSave,
  xpForLevel,
  formatCurrency,
  formatPercent,
  state,
  todayKey,
  weekKey,
  missionPool,
  weeklyChallengePool,
  focusPool,
  isCampaignActive,
  achievementPool,
  achievementCatalog,
  achievementOptionsByLevel,
  getAchievementById,
  hairItems,
  outfitItems,
  shoeItems
};




