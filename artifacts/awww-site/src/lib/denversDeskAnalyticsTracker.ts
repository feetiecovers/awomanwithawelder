// Reusable Denver's Desk first-party website analytics tracker client.
// Aligned with Denver's Desk canonical analytics contracts.

const SESSION_KEY_PREFIX = 'dd_analytics_session_';
const ATTRIBUTION_KEY_PREFIX = 'dd_analytics_attribution_';
const CORRELATION_KEY_PREFIX = 'dd_analytics_correlation_';

export interface DenverDeskAnalyticsConfig {
  websiteId: string;
  collectorKey: string;
  endpoint: string;
  crossDomainDomains?: string[];
  autoTrackPageViews?: boolean;
}

export interface DenverDeskAnalyticsEventPayload {
  eventId: string;
  websiteId: string;
  eventName: string;
  occurredAt: string;
  sessionId: string;
  attributionId?: string;
  correlationId?: string;
  pagePath: string;
  landingPage: string;
  referrer?: string;
  attribution?: Record<string, string>;
  properties?: Record<string, any>;
}

export interface DenverDeskTrackerInstance {
  sessionId: string;
  attributionId?: string;
  track: (eventName: string, properties?: Record<string, any>, options?: { correlationId?: string }) => Promise<void>;
  setCorrelationId: (correlationId: string) => void;
  decorateCrossDomainLinks: () => void;
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
    /* Tracking remains best effort. */
  }
}

function attributionFromUrl(url: URL): Record<string, string> | undefined {
  const fields: [string, string][] = [
    ['source', 'utm_source'],
    ['medium', 'utm_medium'],
    ['campaign', 'utm_campaign'],
    ['term', 'utm_term'],
    ['content', 'utm_content'],
    ['gclid', 'gclid'],
    ['gbraid', 'gbraid'],
    ['wbraid', 'wbraid'],
    ['fbclid', 'fbclid'],
    ['msclkid', 'msclkid'],
  ];
  const result: Record<string, string> = {};
  for (const [field, parameter] of fields) {
    const value = url.searchParams.get(parameter)?.trim();
    if (value && value.length <= 180) {
      result[field] = value;
    }
  }
  return Object.keys(result).length ? result : undefined;
}

function stripTrackingParameters(): void {
  try {
    const url = new URL(window.location.href);
    ['dd_session', 'dd_attribution'].forEach((key) => url.searchParams.delete(key));
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    /* Ignore history state errors. */
  }
}

export function createDenverDeskTracker(config: DenverDeskAnalyticsConfig): DenverDeskTrackerInstance {
  const sessionKey = `${SESSION_KEY_PREFIX}${config.websiteId}`;
  const attributionKey = `${ATTRIBUTION_KEY_PREFIX}${config.websiteId}`;
  const correlationKey = `${CORRELATION_KEY_PREFIX}${config.websiteId}`;
  const inboundUrl = new URL(window.location.href);
  const inboundSession = inboundUrl.searchParams.get('dd_session');
  const inboundAttribution = inboundUrl.searchParams.get('dd_attribution');
  const sessionId =
    inboundSession && /^[A-Za-z0-9_-]{12,160}$/.test(inboundSession)
      ? inboundSession
      : storageGet(sessionKey) || newIdentifier();
  storageSet(sessionKey, sessionId);

  const freshAttribution = attributionFromUrl(inboundUrl);
  const attributionId =
    inboundAttribution && /^[A-Za-z0-9_-]{12,160}$/.test(inboundAttribution)
      ? inboundAttribution
      : storageGet(attributionKey) || (freshAttribution ? newIdentifier() : undefined);
  if (attributionId) {
    storageSet(attributionKey, attributionId);
  }

  const landingPage = storageGet(`${attributionKey}_landing`) || `${inboundUrl.pathname}${inboundUrl.search}`;
  storageSet(`${attributionKey}_landing`, landingPage);

  if (inboundSession || inboundAttribution) {
    stripTrackingParameters();
  }

  function crossDomainDomains(): Set<string> {
    return new Set((config.crossDomainDomains ?? []).map((domain) => domain.toLowerCase()));
  }

  function decorateCrossDomainLinks(): void {
    const domains = crossDomainDomains();
    if (!domains.size || typeof document === 'undefined') return;
    document.querySelectorAll('a[href]').forEach((link) => {
      try {
        const anchor = link as HTMLAnchorElement;
        const url = new URL(anchor.href, window.location.href);
        if (!domains.has(url.hostname.toLowerCase()) || url.hostname === window.location.hostname) return;
        url.searchParams.set('dd_session', sessionId);
        if (attributionId) url.searchParams.set('dd_attribution', attributionId);
        anchor.href = url.toString();
      } catch {
        /* Ignore malformed links. */
      }
    });
  }

  async function track(
    eventName: string,
    properties?: Record<string, any>,
    options?: { correlationId?: string },
  ): Promise<void> {
    const currentUrl = new URL(window.location.href);
    const payload: DenverDeskAnalyticsEventPayload = {
      eventId: newIdentifier(),
      websiteId: config.websiteId,
      eventName,
      occurredAt: new Date().toISOString(),
      sessionId,
      attributionId,
      correlationId: options?.correlationId || storageGet(correlationKey),
      pagePath: `${currentUrl.pathname}${currentUrl.search}`,
      landingPage,
      referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
      attribution: attributionFromUrl(currentUrl) || freshAttribution,
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
        },
      );
    } catch {
      /* Never disrupt the website for analytics. */
    }
  }

  function setCorrelationId(correlationId: string): void {
    if (/^[A-Za-z0-9_-]{12,160}$/.test(correlationId)) {
      storageSet(correlationKey, correlationId);
    }
  }

  decorateCrossDomainLinks();
  if (config.autoTrackPageViews !== false) {
    void track('page_view');
  }

  return { sessionId, attributionId, track, setCorrelationId, decorateCrossDomainLinks };
}
