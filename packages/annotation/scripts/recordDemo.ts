import { type ChildProcess, spawn } from 'node:child_process';
import { mkdir, rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Temporal } from '@contextbridge/shared/time';
import { chromium } from 'playwright';

const STORYBOOK_PORT = 6006;
const STORY_URL = `http://localhost:${STORYBOOK_PORT}/iframe.html?id=plan-app--full-demo&viewMode=story`;
const VIDEO_SIZE = { width: 1600, height: 900 };
const REPO_ROOT = resolve(import.meta.dir, '../../..');
// Poster goes through Astro's image pipeline (hashed, immutable cache, AVIF/WebP variants).
// Video stays in public/ since Astro doesn't pipeline video.
const POSTER_DIR = resolve(REPO_ROOT, 'packages/website/src/assets/demo');
const VIDEO_DIR = resolve(REPO_ROOT, 'packages/website/public/demo');
const TMP_DIR = resolve(REPO_ROOT, 'claude-tmp/record-demo');

async function waitForStorybook(timeoutMs = 60_000): Promise<void> {
  const deadline = Temporal.Now.instant().add({ milliseconds: timeoutMs });
  while (Temporal.Instant.compare(Temporal.Now.instant(), deadline) < 0) {
    try {
      const response = await fetch(`http://localhost:${STORYBOOK_PORT}/iframe.html`);
      if (response.ok) return;
    } catch {
      // not ready
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Storybook did not respond on port ${STORYBOOK_PORT} within ${timeoutMs}ms`);
}

function spawnStorybook(): ChildProcess {
  const child = spawn('bun', ['run', 'storybook'], {
    cwd: resolve(REPO_ROOT, 'packages/storybook'),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' },
  });
  child.stdout?.on('data', (chunk: Buffer) => process.stdout.write(`[storybook] ${chunk.toString()}`));
  child.stderr?.on('data', (chunk: Buffer) => process.stderr.write(`[storybook] ${chunk.toString()}`));
  return child;
}

async function record(): Promise<void> {
  await mkdir(POSTER_DIR, { recursive: true });
  await mkdir(VIDEO_DIR, { recursive: true });
  await rm(TMP_DIR, { recursive: true, force: true });
  await mkdir(TMP_DIR, { recursive: true });

  const browser = await chromium.launch();

  const posterContext = await browser.newContext({
    viewport: VIDEO_SIZE,
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  });
  await posterContext.addInitScript(() => {
    (window as unknown as { __skipDemoPlay: boolean }).__skipDemoPlay = true;
  });
  const posterPage = await posterContext.newPage();
  await posterPage.goto(STORY_URL, { waitUntil: 'networkidle' });
  await posterPage.waitForFunction(() => Boolean(document.querySelector('h1')), undefined, {
    timeout: 15_000,
  });
  await posterPage.waitForTimeout(400);
  const posterPath = resolve(POSTER_DIR, 'plan-review-poster.jpg');
  await posterPage.screenshot({ path: posterPath, type: 'jpeg', quality: 85, fullPage: false });
  await posterContext.close();

  const recordContext = await browser.newContext({
    viewport: VIDEO_SIZE,
    deviceScaleFactor: 2,
    colorScheme: 'dark',
    recordVideo: { dir: TMP_DIR, size: VIDEO_SIZE },
  });
  const recordPage = await recordContext.newPage();
  await recordPage.goto(STORY_URL, { waitUntil: 'networkidle' });
  await recordPage.waitForFunction(
    () => (window as unknown as { __demoComplete?: boolean }).__demoComplete === true,
    undefined,
    { timeout: 60_000 },
  );
  const video = recordPage.video();
  await recordContext.close();

  if (!video) {
    throw new Error('Playwright did not produce a video for the recording context');
  }
  const recordedPath = await video.path();
  const finalPath = resolve(VIDEO_DIR, 'plan-review.webm');
  await transcodeToVp9(recordedPath, finalPath);

  await browser.close();
  await rm(TMP_DIR, { recursive: true, force: true });

  const finalSize = await stat(finalPath);
  console.log(`✓ Wrote ${finalPath} (${(finalSize.size / 1024).toFixed(0)} KB)`);
  console.log(`✓ Wrote ${posterPath}`);
}

async function transcodeToVp9(input: string, output: string): Promise<void> {
  const proc = Bun.spawn(
    [
      'ffmpeg',
      '-y',
      '-i',
      input,
      '-c:v',
      'libvpx-vp9',
      '-crf',
      '38',
      '-b:v',
      '0',
      '-row-mt',
      '1',
      '-deadline',
      'good',
      '-cpu-used',
      '2',
      '-an',
      output,
    ],
    { stdout: 'inherit', stderr: 'inherit' },
  );
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`ffmpeg exited with code ${exitCode}`);
  }
}

let storybookChild: ChildProcess | undefined;

async function main(): Promise<void> {
  const external = process.argv.includes('--external');

  try {
    if (!external) {
      console.log('→ Booting Storybook…');
      storybookChild = spawnStorybook();
    } else {
      console.log('→ Using already-running Storybook on port 6006');
    }

    await waitForStorybook();
    await record();
  } finally {
    if (storybookChild) {
      storybookChild.kill('SIGTERM');
    }
  }
}

main().catch((error) => {
  console.error(error);
  if (storybookChild) {
    storybookChild.kill('SIGTERM');
  }
  process.exit(1);
});
