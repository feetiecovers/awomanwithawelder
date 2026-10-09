const CONSENT_KEY = 'awww_analytics_consent';
const LEGACY_CONSENT_KEY = 'denvers_desk_analytics_consent';
const DEFAULT_WEBSITE_ID = 'web-awww-2026';
const DEFAULT_ENDPOINT = 'https://denver-s-desk.onrender.com/api/analytics/events';

export type ConsentStatus = 'granted' | 'denied' | null;

interface TrackerConfig {
  websiteId: string;
  collectorKey: string;
  endpoint: string;
  crossDomainDomains?: string[];
  autoTrackPageViews?: boolean;
}

interface TrackOptions {
  correlationId?: string;
}

interface TrackerInstance {
  sessionId: string;
  attributionId?: string;
  track: (eventName: string, properties?: Record<string, any>, options?: TrackOptions) => Promise<void>;
  setCorrelationId: (correlationId: string) => void;
  decorateCrossDomainLinks: () => void;
}

let tracker: TrackerInstance | null = null;

function getEnvConfig(): TrackerConfig {
  const env = (import.meta as any).env || {};
  return {
    websiteId: env.VITE_WEBSITE_ID || DEFAULT_WEBSITE_ID,
    collectorKey: env.VITE_DD_ANALYTICS_COLLECTOR_KEY || 'ddac_awww',
    endpoint: env.VITE_DD_ANALYTICS_ENDPOINT || DEFAULT_ENDPOINT,
    crossDomainDomains: (env.VITE_DD_ANALYTICS_CROSS_DOMAIN_DOMAINS || '')
      .split(',')
      .map((d: string) => d.trim())
      .filter(Boolean),
  };
}

export function isDenverDeskAnalyticsConfigured(): boolean {
  const { websiteId, endpoint } = getEnvConfig();
  return Boolean(websiteId && endpoint);
}

export function getAnalyticsConsent(): ConsentStatus {
  try {
    const current = window.localStorage.getItem(CONSENT_KEY);
    if (current === 'granted' || current === 'denied') return current;
    
    // Check legacy key
    const legacy = window.localStorage.getItem(LEGACY_CONSENT_KEY);
    if (legacy === 'granted' || legacy === 'denied') return legacy;
    
    return null;
  } catch {
    return null;
  }
}

export function setAnalyticsConsent(value: 'granted' | 'denied'): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
    window.localStorage.setItem(LEGACY_CONSENT_KEY, value);
  } catch {
    /* Consent choice still applies in-memory */
  }
}

function newIdentifier(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

function storageGet(key: string): string | undefined {
  try {
    return window.sessionStorage.getItem(key) || undefined;
  } catch {
    return undefined;
  }
}

function storageSet(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* Best effort */
  }
}

function createTracker(config: TrackerConfig): TrackerInstance {
  const sessionKey = `dd_analytics_session_${config.websiteId}`;
  const attributionKey = `dd_analytics_attribution_${config.websiteId}`;
  const correlationKey = `dd_analytics_correlation_${config.websiteId}`;

  let inboundUrl: URL;
  try {
    inboundUrl = new URL(window.location.href);
  } catch {
    inboundUrl = new URL('https://awomanwithawelder.co.nz');
  }

  const inboundSession = inboundUrl.searchParams.get('dd_session');
  const inboundAttribution = inboundUrl.searchParams.get('dd_attribution');

  const sessionId =
    inboundSession && /^[A-Za-z0-9_-]{12,160}$/.test(inboundSession)
      ? inboundSession
      : storageGet(sessionKey) || newIdentifier();
  storageSet(sessionKey, sessionId);

  const attributionId =
    inboundAttribution && /^[A-Za-z0-9_-]{12,160}$/.test(inboundAttribution)
      ? inboundAttribution
      : storageGet(attributionKey);
  if (attributionId) storageSet(attributionKey, attributionId);

  const landingPage = storageGet(`${attributionKey}_landing`) || `${inboundUrl.pathname}${inboundUrl.search}`;
  storageSet(`${attributionKey}_landing`, landingPage);

  function decorateCrossDomainLinks() {
    const domains = new Set((config.crossDomainDomains || []).map((d) => d.toLowerCase()));
    if (!domains.size) return;
    document.querySelectorAll('a[href]').forEach((link) => {
      try {
        const anchor = link as HTMLAnchorElement;
        const url = new URL(anchor.href, window.location.href);
        if (!domains.has(url.hostname.toLowerCase()) || url.hostname === window.location.hostname) {
          return;
        }
        url.searchParams.set('dd_session', sessionId);
        if (attributionId) url.searchParams.set('dd_attribution', attributionId);
        anchor.href = url.toString();
      } catch {
        /* Ignore malformed links */
      }
    });
  }

  async function track(eventName: string, properties?: Record<string, any>, options?: TrackOptions) {
    const currentUrl = new URL(window.location.href);
    const payload = {
      eventId: newIdentifier(),
      websiteId: config.websiteId,
      eventName,
      occurredAt: new Date().toISOString(),
      sessionId,
      attributionId,
      correlationId: options?.correlationId || storageGet(correlationKey),
      pagePath: `${currentUrl.pathname}${currentUrl.search}`,
      landingPage,
      referrer: document.referrer || undefined,
      properties,
    };
    try {
      await fetch(
        `${config.endpoint}${config.endpoint.includes('?') ? '&' : '?'}websiteId=${encodeURIComponent(config.websiteId)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ collectorKey: config.collectorKey, event: payload }),
          keepalive: true,
          credentials: 'omit',
        }
      );
    } catch {
      /* Analytics failure should never break site UX */
    }
  }

  function setCorrelationId(correlationId: string) {
    if (/^[A-Za-z0-9_-]{12,160}$/.test(correlationId)) storageSet(correlationKey, correlationId);
  }

  decorateCrossDomainLinks();
  return { sessionId, attributionId, track, setCorrelationId, decorateCrossDomainLinks };
}

export function initialiseDenverDeskAnalytics(): TrackerInstance | null {
  if (tracker) return tracker;
  if (!isDenverDeskAnalyticsConfigured() || getAnalyticsConsent() !== 'granted') {
    return null;
  }
  tracker = createTracker({ ...getEnvConfig(), autoTrackPageViews: false });
  return tracker;
}

export function trackDenverDeskEvent(name: string, properties?: Record<string, any>, options?: TrackOptions) {
  return initialiseDenverDeskAnalytics()?.track(name, properties, options);
}
