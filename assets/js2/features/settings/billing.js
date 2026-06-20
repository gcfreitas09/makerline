const DEFAULT_BILLING = {
  loaded: false,
  loading: true,
  plan: 'free',
  status: 'free',
  interval: null,
  hasPremiumAccess: false,
  hasFullAccess: false,
  isInternalAccess: false,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  portalAvailable: false,
  isFreeTier: true,
  priceId: null,
  customerId: null,
  subscriptionId: null
};

const getPendingCheckoutPlanKey = () => {
  const userId = String(getSessionUserId() || '').trim();
  return userId ? `ugcQuestPendingCheckoutPlan:${userId}` : '';
};

const readPendingCheckoutPlan = () => {
  const key = getPendingCheckoutPlanKey();
  if (!key) return '';
  try {
    const raw = String(sessionStorage.getItem(key) || localStorage.getItem(key) || '').trim();
    return ['monthly', 'annual'].includes(raw) ? raw : '';
  } catch (error) {
    return '';
  }
};

const writePendingCheckoutPlan = (plan) => {
  const key = getPendingCheckoutPlanKey();
  if (!key) return;

  const safePlan = ['monthly', 'annual'].includes(String(plan || '').trim()) ? String(plan).trim() : '';
  try {
    if (!safePlan) {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
      return;
    }

    sessionStorage.setItem(key, safePlan);
    localStorage.setItem(key, safePlan);
  } catch (error) {}
};

const clearPendingCheckoutPlan = () => writePendingCheckoutPlan('');

const normalizeBilling = (billing = {}, options = {}) => {
  const loaded = options.loaded !== undefined ? Boolean(options.loaded) : Boolean(billing.loaded);
  const loading = options.loading !== undefined ? Boolean(options.loading) : Boolean(billing.loading);
  const rawPlan = ['free', 'monthly', 'annual', 'internal'].includes(String(billing.plan || '').trim())
    ? String(billing.plan).trim()
    : 'free';
  const rawStatus = String(billing.status || (rawPlan === 'free' ? 'free' : 'active')).trim() || 'free';
  const internalAccess = Boolean(billing.isInternalAccess) || rawPlan === 'internal' || rawStatus === 'internal';
  const plan = internalAccess && rawPlan === 'free' ? 'internal' : rawPlan;
  const status = internalAccess && rawStatus === 'free' ? 'internal' : rawStatus;
  const hasPremiumAccess =
    Boolean(billing.hasPremiumAccess) ||
    plan === 'monthly' ||
    plan === 'annual' ||
    plan === 'internal' ||
    ['active', 'trialing', 'internal'].includes(status);

  return {
    ...DEFAULT_BILLING,
    ...billing,
    loaded,
    loading,
    plan,
    status,
    hasPremiumAccess,
    isInternalAccess: internalAccess,
    hasFullAccess: Boolean(billing.hasFullAccess) || internalAccess || hasPremiumAccess || plan !== 'free',
    isFreeTier: plan === 'free' && !hasPremiumAccess
  };
};

const getSessionUserId = () => {
  try {
    return sessionStorage.getItem('ugcQuestUserId') || localStorage.getItem('ugcQuestSessionUserId') || '';
  } catch (error) {
    try {
      return localStorage.getItem('ugcQuestSessionUserId') || '';
    } catch (fallbackError) {
      return '';
    }
  }
};

const getBillingCacheKey = () => {
  const userId = String(getSessionUserId() || '').trim();
  return userId ? `ugcQuestBilling:${userId}` : '';
};

const readCachedBilling = () => {
  const key = getBillingCacheKey();
  if (!key) return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    if (!parsed || typeof parsed !== 'object') return null;
    return normalizeBilling(parsed, { loaded: Boolean(parsed.loaded), loading: false });
  } catch (error) {
    return null;
  }
};

const writeCachedBilling = (billing) => {
  const key = getBillingCacheKey();
  if (!key || !billing || typeof billing !== 'object') return;
  try {
    localStorage.setItem(
      key,
      JSON.stringify({
        ...billing,
        loaded: true,
        loading: false,
        cachedAt: new Date().toISOString()
      })
    );
  } catch (error) {}
};

const cachedBilling = readCachedBilling();
let currentBilling = cachedBilling || { ...DEFAULT_BILLING };

