import { describe, expect, it } from 'bun:test';
import { BUILD_INFO } from './buildInfo.ts';

describe('BUILD_INFO', () => {
  it('uses public-safe defaults when build defines are not injected', () => {
    expect(BUILD_INFO).toMatchObject({
      version: '0.0.0-development',
      environment: 'local',
      channel: 'stable',
      postHogKey: '',
      postHogHost: '',
      sentryCliDsn: '',
      sentryFrontendDsn: '',
    });
  });
});
