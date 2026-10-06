import {
  createDenverDeskTracker,
  type DenverDeskAnalyticsConfig,
  type DenverDeskTrackerInstance,
} from './denversDeskAnalyticsTracker';

const CONSENT_KEY = 'awww_analytics_consent';
const DEFAULT_WEBSITE_ID = 'web-1782561404289';
const DEFAULT_ENDPOINT = 'https://denver-s-desk.onrender.com/api/analytics/events';

let tracker: DenverDeskTrackerInstance | undefined;

function config(): DenverDeskAnalyticsConfig {
  return {
    websiteId: import.meta.env.VITE_WEBSITE_ID || DEFAULT_WEBSITE_ID,
    collectorKey: import.meta.env.VITE_DD_ANALYTICS_COLLECTOR_KEY || '',
    endpoint: import.meta.env.VITE_DD_ANALYTICS_ENDPOINT || DEFAULT_ENDPOINT,
    crossDomainDomains: (import.meta.env.VITE_DD_ANALYTICS_CROSS_DOMAIN_DOMAINS || '')
      .split(',')
      .map((domain: string) => domain.trim())
      .filter(Boolean),
  };
}

export function isDenverDeskAnalyticsConfigured(): boolean {
  const { websiteId, collectorKey, endpoint } = config();
  return Boolean(websiteId && collectorKey && endpoint);
}

export function getAnalyticsConsent(): string | null {
  try {
    return window.localStorage.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
}

export function setAnalyticsConsent(value: 'granted' | 'denied'): void {
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    /* Consent choice still applies for this page session. */
  }
}

export function initialiseDenverDeskAnalytics(): DenverDeskTrackerInstance | undefined {
  if (tracker || !isDenverDeskAnalyticsConfigured() || getAnalyticsConsent() !== 'granted') {
    return tracker;
  }
  tracker = createDenverDeskTracker({ ...config(), autoTrackPageViews: false });
  return tracker;
}

export function trackDenverDeskEvent(
  name: string,
  properties?: Record<string, any>,
  options?: { correlationId?: string },
): Promise<void> | undefined {
  return initialiseDenverDeskAnalytics()?.track(name, properties, options);
}

export function startCheckoutAttribution(
  itemCount: number,
  cartTotal?: number,
): { sessionId: string; attributionId?: string; correlationId: string } | undefined {
  try {
    const activeTracker = initialiseDenverDeskAnalytics();
    if (!activeTracker || typeof globalThis.crypto?.randomUUID !== 'function') {
      return undefined;
    }
    const correlationId = globalThis.crypto.randomUUID().replace(/-/g, '');
    activeTracker.setCorrelationId(correlationId);
    void activeTracker.track('checkout_started', {
      item_count: itemCount,
      cart_size: itemCount,
      value: cartTotal,
      currency: 'NZD',
    }, { correlationId });
    return {
      sessionId: activeTracker.sessionId,
      attributionId: activeTracker.attributionId,
      correlationId,
    };
  } catch {
    return undefined;
  }
}