const getSessionToken = () => {
  try {
    return sessionStorage.getItem('ugcQuestToken') || localStorage.getItem('ugcQuestSessionToken') || localStorage.getItem('ugcQuestToken') || '';
  } catch (error) {
    return '';
  }
};

const getReferralCode = () => {
  try {
    return String(
      sessionStorage.getItem('makerlineReferralCode') ||
        localStorage.getItem('makerlineReferralCode') ||
        ''
    )
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  } catch (error) {
    return '';
  }
};

const clearSessionAndRedirect = () => {
  try {
    ['ugcQuestLoggedIn', 'ugcQuestToken', 'ugcQuestUserId', 'ugcQuestUserEmail', 'ugcQuestUserName'].forEach((key) =>
      sessionStorage.removeItem(key)
    );
  } catch (error) {}

  try {
    [
      'ugcQuestSessionLoggedIn',
      'ugcQuestSessionToken',
      'ugcQuestSessionUserId',
      'ugcQuestSessionUserEmail',
      'ugcQuestSessionUserName',
      'ugcQuestToken',
      'ugcQuestUserId',
      'ugcQuestUserEmail',
      'ugcQuestUserName'
    ].forEach((key) => localStorage.removeItem(key));
  } catch (error) {}

  try {
    window.location.replace('app.html');
  } catch (error) {}
};

const isAuthError = (res, data) => {
  if (Number(res.status) === 401) return true;
  const message = String((data && data.error) || '').toLowerCase();
  return (
    message.includes('sessão inválida') ||
    message.includes('sessao invalida') ||
    message.includes('sessão expirada') ||
    message.includes('sessao expirada')
  );
};

const setBillingMessage = (text) => {
  void text;
};

const getBillingNotice = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const code = String(params.get('billing') || '').trim();
    if (code === 'success') return 'Pagamento confirmado. Assim que a Stripe terminar a sincronização, seu plano aparece aqui.';
    if (code === 'cancel') return 'Checkout cancelado. Você continua no plano grátis.';
    if (code === 'portal') return 'Você voltou do portal de cobrança.';
    if (code === 'test_success') return 'Teste Stripe concluído. Confira a cobrança de R$ 0,50 no dashboard da Stripe.';
    if (code === 'test_cancel') return 'Teste Stripe cancelado antes do pagamento.';
  } catch (error) {}
  return '';
};

const getBillingSnapshot = () => ({ ...currentBilling });

const hasPremiumAccess = () => Boolean(currentBilling.hasPremiumAccess);

const applyOptimisticBillingPlanFromPending = () => {
  const pendingPlan = readPendingCheckoutPlan();
  if (!pendingPlan) return getBillingSnapshot();

  currentBilling = normalizeBilling({
    ...currentBilling,
    plan: pendingPlan,
    status: 'active',
    hasPremiumAccess: true,
    hasFullAccess: true,
    isFreeTier: false
  }, { loaded: true, loading: false });

  writeCachedBilling(currentBilling);
  return getBillingSnapshot();
};

const refreshBillingStatus = async () => {
  const token = getSessionToken();
  if (!token || window.location.protocol === 'file:') {
    currentBilling = { ...DEFAULT_BILLING, loaded: true, loading: false };
    return getBillingSnapshot();
  }

  currentBilling = { ...currentBilling, loading: true };

  try {
    let checkoutSessionId = '';
    try {
      checkoutSessionId = String(new URLSearchParams(window.location.search).get('session_id') || '').trim();
    } catch (error) {}

    const res = await fetch('api/billing_status.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, checkoutSessionId })
    });

    const data = await res.json().catch(() => null);
    if (isAuthError(res, data)) {
      clearSessionAndRedirect();
      return getBillingSnapshot();
    }

    if (!res.ok || !data || typeof data.billing !== 'object') {
      currentBilling = normalizeBilling(currentBilling, { loaded: true, loading: false });
      return getBillingSnapshot();
    }

    currentBilling = normalizeBilling(data.billing, { loaded: true, loading: false });
    if (currentBilling.hasPremiumAccess || ['monthly', 'annual', 'internal'].includes(String(currentBilling.plan || '').trim())) {
      clearPendingCheckoutPlan();
    }
    writeCachedBilling(currentBilling);
    return getBillingSnapshot();
  } catch (error) {
    currentBilling = normalizeBilling(currentBilling, { loaded: true, loading: false });
    return getBillingSnapshot();
  }
};

