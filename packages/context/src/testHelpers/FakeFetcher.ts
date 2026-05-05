import type { Fetcher } from '../FetcherImpl.ts';

export interface FakeFetchCall {
  readonly input: string | URL | Request;
  readonly init?: RequestInit;
}

type ScriptedResponse = Response | Error | (() => Promise<Response>);

/**
 * Records each fetch call and returns scripted responses in order. Pass an
 * Error to simulate a network failure, a Response to simulate a successful
 * response, or a function for dynamic behavior (e.g. AbortSignal handling).
 */
export class FakeFetcher implements Fetcher {
  readonly calls: FakeFetchCall[] = [];
  private readonly scripted: ScriptedResponse[] = [];

  script(...results: ScriptedResponse[]): void {
    this.scripted.push(...results);
  }

  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
    this.calls.push({ input, init });
    const next = this.scripted.shift();
    if (!next) {
      return Promise.reject(new Error(`FakeFetcher: no scripted response for ${describeInput(input)}`));
    }
    if (next instanceof Error) return Promise.reject(next);
    if (typeof next === 'function') return next();
    return Promise.resolve(next);
  }
}

function describeInput(input: string | URL | Request): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}
