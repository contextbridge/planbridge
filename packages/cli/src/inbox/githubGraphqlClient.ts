import type { Logger } from '@contextbridge/context';
import { Octokit } from '@octokit/core';
import { retry } from '@octokit/plugin-retry';
import { throttling } from '@octokit/plugin-throttling';

/**
 * Narrow contract for issuing GraphQL queries against GitHub. The inbox only
 * needs a single round-trip query, so this is deliberately just `graphql`. The
 * production implementation wraps Octokit (HTTP keep-alive + retry/throttle);
 * tests swap in a fake.
 */
export interface GitHubGraphqlClient {
  graphql<T>(query: string, variables: Record<string, unknown>): Promise<T>;
}

const InboxOctokit = Octokit.plugin(retry, throttling);

/**
 * Octokit-backed GraphQL client. One instance is reused for a session, so the
 * underlying fetch connection is kept alive across snapshot refreshes instead of
 * paying a fresh `gh` subprocess spawn + TLS handshake per request.
 */
export class OctokitGraphqlClient implements GitHubGraphqlClient {
  private readonly octokit: InstanceType<typeof InboxOctokit>;

  constructor(token: string, logger: Logger) {
    this.octokit = new InboxOctokit({
      auth: token,
      throttle: {
        onRateLimit: (retryAfter, options, _octokit, retryCount) => {
          logger.warn({ method: options.method, url: options.url, retryAfter, retryCount }, 'GitHub rate limit hit');
          return retryCount < 2;
        },
        onSecondaryRateLimit: (retryAfter, options, _octokit, retryCount) => {
          logger.warn(
            { method: options.method, url: options.url, retryAfter, retryCount },
            'GitHub secondary rate limit hit',
          );
          return retryCount === 0;
        },
      },
    });
  }

  graphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    return this.octokit.graphql<T>(query, variables);
  }
}
