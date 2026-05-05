import { describe, expect, it } from 'bun:test';
import type { CaptureResult } from 'posthog-js';
import { createStableUrlRewriter } from './stableUrlRewriter.ts';

describe('createStableUrlRewriter', () => {
  const rewriter = createStableUrlRewriter('plan');

  it('rewrites a localhost root URL to the synthetic host with the surface prefix', () => {
    const event = buildEvent({
      $current_url: 'http://localhost:60958/',
      $host: 'localhost:60958',
      $pathname: '/',
    });

    const out = rewriter(event);

    expect(out?.properties['$current_url']).toBe('http://contextbridge.local/plan/');
    expect(out?.properties['$host']).toBe('contextbridge.local');
    expect(out?.properties['$pathname']).toBe('/plan/');
  });

  it('preserves non-root pathnames after the surface prefix', () => {
    const event = buildEvent({
      $current_url: 'http://localhost:60447/foo',
      $pathname: '/foo',
    });

    const out = rewriter(event);

    expect(out?.properties['$current_url']).toBe('http://contextbridge.local/plan/foo');
    expect(out?.properties['$pathname']).toBe('/plan/foo');
  });

  it('preserves query strings and hash fragments', () => {
    const event = buildEvent({
      $current_url: 'http://localhost:60958/x?a=1&b=2#section',
    });

    const out = rewriter(event);

    expect(out?.properties['$current_url']).toBe('http://contextbridge.local/plan/x?a=1&b=2#section');
  });

  it('rewrites $referrer and $initial_* URL properties', () => {
    const event = buildEvent({
      $referrer: 'http://localhost:1111/prev',
      $initial_current_url: 'http://localhost:2222/',
      $initial_referrer: 'http://localhost:3333/ref',
    });

    const out = rewriter(event);

    expect(out?.properties['$referrer']).toBe('http://contextbridge.local/plan/prev');
    expect(out?.properties['$initial_current_url']).toBe('http://contextbridge.local/plan/');
    expect(out?.properties['$initial_referrer']).toBe('http://contextbridge.local/plan/ref');
  });

  it('leaves unparseable URL strings unchanged', () => {
    const event = buildEvent({ $current_url: 'not a url' });

    const out = rewriter(event);

    expect(out?.properties['$current_url']).toBe('not a url');
  });

  it('passes through null events', () => {
    expect(rewriter(null)).toBeNull();
  });

  it('uses the configured surface for the path prefix', () => {
    const reviewRewriter = createStableUrlRewriter('review');

    const out = reviewRewriter(buildEvent({ $current_url: 'http://localhost:1/' }));

    expect(out?.properties['$current_url']).toBe('http://contextbridge.local/review/');
  });

  it('ignores non-string URL properties', () => {
    const event = buildEvent({ $current_url: 42, $host: null });

    const out = rewriter(event);

    expect(out?.properties['$current_url']).toBe(42);
    expect(out?.properties['$host']).toBeNull();
  });
});

function buildEvent(properties: Record<string, unknown>): CaptureResult {
  return {
    uuid: 'test-uuid',
    event: '$pageview',
    properties,
  };
}
