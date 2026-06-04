/// <reference lib="dom" />
import { type FrontendContext, createFrontendContext } from '@contextbridge/context/frontend';

export interface InboxAppContext extends FrontendContext {
  readonly apiBaseUrl: string;
}

export function createInboxAppContext(apiBaseUrl = ''): InboxAppContext {
  const frontend = createFrontendContext({
    config: {
      distinctId: 'inbox-user',
      telemetryDisabled: true,
    },
    surface: 'inbox',
  });

  return Object.freeze({
    ...frontend,
    apiBaseUrl,
  });
}
