import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { BaseContext, Logger } from '@contextbridge/context';
import { type Instant, Temporal } from '@contextbridge/shared/time';

const APP_DIR_NAME = 'contextbridge';
const MARKER_FILE = 'harness-discovery-last-run';
const REPORT_INTERVAL = Temporal.Duration.from({ hours: 24 });

export interface HarnessDiscoveryEnv {
  readonly XDG_CONFIG_HOME?: string;
  readonly HOME?: string;
}

export interface HarnessTelemetryDetection {
  readonly descriptor: {
    readonly id: string;
  };
  readonly binaryOnPath: boolean;
}

export interface ReportHarnessDiscoveryOptions {
  readonly env: HarnessDiscoveryEnv;
  readonly getHarnessDetections: () => readonly HarnessTelemetryDetection[];
  readonly clock?: () => Instant;
  readonly defer?: () => Promise<void>;
  readonly markerPath?: string;
  readonly platform?: NodeJS.Platform;
}

export async function reportHarnessDiscovery(ctx: BaseContext, options: ReportHarnessDiscoveryOptions): Promise<void> {
  const { analytics, buildInfo, logger, telemetryDisabled } = ctx;
  const {
    env,
    getHarnessDetections,
    clock = () => Temporal.Now.instant(),
    defer = deferUntilNextTurn,
    markerPath = defaultMarkerPath(env),
    platform = process.platform,
  } = options;
  if (telemetryDisabled) return;

  await defer();

  const now = clock();
  if (!shouldReport(markerPath, now)) return;

  const detections = getHarnessDetections();
  analytics.capture('harnesses_detected', {
    harnesses: detections.map((det) => ({
      id: det.descriptor.id,
      binary_on_path: det.binaryOnPath,
    })),
    detected_count: detections.filter((det) => det.binaryOnPath).length,
    cli_version: buildInfo.version,
    platform,
  });
  touchMarker(markerPath, now, logger);
}

function shouldReport(markerPath: string, now: Instant): boolean {
  const lastRun = readMarkerInstant(markerPath);
  if (lastRun === null) return true;

  const elapsed = now.since(lastRun);
  return Temporal.Duration.compare(elapsed, REPORT_INTERVAL) >= 0;
}

function readMarkerInstant(markerPath: string): Instant | null {
  try {
    const contents = readFileSync(markerPath, 'utf8').trim();
    if (contents.length === 0) return null;
    return Temporal.Instant.from(contents);
  } catch {
    return null;
  }
}

function touchMarker(markerPath: string, now: Instant, logger?: Logger): void {
  try {
    mkdirSync(dirname(markerPath), { recursive: true });
    writeFileSync(markerPath, `${now.toString()}\n`, { encoding: 'utf8', mode: 0o600 });
  } catch (err) {
    logger?.debug({ err, markerPath }, 'harness discovery marker write failed');
  }
}

function defaultMarkerPath(env: HarnessDiscoveryEnv): string {
  return join(configDir(env), MARKER_FILE);
}

function configDir(env: HarnessDiscoveryEnv): string {
  if (env.XDG_CONFIG_HOME && env.XDG_CONFIG_HOME.length > 0) {
    return join(env.XDG_CONFIG_HOME, APP_DIR_NAME);
  }
  const home = env.HOME && env.HOME.length > 0 ? env.HOME : homedir();
  return join(home, '.config', APP_DIR_NAME);
}

async function deferUntilNextTurn(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}
