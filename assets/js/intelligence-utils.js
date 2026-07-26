const DAY_MS = 86400000;

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const daysSince = (value, now = new Date()) => {
  const date = parseDate(value);
  if (!date) return null;
  return Math.floor((now.getTime() - date.getTime()) / DAY_MS);
};

const startOfDay = (value) => {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const formatDate = (date) => {
  const safe = parseDate(date);
  if (!safe) return 'Sem dado';
  const datePart = safe.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timePart = safe.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${datePart} • ${timePart}`;
};

const formatShortDate = (date) => {
  const safe = parseDate(date);
  if (!safe) return 'Sem dado';
  return safe.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  });
};

const formatDuration = (seconds) => {
  const safe = Math.max(0, Math.floor(safeNumber(seconds)));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
};

const getInitials = (name, email = '') => {
  const source = String(name || email || '').trim();
  if (!source) return 'ML';
  const words = source.split(/\s+/).filter(Boolean).slice(0, 2);
  return words.map((word) => word[0]).join('').toUpperCase();
};

const estimateAccessWindow = (user, days) => {
  const total = safeNumber(user.accessCount);
  const lastActivityDays = daysSince(user.lastSeenAt);
  const activeDaysThisWeek = Array.isArray(user.activitySignals?.dailyCompleteDays)
    ? user.activitySignals.dailyCompleteDays.length
    : 0;

  if (total <= 0) return 0;
  if (lastActivityDays === null || lastActivityDays > days) return 0;

  const base = days === 7
    ? Math.max(activeDaysThisWeek, Math.min(total, Math.round(total * 0.3)))
    : Math.max(activeDaysThisWeek, Math.min(total, Math.round(total * 0.65)));

  if (lastActivityDays <= 1) return Math.max(base, Math.min(total, 3));
  if (lastActivityDays <= 3) return Math.max(base, Math.min(total, 2));
  return Math.max(1, Math.min(total, base));
};

const calculateOnboardingProgress = (user) => {
  const steps = Array.isArray(user.onboarding?.steps) ? user.onboarding.steps : [];
  if (!steps.length) {
    return {
      completedSteps: 0,
      totalSteps: 0,
      percentage: 0,
      stalledAt: 'Sem dados suficientes',
      steps: [],
    };
  }

  const completedSteps = steps.filter((step) => step.completed).length;
  const totalSteps = steps.length;
  const percentage = totalSteps ? Math.round((completedSteps / totalSteps) * 100) : 0;
  const firstPending = steps.find((step) => !step.completed);

  return {
    completedSteps,
    totalSteps,
    percentage,
    stalledAt: firstPending ? firstPending.label : 'Onboarding concluído',
    steps,
  };
};

const getUserHealthStatus = (score) => {
  if (score >= 80) return { key: 'healthy', label: 'Saudável', tone: 'success' };
  if (score >= 50) return { key: 'attention', label: 'Atenção', tone: 'warning' };
  if (score >= 20) return { key: 'risk', label: 'Risco', tone: 'danger' };
  return { key: 'inactive', label: 'Inativo', tone: 'muted' };
};

const calculateHealthScore = (user) => {
  let score = 100;
  const reasons = [];

  const lastLoginDays = daysSince(user.lastLoginAt);
  const lastActivityDays = daysSince(user.lastSeenAt);
  const campaignCount = safeNumber(user.campaignCount);
  const activeCampaignCount = safeNumber(user.activeCampaignCount);
  const totalAccesses = safeNumber(user.accessCount);
  const totalTime = safeNumber(user.timeSpentSeconds);
  const averageSessionSeconds = totalAccesses > 0 ? Math.round(totalTime / totalAccesses) : 0;
  const onboarding = calculateOnboardingProgress(user);

  if (lastLoginDays === null) {
    score -= 28;
    reasons.push('Conta sem login registrado');
  } else if (lastLoginDays > 21) {
    score -= 30;
    reasons.push('Sem login há mais de 21 dias');
  } else if (lastLoginDays > 14) {
    score -= 22;
    reasons.push('Sem login há mais de 14 dias');
  } else if (lastLoginDays > 7) {
    score -= 12;
    reasons.push('Sem login recente');
  }

  if (lastActivityDays === null) {
    score -= 18;
    reasons.push('Sem atividade registrada');
  } else if (lastActivityDays > 14) {
    score -= 18;
    reasons.push('Atividade estagnada');
  } else if (lastActivityDays > 7) {
    score -= 10;
    reasons.push('Baixa atividade recente');
  }

  if (campaignCount === 0) {
    score -= 16;
    reasons.push('Nenhuma campanha criada');
  } else if (campaignCount >= 3) {
    score += 5;
  }

  if (activeCampaignCount === 0 && campaignCount > 0) {
    score -= 10;
    reasons.push('Sem campanhas ativas');
  } else if (activeCampaignCount > 0) {
    score += 6;
  }

  if (totalAccesses === 0) {
    score -= 16;
    reasons.push('Nunca usou o app');
  } else if (totalAccesses >= 8) {
    score += 6;
  }

  if (averageSessionSeconds < 60 && totalAccesses > 0) {
    score -= 8;
    reasons.push('Sessões muito curtas');
  } else if (averageSessionSeconds >= 240) {
    score += 5;
  }

  if (onboarding.totalSteps > 0) {
    if (onboarding.percentage < 40) {
      score -= 16;
      reasons.push(`Onboarding travado em ${onboarding.stalledAt.toLowerCase()}`);
    } else if (onboarding.percentage < 80) {
      score -= 8;
    } else {
      score += 6;
    }
  }

  if (Array.isArray(user.activitySignals?.campaignUpdateDays) && user.activitySignals.campaignUpdateDays.length >= 3) {
    score += 4;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const status = getUserHealthStatus(score);
  const topReason = reasons[0] || (status.key === 'healthy' ? 'Uso consistente e sinais de ativação' : 'Base limitada para diagnóstico');

  return {
    score,
    status,
    reason: topReason,
    reasons,
  };
};

const getRecommendedAction = (user) => calculateChurnRisk(user).recommendedAction;

function calculateChurnRisk(user) {
  const lastLoginDays = daysSince(user.lastLoginAt);
  const lastActivityDays = daysSince(user.lastSeenAt);
  const health = calculateHealthScore(user);
  const onboarding = calculateOnboardingProgress(user);
  const campaignCount = safeNumber(user.campaignCount);
  const activeCampaignCount = safeNumber(user.activeCampaignCount);
  const totalAccesses = safeNumber(user.accessCount);
  const averageSessionSeconds = totalAccesses > 0 ? Math.round(safeNumber(user.timeSpentSeconds) / totalAccesses) : 0;

  const reasons = [];
  let severity = 0;

  if (lastLoginDays === null && totalAccesses === 0) {
    severity = Math.max(severity, 4);
    reasons.push('Criou conta mas nunca acessou');
  } else if (lastLoginDays !== null && lastLoginDays > 14) {
    severity = Math.max(severity, 3);
    reasons.push('Sem login há mais de 14 dias');
  } else if (lastLoginDays !== null && lastLoginDays > 7) {
    severity = Math.max(severity, 2);
    reasons.push('Sem login há mais de 7 dias');
  }

  if (lastActivityDays !== null && lastActivityDays > 14) {
    severity = Math.max(severity, 3);
    reasons.push('Atividade interrompida há mais de 14 dias');
  } else if (lastActivityDays !== null && lastActivityDays > 7) {
    severity = Math.max(severity, 2);
    reasons.push('Queda de uso recente');
  }

  if (campaignCount === 0) {
    severity = Math.max(severity, 3);
    reasons.push('Nenhuma campanha criada');
  }

  if (campaignCount > 0 && activeCampaignCount === 0) {
    severity = Math.max(severity, 2);
    reasons.push('Nenhuma campanha ativa');
  }

  if (averageSessionSeconds > 0 && averageSessionSeconds < 75) {
    severity = Math.max(severity, 2);
    reasons.push('Tempo médio baixo no app');
  }

  if (onboarding.percentage < 100) {
    severity = Math.max(severity, onboarding.percentage < 40 ? 3 : 2);
    reasons.push(`Onboarding incompleto em ${onboarding.stalledAt.toLowerCase()}`);
  }

  if (health.score <= 19) {
    severity = Math.max(severity, 4);
  } else if (health.score <= 49) {
    severity = Math.max(severity, 3);
  } else if (health.score <= 79) {
    severity = Math.max(severity, 2);
  } else {
    severity = Math.max(severity, 1);
  }

  let level = 'low';
  let label = 'Baixo';
  let recommendedAction = 'Acompanhar normalmente';

  if (severity >= 4) {
    level = 'critical';
    label = 'Crítico';
    recommendedAction = totalAccesses === 0
      ? 'Orientar onboarding inicial'
      : 'Entrar em contato manualmente';
  } else if (severity === 3) {
    level = 'high';
    label = 'Alto';
    recommendedAction = campaignCount === 0
      ? 'Incentivar criação da primeira campanha'
      : 'Enviar mensagem de reativação';
  } else if (severity === 2) {
    level = 'medium';
    label = 'Médio';
    recommendedAction = 'Investigar queda de uso';
  }

  return {
    level,
    label,
    reasons: reasons.slice(0, 4),
    recommendedAction,
  };
}

const getActivityTimeline = (user) => {
  const events = [];
  const pushEvent = (date, title, description, tone = 'default') => {
    const safe = parseDate(date);
    if (!safe) return;
    events.push({
      date: safe.toISOString(),
      title,
      description,
      tone,
    });
  };

  pushEvent(user.createdAt, 'Conta criada', 'Usuário entrou na base Makerline.', 'info');
  pushEvent(user.lastLoginAt, 'Login registrado', 'Último login disponível no sistema.', 'default');
  pushEvent(user.firstCampaignCreatedAt, 'Primeira campanha criada', 'Primeiro sinal de ativação operacional.', 'success');
  pushEvent(user.firstActiveCampaignAt, 'Primeira campanha ativa', 'Entrou em execução com campanha ativa.', 'success');
  pushEvent(user.lastSeenAt, 'Última atividade', 'Última presença registrada no app.', 'default');

  const inactivityDays = daysSince(user.lastSeenAt);
  if (inactivityDays !== null && inactivityDays >= 7) {
    pushEvent(new Date(), 'Período de inatividade detectado', `Sem atividade há ${inactivityDays} dias.`, inactivityDays >= 14 ? 'danger' : 'warning');
  }

  return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

const normalizeUser = (user) => {
  const onboarding = calculateOnboardingProgress(user);
  const health = calculateHealthScore(user);
  const churn = calculateChurnRisk(user);
  const averageSessionSeconds = safeNumber(user.accessCount) > 0
    ? Math.round(safeNumber(user.timeSpentSeconds) / safeNumber(user.accessCount))
    : 0;
  const accesses7d = estimateAccessWindow(user, 7);
  const accesses30d = estimateAccessWindow(user, 30);
  const trend = health.score >= 80 ? 'up' : health.score >= 50 ? 'flat' : 'down';

  return {
    ...user,
    initials: getInitials(user.name, user.email),
    onboardingProgress: onboarding,
    health,
    churn,
    recommendedAction: churn.recommendedAction,
    totalTimeLabel: formatDuration(user.timeSpentSeconds),
    averageSessionSeconds,
    averageSessionLabel: formatDuration(averageSessionSeconds),
    accesses7d,
    accesses30d,
    trend,
    timeline: getActivityTimeline(user),
  };
};

const filterUsers = (users, filters) => {
  const list = Array.isArray(users) ? users : [];
  const query = String(filters?.query || '').trim().toLowerCase();

  return list.filter((user) => {
    if (query) {
      const haystack = `${user.name || ''} ${user.email || ''}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    if (filters?.onboarding && filters.onboarding !== 'all') {
      const complete = user.onboardingProgress.percentage >= 100;
      if (filters.onboarding === 'complete' && !complete) return false;
      if (filters.onboarding === 'incomplete' && complete) return false;
    }

    if (filters?.contactOnly && !user.markedForContact) return false;

    return true;
  });
};

