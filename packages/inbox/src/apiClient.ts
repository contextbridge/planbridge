import type {
  InboxErrorPayload,
  InboxFilters,
  InboxSnapshot,
  OpenInboxItemRequest,
} from '@contextbridge/shared/inboxSchema';
import {
  inboxErrorPayloadSchema,
  inboxSnapshotSchema,
  openInboxItemResponseSchema,
} from '@contextbridge/shared/inboxSchema';

export interface InboxApiClient {
  fetchSnapshot(filters: InboxFilters): Promise<InboxSnapshot>;
  openItem(url: string): Promise<void>;
}

export interface InboxApiClientError {
  readonly code: string;
  readonly message: string;
}

export class InboxFetchError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'InboxFetchError';
    this.code = code;
  }
}

export function createInboxApiClient(baseUrl = ''): InboxApiClient {
  return {
    async fetchSnapshot(filters: InboxFilters): Promise<InboxSnapshot> {
      const url = `${baseUrl}/api/inbox/snapshot?${buildFilterParams(filters)}`;
      const response = await fetch(url);

      if (!response.ok) {
        const error = await parseErrorBody(response);
        throw new InboxFetchError(error?.error?.code ?? 'fetch_failed', error?.error?.message ?? response.statusText);
      }

      const body: unknown = await response.json();
      const parsed = inboxSnapshotSchema.safeParse(body);
      if (!parsed.success) {
        throw new InboxFetchError('invalid_data', 'Server returned an invalid inbox snapshot');
      }
      return parsed.data;
    },

    async openItem(itemUrl: string): Promise<void> {
      const body: OpenInboxItemRequest = { url: itemUrl };
      const response = await fetch(`${baseUrl}/api/inbox/open`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await parseErrorBody(response);
        throw new InboxFetchError(error?.error?.code ?? 'open_failed', error?.error?.message ?? response.statusText);
      }

      const responseBody: unknown = await response.json();
      const parsed = openInboxItemResponseSchema.safeParse(responseBody);
      if (!parsed.success) {
        throw new InboxFetchError('invalid_data', 'Server returned an invalid open response');
      }
    },
  };
}

async function parseErrorBody(response: Response): Promise<InboxErrorPayload | null> {
  try {
    const body: unknown = await response.json();
    const parsed = inboxErrorPayloadSchema.safeParse(body);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function buildFilterParams(filters: InboxFilters): string {
  const params = new URLSearchParams();
  const { repositories, kinds, timeWindow, includeDrafts, includeDependabot } = filters;

  if (repositories && repositories.length > 0) {
    params.set('repositories', repositories.join(','));
  }
  if (kinds && kinds.length > 0) {
    params.set('kinds', kinds.join(','));
  }
  if (timeWindow) {
    params.set('timeWindow', timeWindow);
  }
  if (includeDrafts !== undefined) {
    params.set('includeDrafts', String(includeDrafts));
  }
  if (includeDependabot !== undefined) {
    params.set('includeDependabot', String(includeDependabot));
  }

  const paramStr = params.toString();
  return paramStr;
}
