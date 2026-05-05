import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { BaseContext } from '@contextbridge/context';
import { buildInfo as buildInfoFactory } from '@contextbridge/context/testFactories';
import { fakeBaseContext } from '@contextbridge/context/testHelpers';
import { type Instant, Temporal } from '@contextbridge/shared/time';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { type FakeAnalytics, createFakeAnalytics } from '@contextbridge/instrumentation/testHelpers';
import {
  type HarnessTelemetryDetection,
  type ReportHarnessDiscoveryOptions,
  reportHarnessDiscovery,
} from './harnessDiscovery.ts';

const testDetections: readonly HarnessTelemetryDetection[] = [
  { descriptor: { id: 'claude' }, binaryOnPath: true },
  { descriptor: { id: 'codex' }, binaryOnPath: false },
  { descriptor: { id: 'cursor' }, binaryOnPath: true },
];

describe('reportHarnessDiscovery', () => {
  const now = Temporal.Instant.from('2026-04-24T18:00:00Z');
  let root: string;
  let markerPath: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'cb-harness-'));
    markerPath = join(root, 'contextbridge', 'harness-discovery-last-run');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('emits harnesses_detected and writes the marker on a fresh install', async () => {
    const { ctx, analytics, options } = createReportFixture(root, {
      clock: () => now,
      getHarnessDetections: () => testDetections,
    });

    await reportHarnessDiscovery(ctx, options);

    expect(analytics.captures).toHaveLength(1);
    const capture = analytics.captures[0]!;
    expect(capture.event).toBe('harnesses_detected');
    expect(capture.properties?.detected_count).toBe(2);
    expect(capture.properties?.cli_version).toBe(ctx.buildInfo.version);
    expect(capture.properties?.platform).toBe('darwin');

    const harnesses = capture.properties?.harnesses as ReadonlyArray<{ id: string; binary_on_path: boolean }>;
    expect(harnesses).toHaveLength(testDetections.length);
    expect(harnesses.find((h) => h.id === 'claude')?.binary_on_path).toBe(true);
    expect(harnesses.find((h) => h.id === 'cursor')?.binary_on_path).toBe(true);
    expect(harnesses.find((h) => h.id === 'codex')?.binary_on_path).toBe(false);

    expect(existsSync(markerPath)).toBe(true);
    expect(readFileSync(markerPath, 'utf8').trim()).toBe(now.toString());
  });

  it('skips when the marker was written < 24h ago', async () => {
    let getHarnessDetectionsCalled = false;
    const { ctx, analytics, options } = createReportFixture(root, {
      clock: () => now,
      getHarnessDetections: () => {
        getHarnessDetectionsCalled = true;
        return testDetections;
      },
    });
    writeMarker(markerPath, now.subtract({ hours: 1 }));

    await reportHarnessDiscovery(ctx, options);

    expect(analytics.captures).toHaveLength(0);
    expect(getHarnessDetectionsCalled).toBe(false);
  });

  it('reports and refreshes the marker when > 24h has passed', async () => {
    const { ctx, analytics, options } = createReportFixture(root, { clock: () => now });
    const stale = now.subtract({ hours: 25 });
    writeMarker(markerPath, stale);

    await reportHarnessDiscovery(ctx, options);

    expect(analytics.captures).toHaveLength(1);
    expect(readFileSync(markerPath, 'utf8').trim()).toBe(now.toString());
  });

  it('bails when telemetry is disabled with no capture, no marker, and no deferred work', async () => {
    let deferCalled = false;
    let getHarnessDetectionsCalled = false;
    const { ctx, analytics, options } = createReportFixture(root, {
      clock: () => now,
      defer: () => {
        deferCalled = true;
        return Promise.resolve();
      },
      getHarnessDetections: () => {
        getHarnessDetectionsCalled = true;
        return testDetections;
      },
      telemetryDisabled: true,
    });

    await reportHarnessDiscovery(ctx, options);

    expect(analytics.captures).toHaveLength(0);
    expect(existsSync(markerPath)).toBe(false);
    expect(deferCalled).toBe(false);
    expect(getHarnessDetectionsCalled).toBe(false);
  });

  it('defers detection and capture so CLI startup is not blocked', async () => {
    const deferred = createDeferred();
    let getHarnessDetectionsCalled = false;
    const { ctx, analytics, options } = createReportFixture(root, {
      clock: () => now,
      defer: () => deferred.promise,
      getHarnessDetections: () => {
        getHarnessDetectionsCalled = true;
        return testDetections;
      },
    });

    const report = reportHarnessDiscovery(ctx, options);

    expect(getHarnessDetectionsCalled).toBe(false);
    expect(analytics.captures).toHaveLength(0);

    deferred.resolve();
    await report;

    expect(getHarnessDetectionsCalled).toBe(true);
    expect(analytics.captures).toHaveLength(1);
  });
});

interface ReportFixtureOverrides extends Partial<ReportHarnessDiscoveryOptions> {
  readonly analytics?: FakeAnalytics;
  readonly buildInfo?: BaseContext['buildInfo'];
  readonly telemetryDisabled?: boolean;
}

function createReportFixture(
  root: string,
  overrides: ReportFixtureOverrides = {},
): {
  readonly ctx: BaseContext;
  readonly analytics: FakeAnalytics;
  readonly options: ReportHarnessDiscoveryOptions;
} {
  const {
    analytics = createFakeAnalytics(),
    buildInfo = buildInfoFactory.build({ environment: 'production', version: '0.0.0-test' }),
    telemetryDisabled = false,
    clock = () => Temporal.Now.instant(),
    defer = () => Promise.resolve(),
    env = { XDG_CONFIG_HOME: root },
    getHarnessDetections = () => testDetections,
    markerPath,
    platform = 'darwin',
  } = overrides;

  const ctx = fakeBaseContext({ analytics, buildInfo, telemetryDisabled });

  return {
    ctx,
    analytics,
    options: {
      clock,
      defer,
      env,
      getHarnessDetections,
      markerPath,
      platform,
    },
  };
}

function writeMarker(path: string, timestamp: Instant): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${timestamp.toString()}\n`, 'utf8');
}

function createDeferred(): { readonly promise: Promise<void>; readonly resolve: () => void } {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}