const waitForBillingActivation = async ({ attempts = 6, delayMs = 1500 } = {}) => {
  let snapshot = getBillingSnapshot();

  for (let index = 0; index < attempts; index += 1) {
    snapshot = await refreshBillingStatus();
    if (snapshot.plan === 'monthly' || snapshot.plan === 'annual' || snapshot.hasPremiumAccess) {
      return snapshot;
    }

    if (index < attempts - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, delayMs));
    }
  }

  return snapshot;
};

const redirectToBillingUrl = (url, { newTab = false } = {}) => {
  const safe = String(url || '').trim();
  if (!safe) throw new Error('URL de billing ausente.');

  if (newTab) {
    const opened = window.open(safe, '_blank');
    if (opened) return;
  }

  window.location.assign(safe);
};

const submitBillingRedirect = (action, fields, options = {}) => {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = action;
  form.target = options.target || '_self';
  form.style.display = 'none';

  Object.entries(fields || {}).forEach(([name, value]) => {
    if (value === null || value === undefined) return;
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = String(value);
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
  window.setTimeout(() => form.remove(), 0);
};

const openBillingCheckout = (plan) => {
  const token = getSessionToken();
  if (!token) {
    clearSessionAndRedirect();
    return false;
  }

  try {
    const safePlan = ['monthly', 'annual'].includes(String(plan || '').trim()) ? String(plan).trim() : '';
    if (!safePlan) {
      setBillingMessage('Plano inválido.');
      return false;
    }
    if (currentBilling.hasPremiumAccess) {
      if (currentBilling.portalAvailable) {
        void openBillingPortal();
      } else {
        setBillingMessage('Sua conta já tem um plano ativo.');
      }
      return false;
    }

    writePendingCheckoutPlan(safePlan);
    submitBillingRedirect('api/billing_checkout.php', {
      token,
      plan: safePlan,
      referralCode: getReferralCode(),
      redirect: '1'
    });
    return true;
  } catch (error) {
    setBillingMessage('Não consegui abrir o checkout agora.');
    return false;
  }
};

const openBillingPortal = async () => {
  const token = getSessionToken();
  if (!token) {
    clearSessionAndRedirect();
    return false;
  }

  try {
    const res = await fetch('api/billing_portal.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });

    const data = await res.json().catch(() => null);
    if (isAuthError(res, data)) {
      clearSessionAndRedirect();
      return false;
    }

    if (!res.ok || !data.url) {
      setBillingMessage(data.error || 'Não consegui abrir o portal agora.');
      return false;
    }

    redirectToBillingUrl(data.url);
    return true;
  } catch (error) {
    setBillingMessage('Não consegui abrir o portal agora.');
    return false;
  }
};

const openStripeTestCheckout = () => {
  const token = getSessionToken();
  if (!token) {
    clearSessionAndRedirect();
    return false;
  }

  try {
    submitBillingRedirect('api/billing_test_checkout.php', {
      token,
      redirect: '1'
    }, { target: '_blank' });
    return true;
  } catch (error) {
    setBillingMessage('Não consegui abrir o teste da Stripe agora.');
    return false;
  }
};

const loadStripeDiagnostics = async () => {
  const token = getSessionToken();
  if (!token) return null;

  try {
    const res = await fetch('api/billing_diagnostics.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data || !data.stripe) return null;
    return data.stripe;
  } catch (error) {
    return null;
  }
};

if (typeof window !== 'undefined') {
  window.__ugcBilling = {
    applyOptimisticBillingPlanFromPending,
    clearPendingCheckoutPlan,
    getBillingSnapshot,
    hasPremiumAccess,
    refreshBillingStatus,
    writeCachedBilling
  };
}

export { applyOptimisticBillingPlanFromPending, clearPendingCheckoutPlan, getBillingNotice, getBillingSnapshot, hasPremiumAccess, loadStripeDiagnostics, openBillingCheckout, openBillingPortal, openStripeTestCheckout, refreshBillingStatus, waitForBillingActivation, writeCachedBilling };
