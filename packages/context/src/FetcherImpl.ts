import type { Public } from '@contextbridge/shared/types';

export type Fetcher = Public<FetcherImpl>;

/**
 * DI wrapper for the global `fetch`. Use this instead of importing `fetch`
 * directly so tests can swap in a fake without ad-hoc casting.
 */
export class FetcherImpl {
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    return globalThis.fetch(input, init);
  }
}