const getSortValue = (user, option) => {
  switch (option) {
    case 'last_login':
      return parseDate(user.lastLoginAt)?.getTime() || 0;
    case 'last_activity':
      return parseDate(user.lastSeenAt)?.getTime() || 0;
    case 'accesses':
      return safeNumber(user.accessCount);
    case 'time_total':
      return safeNumber(user.timeSpentSeconds);
    case 'campaigns':
      return safeNumber(user.campaignCount);
    case 'onboarding':
      return safeNumber(user.onboardingProgress?.percentage);
    case 'created_at':
      return parseDate(user.createdAt)?.getTime() || 0;
    default:
      return parseDate(user.lastSeenAt)?.getTime() || 0;
  }
};

const sortUsers = (users, sortOption) => {
  const list = [...(Array.isArray(users) ? users : [])];
  return list.sort((a, b) => {
    const diff = getSortValue(b, sortOption) - getSortValue(a, sortOption);
    if (diff !== 0) return diff;
    return String(a.name || a.email || '').localeCompare(String(b.name || b.email || ''), 'pt-BR');
  });
};

const buildDashboardStats = (users) => {
  const total = users.length;
  const now = new Date();
  const lastWeek = now.getTime() - 7 * DAY_MS;
  const lastMonth = now.getTime() - 30 * DAY_MS;

  const active7d = users.filter((user) => {
    const date = parseDate(user.lastSeenAt);
    return date && date.getTime() >= lastWeek;
  }).length;

  const active30d = users.filter((user) => {
    const date = parseDate(user.lastSeenAt);
    return date && date.getTime() >= lastMonth;
  }).length;

  const newUsersWeek = users.filter((user) => {
    const date = parseDate(user.createdAt);
    return date && date.getTime() >= lastWeek;
  }).length;

  const atRisk = users.filter((user) => ['high', 'critical'].includes(user.churn.level)).length;
  const inactive = users.filter((user) => user.health.status.key === 'inactive').length;
  const onboardingIncomplete = users.filter((user) => user.onboardingProgress.percentage < 100).length;

  const totalTimeSeconds = users.reduce((acc, user) => acc + safeNumber(user.timeSpentSeconds), 0);
  const campaignsCreated = users.reduce((acc, user) => acc + safeNumber(user.campaignCount), 0);
  const campaignsActive = users.reduce((acc, user) => acc + safeNumber(user.activeCampaignCount), 0);
  const activationRate = total ? Math.round((users.filter((user) => safeNumber(user.campaignCount) > 0).length / total) * 100) : 0;
  const averageTime = total ? Math.round(totalTimeSeconds / total) : 0;

  const criticalUsers = sortUsers(users.filter((user) => ['high', 'critical'].includes(user.churn.level)), 'risk').slice(0, 5);
  const primaryAction = criticalUsers[0]?.recommendedAction || (onboardingIncomplete > 0 ? 'Orientar onboarding inicial' : 'Acompanhar normalmente');

  return {
    total,
    newUsersWeek,
    active7d,
    active30d,
    atRisk,
    inactive,
    onboardingIncomplete,
    activationRate,
    averageTime,
    campaignsCreated,
    campaignsActive,
    criticalUsers,
    primaryAction,
  };
};

