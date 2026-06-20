(function () {
  const API_ENDPOINT = 'api/landing_track.php';
  const VISITOR_KEY = 'makerlineLandingVisitorId';
  const SESSION_KEY = 'makerlineLandingSessionMeta';
  const REFERRAL_ATTRIBUTION_KEY = 'makerlineLandingReferralAttribution';
  const INACTIVITY_MS = 30 * 60 * 1000;
  const SCROLL_MILESTONES = [25, 50, 75, 90];
  const pageLoadedAt = Date.now();
  const pageInstanceId = createId('page');

  const state = {
    visitorId: '',
    sessionId: '',
    sessionStartedAt: pageLoadedAt,
    maxScrollDepth: 0,
    sectionsSeen: new Set(),
    scrollMarks: new Set(),
    ctaHistory: [],
    lastCtaLabel: '',
    lastCtaId: '',
    lastSectionId: '',
    formStarted: false,
    formViewed: false,
    fieldFocuses: new Set(),
  };

  function createId(prefix) {
    const safePrefix = String(prefix || 'id').trim() || 'id';
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return `${safePrefix}-${window.crypto.randomUUID()}`;
      }
    } catch (error) {}

    return `${safePrefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
  }

  function safeSessionGet(key) {
    try {
      return sessionStorage.getItem(key) || '';
    } catch (error) {
      return '';
    }
  }

  function safeSessionSet(key, value) {
    try {
      sessionStorage.setItem(key, value);
    } catch (error) {}
  }

  function safeLocalGet(key) {
    try {
      return localStorage.getItem(key) || '';
    } catch (error) {
      return '';
    }
  }

  function safeLocalSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {}
  }

  function trimText(value, max = 255) {
    const safe = String(value || '').trim();
    if (!safe) return '';
    return safe.slice(0, max);
  }

  function normalizePartnerCode(value) {
    return trimText(value, 80)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function normalizeReferralCode(value) {
    return normalizePartnerCode(value);
  }

  function inferPartnerCode(referralCode) {
    const safeCode = normalizeReferralCode(referralCode);
    if (!safeCode) return '';
    if (safeCode.startsWith('keilabragante')) return 'keilabragante';
    if (safeCode.startsWith('rickolavo')) return 'rickolavo';
    return safeCode.replace(/-\d+$/, '') || safeCode;
  }

  function clearStoredAttribution() {
    try {
      localStorage.removeItem(REFERRAL_ATTRIBUTION_KEY);
      sessionStorage.removeItem(REFERRAL_ATTRIBUTION_KEY);
      localStorage.removeItem('makerlineReferralCode');
      sessionStorage.removeItem('makerlineReferralCode');
    } catch (error) {
    }
  }

  function writeStoredAttribution(attribution) {
    if (!attribution || typeof attribution !== 'object') return null;

    const referralCode = normalizeReferralCode(attribution.referralCode || attribution.ref || '');
    const partnerCode = normalizePartnerCode(attribution.partnerCode || attribution.origin || inferPartnerCode(referralCode));
    if (!referralCode && !partnerCode) return null;

    const payload = JSON.stringify({
      referralCode,
      partnerCode,
      capturedAt: new Date().toISOString(),
    });

    try {
      localStorage.setItem(REFERRAL_ATTRIBUTION_KEY, payload);
      sessionStorage.setItem(REFERRAL_ATTRIBUTION_KEY, payload);
    } catch (error) {}

    if (referralCode) {
      try {
        localStorage.setItem('makerlineReferralCode', referralCode);
        sessionStorage.setItem('makerlineReferralCode', referralCode);
      } catch (error) {}
    }

    return { referralCode, partnerCode };
  }

  function readOrCreateVisitorId() {
    const existing = safeLocalGet(VISITOR_KEY);
    if (existing) return existing;
    const next = createId('visitor');
    safeLocalSet(VISITOR_KEY, next);
    return next;
  }

  function readOrCreateSession() {
    const raw = safeSessionGet(SESSION_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        const id = trimText(parsed.id || '', 80);
        const startedAt = Number(parsed.startedAt) || 0;
        const lastSeenAt = Number(parsed.lastSeenAt) || 0;
        if (id && startedAt > 0 && lastSeenAt > 0 && Date.now() - lastSeenAt <= INACTIVITY_MS) {
          return { id, startedAt };
        }
      } catch (error) {}
    }

    const next = {
      id: createId('session'),
      startedAt: Date.now(),
      lastSeenAt: Date.now(),
    };
    safeSessionSet(SESSION_KEY, JSON.stringify(next));
    return next;
  }

  function persistSessionTouch() {
    safeSessionSet(
      SESSION_KEY,
      JSON.stringify({
        id: state.sessionId,
        startedAt: state.sessionStartedAt,
        lastSeenAt: Date.now(),
      })
    );
  }

  function detectDeviceType() {
    const width = window.innerWidth || document.documentElement.clientWidth || 0;
    if (width > 0 && width < 768) return 'mobile';
    if (width >= 768 && width < 1100) return 'tablet';
    if (width >= 1100) return 'desktop';
    return '';
  }

  function getUserAgent() {
    return trimText(navigator.userAgent || '', 500).toLowerCase();
  }

  function detectBrowser() {
    const ua = getUserAgent();
    if (!ua) return '';
    if (ua.includes('edg/')) return 'Edge';
    if (ua.includes('opr/') || ua.includes('opera')) return 'Opera';
    if (ua.includes('chrome/') && !ua.includes('chromium')) return 'Chrome';
    if (ua.includes('firefox/')) return 'Firefox';
    if (ua.includes('safari/') && !ua.includes('chrome/')) return 'Safari';
    return 'Outro';
  }

  function detectOs() {
    const ua = getUserAgent();
    if (!ua) return '';
    if (ua.includes('windows')) return 'Windows';
    if (ua.includes('android')) return 'Android';
    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) return 'iOS';
    if (ua.includes('mac os x') || ua.includes('macintosh')) return 'macOS';
    if (ua.includes('linux')) return 'Linux';
    return 'Outro';
  }

  function getReferrerHost() {
    const referrer = trimText(document.referrer, 500);
    if (!referrer) return '';
    try {
      return trimText(new URL(referrer).host, 160);
    } catch (error) {
      return '';
    }
  }

  function getUtmParams() {
    const params = new URLSearchParams(window.location.search || '');
    return {
      source: trimText(params.get('utm_source') || '', 120),
      medium: trimText(params.get('utm_medium') || '', 120),
      campaign: trimText(params.get('utm_campaign') || '', 160),
      content: trimText(params.get('utm_content') || '', 160),
      term: trimText(params.get('utm_term') || '', 160),
    };
  }

  function getReferralParams() {
    const params = new URLSearchParams(window.location.search || '');
    const referralCode = normalizeReferralCode(
      params.get('ref') || params.get('referralCode') || params.get('referral_code') || ''
    );
    const partnerCode = normalizePartnerCode(
      params.get('origin') || params.get('partner') || params.get('partnerCode') || inferPartnerCode(referralCode)
    );

    return {
      referralCode,
      partnerCode,
    };
  }

  function rememberPartnerAttribution() {
    const fromUrl = getReferralParams();
    if (fromUrl.referralCode || fromUrl.partnerCode) {
      return writeStoredAttribution(fromUrl);
    }

    clearStoredAttribution();
    return null;
  }

  function detectEnvironment() {
    const host = trimText(window.location.hostname || '', 160).toLowerCase();
    if (!host || host === 'localhost' || host === '127.0.0.1') return 'development';
    if (host.includes('staging') || host.includes('dev.')) return 'staging';
    return 'production';
  }

  function detectChannel() {
    const utm = getUtmParams();
    const referrerHost = getReferrerHost().toLowerCase();
    const haystack = `${utm.source} ${utm.medium} ${referrerHost}`.toLowerCase();

    if (!haystack.trim()) return 'Direto';
    if (haystack.includes('instagram') || haystack.includes('insta')) return 'Instagram';
    if (haystack.includes('tiktok')) return 'TikTok';
    if (haystack.includes('whatsapp') || haystack.includes('wa.me')) return 'WhatsApp';
    if (haystack.includes('google')) return 'Google';
    if (haystack.includes('facebook') || haystack.includes('meta')) return 'Facebook';
    return 'Outro';
  }

  function isTestEnvironment() {
    const environment = detectEnvironment();
    if (environment !== 'production') return true;

    const host = trimText(window.location.hostname || '', 160).toLowerCase();
    const href = trimText(window.location.href || '', 500).toLowerCase();
    return host.includes('localhost') || host.includes('127.0.0.1') || href.includes('staging');
  }

  function getEngagementSeconds() {
    return Math.max(0, Math.round((Date.now() - state.sessionStartedAt) / 1000));
  }

  function getScrollDepth() {
    const doc = document.documentElement;
    const body = document.body;
    const scrollTop = window.scrollY || doc.scrollTop || body.scrollTop || 0;
    const viewportHeight = window.innerHeight || doc.clientHeight || 0;
    const fullHeight = Math.max(
      body.scrollHeight || 0,
      doc.scrollHeight || 0,
      body.offsetHeight || 0,
      doc.offsetHeight || 0
    );

    if (fullHeight <= viewportHeight || viewportHeight <= 0) return 100;

    const percentage = Math.round(((scrollTop + viewportHeight) / fullHeight) * 100);
    return Math.max(0, Math.min(100, percentage));
  }

  function updateScrollDepth() {
    state.maxScrollDepth = Math.max(state.maxScrollDepth, getScrollDepth());
    return state.maxScrollDepth;
  }

  function buildBasePayload() {
    updateScrollDepth();
    const utm = getUtmParams();
    const attribution = rememberPartnerAttribution() || {};

    return {
      visitor_id: state.visitorId,
      session_id: state.sessionId,
      page_instance_id: pageInstanceId,
      page: 'landing',
      page_url: trimText(window.location.href || '', 500),
      page_path: trimText(window.location.pathname || '', 255),
      section_id: trimText(state.lastSectionId || '', 80),
      cta_id: trimText(state.lastCtaId || '', 80),
      referrer: trimText(document.referrer || '', 500),
      referrer_host: getReferrerHost(),
      referral_code: attribution.referralCode || '',
      partner_code: attribution.partnerCode || '',
      channel: detectChannel(),
      device_type: detectDeviceType(),
      browser: detectBrowser(),
      os: detectOs(),
      screen_width: Math.max(0, Math.round(window.screen?.width || window.innerWidth || 0)),
      screen_height: Math.max(0, Math.round(window.screen?.height || window.innerHeight || 0)),
      viewport_width: Math.max(0, Math.round(window.innerWidth || 0)),
      viewport_height: Math.max(0, Math.round(window.innerHeight || 0)),
      scroll_percent: state.maxScrollDepth,
      time_on_page: getEngagementSeconds(),
      session_started_at: new Date(state.sessionStartedAt).toISOString(),
      page_loaded_at: new Date(pageLoadedAt).toISOString(),
      hostname: trimText(window.location.hostname || '', 160),
      environment: detectEnvironment(),
      is_test: isTestEnvironment(),
      last_cta_label: trimText(state.lastCtaLabel || '', 180),
      seen_sections: Array.from(state.sectionsSeen),
      cta_history: state.ctaHistory.slice(-12),
      utm,
    };
  }

  function sendPayload(payload, options = {}) {
    if (window.location.protocol === 'file:') {
      return Promise.resolve();
    }

    const keepalive = Boolean(options.keepalive);
    const body = JSON.stringify(payload);

    if (keepalive) {
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon(API_ENDPOINT, new Blob([body], { type: 'application/json' }));
          return Promise.resolve();
        }
      } catch (error) {}
    }

    return fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body,
      keepalive,
    }).catch(() => null);
  }

  function track(eventName, extra = {}, options = {}) {
    persistSessionTouch();
    const payload = Object.assign(buildBasePayload(), extra, {
      id: trimText(extra.id || '', 120) || createId('evt'),
      event_name: trimText(eventName, 80),
      created_at: new Date().toISOString(),
    });

    return sendPayload(payload, options);
  }

  function rememberCta(ctaId, label) {
    const safeLabel = trimText(label, 180);
    if (safeLabel) {
      state.lastCtaLabel = safeLabel;
      state.ctaHistory.push(safeLabel);
      if (state.ctaHistory.length > 12) {
        state.ctaHistory.shift();
      }
    }
    state.lastCtaId = trimText(ctaId || '', 80);
  }

  function trackFormView() {
    if (state.formViewed) return;
    state.formViewed = true;
    state.lastSectionId = 'final-form';
    track('form_view', {
      id: `form-view:${pageInstanceId}`,
      form_id: 'waitlist-form',
      section_id: 'final-form',
    });
  }

  function trackFormStart(reason) {
    if (state.formStarted) return;
    state.formStarted = true;
    track('form_start', {
      id: `form-start:${pageInstanceId}`,
      form_id: 'waitlist-form',
      section_id: 'final-form',
      reason: trimText(reason || 'interaction', 120),
    });
  }

  function trackFieldFocus(fieldName) {
    const safeField = trimText(fieldName || '', 80);
    if (!safeField || state.fieldFocuses.has(safeField)) return;
    state.fieldFocuses.add(safeField);
    track('form_field_focus', {
      form_id: 'waitlist-form',
      form_field: safeField,
      section_id: 'final-form',
    });
  }

  function trackFieldBlur(fieldName) {
    const safeField = trimText(fieldName || '', 80);
    if (!safeField) return;
    track('form_field_blur', {
      form_id: 'waitlist-form',
      form_field: safeField,
      section_id: 'final-form',
    });
  }

  function trackWaitlistAttempt() {
    trackFormView();
    trackFormStart('submit');
    return track(
      'form_submit_attempt',
      {
        form_id: 'waitlist-form',
        section_id: 'final-form',
        cta_id: 'final_form_submit',
        status: 'attempt',
      },
      { keepalive: true }
    );
  }

  function trackWaitlistResult(ok, message) {
    const safeMessage = trimText(message || '', 220);
    const base = {
      form_id: 'waitlist-form',
      section_id: 'final-form',
      cta_id: 'final_form_submit',
      status: ok ? 'success' : 'error',
      message: safeMessage,
    };

    if (ok) {
      track('form_submit_success', base, { keepalive: true });
      return track('lead_created', base, { keepalive: true });
    }

    return track('form_error', base, { keepalive: true });
  }

  function captureWaitlistContext() {
    persistSessionTouch();
    return Object.assign(buildBasePayload(), {
      captured_at: new Date().toISOString(),
      cta_id: trimText(state.lastCtaId || '', 80),
      section_id: trimText(state.lastSectionId || 'final-form', 80),
    });
  }

  function flushSummary(reason) {
    return track(
      'session_summary',
      {
        id: `session-summary:${pageInstanceId}`,
        reason: trimText(reason || 'pagehide', 120),
      },
      { keepalive: true }
    );
  }

  function bindScrollTracking() {
    const onScroll = () => {
      const depth = updateScrollDepth();
      for (const milestone of SCROLL_MILESTONES) {
        if (depth < milestone || state.scrollMarks.has(milestone)) continue;
        state.scrollMarks.add(milestone);
        track('scroll_depth', {
          id: `scroll:${pageInstanceId}:${milestone}`,
          scroll_percent: milestone,
        });
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function bindSectionTracking() {
    const sections = Array.from(document.querySelectorAll('[data-section], [data-track-section]'));
    if (!sections.length || typeof window.IntersectionObserver !== 'function') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const sectionId = trimText(
            entry.target.getAttribute('data-section') || entry.target.getAttribute('data-track-section') || '',
            80
          );
          if (!sectionId) return;

          state.lastSectionId = sectionId;

          if (!state.sectionsSeen.has(sectionId)) {
            state.sectionsSeen.add(sectionId);
            track('section_view', {
              id: `section:${pageInstanceId}:${sectionId}`,
              section_id: sectionId,
              scroll_percent: getScrollDepth(),
            });
          }

          if (sectionId === 'final-form') {
            trackFormView();
          }
        });
      },
      {
        rootMargin: '0px 0px -12% 0px',
        threshold: 0.35,
      }
    );

    sections.forEach((section) => observer.observe(section));
  }

  function bindFormTracking() {
    const form = document.getElementById('waitlist-form');
    if (!form) return;

    form.addEventListener('focusin', (event) => {
      trackFormView();
      trackFormStart('focus');

      const field = event.target && event.target.name ? trimText(event.target.name, 80) : '';
      if (!field) return;
      if (field === 'name') trackFieldFocus('name');
      if (field === 'phone') trackFieldFocus('whatsapp');
      if (field === 'instagram') trackFieldFocus('instagram');
    });

    form.addEventListener('focusout', (event) => {
      const field = event.target && event.target.name ? trimText(event.target.name, 80) : '';
      if (!field) return;
      if (field === 'name') trackFieldBlur('name');
      if (field === 'phone') trackFieldBlur('whatsapp');
      if (field === 'instagram') trackFieldBlur('instagram');
    });

    form.addEventListener('input', () => {
      trackFormView();
      trackFormStart('input');
    });
  }

  function bindClickTracking() {
    document.addEventListener('click', (event) => {
      const cta = event.target.closest('[data-cta-id], [data-track-cta]');
      if (cta) {
        const ctaId = trimText(cta.getAttribute('data-cta-id') || '', 80);
        const label = trimText(cta.getAttribute('data-track-cta') || cta.textContent || 'CTA', 180);
        rememberCta(ctaId, label);

        let inferredSectionId = state.lastSectionId;
        if (!inferredSectionId && ctaId === 'header_cta') inferredSectionId = 'hero';
        if (!inferredSectionId && ctaId === 'footer_cta') inferredSectionId = 'footer';

        track(
          'cta_click',
          {
            cta_id: ctaId,
            cta_label: label,
            section_id: trimText(inferredSectionId || '', 80),
            href: trimText(cta.getAttribute('href') || '', 500),
          },
          { keepalive: true }
        );
        return;
      }

      const externalLink = event.target.closest('[data-track-link]');
      if (externalLink) {
        track(
          'external_link_click',
          {
            cta_label: trimText(
              externalLink.getAttribute('data-track-link') || externalLink.textContent || 'Link externo',
              180
            ),
            href: trimText(externalLink.getAttribute('href') || '', 500),
            section_id: trimText(state.lastSectionId || 'social-proof', 80),
          },
          { keepalive: true }
        );
      }
    });
  }

  function init() {
    const visitorId = readOrCreateVisitorId();
    const session = readOrCreateSession();

    state.visitorId = visitorId;
    state.sessionId = session.id;
    state.sessionStartedAt = Number(session.startedAt) || Date.now();

    persistSessionTouch();

    track('session_start', {
      id: `session-start:${pageInstanceId}`,
    });

    track('page_view', {
      id: `page-view:${pageInstanceId}`,
    });

    bindScrollTracking();
    bindSectionTracking();
    bindClickTracking();
    bindFormTracking();

    window.addEventListener('pagehide', () => {
      flushSummary('pagehide');
    });

    window.addEventListener('beforeunload', () => {
      flushSummary('beforeunload');
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flushSummary('hidden');
      }
    });
  }

  window.MakerlineLandingTracker = {
    captureWaitlistContext,
    flushSummary,
    track,
    trackFormStart,
    trackWaitlistAttempt,
    trackWaitlistResult,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
