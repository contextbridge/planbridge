import type { BeforeSendFn } from 'posthog-js';

const SYNTHETIC_HOST = 'contextbridge.local';
const URL_PROPERTY_KEYS = ['$current_url', '$referrer', '$initial_current_url', '$initial_referrer'] as const;

/**
 * PostHog `before_send` hook that rewrites URL-shaped properties onto
 * `http://contextbridge.local/<surface>` so events don't fragment across the
 * random localhost ports the CLI uses to serve the local UI.
 */
export function createStableUrlRewriter(surface: string): BeforeSendFn {
  const surfacePathPrefix = `/${surface}`;

  return (event) => {
    if (event == null) return event;
    const props = event.properties;
    if (props == null) return event;

    for (const key of URL_PROPERTY_KEYS) {
      const value: unknown = props[key];
      if (typeof value === 'string') {
        props[key] = rewriteUrl(value, surfacePathPrefix);
      }
    }
    const host: unknown = props['$host'];
    if (typeof host === 'string') {
      props['$host'] = SYNTHETIC_HOST;
    }
    const pathname: unknown = props['$pathname'];
    if (typeof pathname === 'string') {
      props['$pathname'] = `${surfacePathPrefix}${pathname}`;
    }

    return event;
  };
}

function rewriteUrl(raw: string, surfacePathPrefix: string): string {
  try {
    const parsed = new URL(raw);
    return `http://${SYNTHETIC_HOST}${surfacePathPrefix}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return raw;
  }
}