const buildDailySeries = (users, field, days = 30) => {
  const map = new Map();
  const today = startOfDay(new Date());
  for (let i = days - 1; i >= 0; i -= 1) {
    const day = new Date(today.getTime() - i * DAY_MS);
    const key = day.toISOString().slice(0, 10);
    map.set(key, 0);
  }

  users.forEach((user) => {
    const date = parseDate(user[field]);
    if (!date) return;
    const key = startOfDay(date)?.toISOString().slice(0, 10);
    if (!key || !map.has(key)) return;
    map.set(key, map.get(key) + 1);
  });

  return Array.from(map.entries()).map(([key, value]) => ({
    key,
    label: formatShortDate(key),
    value,
  }));
};

// Conta pelo id do passo, e nao pela posicao dele na lista: contar por posicao assumia que
// o onboarding e sempre concluido em ordem e quebrava sempre que um passo novo era inserido.
const hasCompletedStep = (user, stepId) =>
  (user.onboardingProgress?.steps || []).some((step) => step.id === stepId && step.completed);

const buildChartsData = (users) => {
  const onboardingFunnel = [
    { label: 'Conta criada', value: users.length },
    { label: 'Primeiro login', value: users.filter((user) => hasCompletedStep(user, 'first_login')).length },
    { label: 'Primeira campanha', value: users.filter((user) => hasCompletedStep(user, 'first_campaign_created')).length },
    { label: 'Campanha ativa', value: users.filter((user) => hasCompletedStep(user, 'first_campaign_activated')).length },
    { label: 'Prospecção', value: users.filter((user) => hasCompletedStep(user, 'first_prospection_created')).length },
    { label: 'Retorno 7d', value: users.filter((user) => hasCompletedStep(user, 'returned_after_7_days')).length },
  ];

  return {
    activeSeries: buildDailySeries(users, 'lastSeenAt', 30),
    onboardingFunnel,
    campaignComparison: [
      { label: 'Criadas', value: users.reduce((acc, user) => acc + safeNumber(user.campaignCount), 0) },
      { label: 'Ativas', value: users.reduce((acc, user) => acc + safeNumber(user.activeCampaignCount), 0) },
    ],
  };
};

export {
  buildChartsData,
  buildDashboardStats,
  calculateChurnRisk,
  calculateHealthScore,
  calculateOnboardingProgress,
  filterUsers,
  formatDate,
  formatDuration,
  formatShortDate,
  getActivityTimeline,
  getInitials,
  getRecommendedAction,
  getUserHealthStatus,
  normalizeUser,
  safeNumber,
  sortUsers,
};
