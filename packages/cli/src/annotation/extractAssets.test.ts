import { mkdtempSync, rmSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { type TestContext, createStubContext, readLogs } from '#src/testHelpers/index.ts';
import { MAX_ASSET_BYTES, MAX_TOTAL_ASSET_BYTES, extractAssets } from './extractAssets.ts';

describe('extractAssets', () => {
  let stub: TestContext;
  let tmp: string;

  beforeEach(() => {
    stub = createStubContext();
    tmp = mkdtempSync(join(tmpdir(), 'cb-extract-assets-'));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('returns an asset for a single absolute-path image reference that exists on disk', async () => {
    const imgPath = join(tmp, 'a.png');
    writeFileSync(imgPath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const assets = await extractAssets(stub.context, {
      content: `# plan\n\n![diagram](${imgPath})\n`,
    });

    expect(assets).toHaveLength(1);
    expect(assets[0]).toMatchObject({
      originalPath: imgPath,
      mimeType: 'image/png',
    });
    expect(assets[0]?.id).toMatch(/^[0-9a-f]{12}$/);
    expect(assets[0]?.dataBase64).toBe('iVBORw==');
  });

  it('returns an asset for a file URL image reference', async () => {
    const imgPath = join(tmp, 'file-url.png');
    writeFileSync(imgPath, Buffer.from([0x03, 0x04]));
    const imgUrl = pathToFileURL(imgPath).toString();

    const assets = await extractAssets(stub.context, {
      content: `![diagram](${imgUrl})\n`,
    });

    expect(assets).toHaveLength(1);
    expect(assets[0]).toMatchObject({
      originalPath: imgUrl,
      mimeType: 'image/png',
      dataBase64: 'AwQ=',
    });
  });

  it('dedupes two references with the same as-written path string', async () => {
    const imgPath = join(tmp, 'b.png');
    writeFileSync(imgPath, Buffer.from([0x01, 0x02]));

    const assets = await extractAssets(stub.context, {
      content: `![one](${imgPath})\n\n![two](${imgPath})\n`,
    });

    expect(assets).toHaveLength(1);
  });

  it('skips non-local URLs silently', async () => {
    const assets = await extractAssets(stub.context, {
      content: '![cat](https://example.com/cat.png)\n![inline](data:image/png;base64,iVBORw0KGgo=)\n',
    });

    expect(assets).toHaveLength(0);
  });

  it('skips paths whose extension is not in the allowlist (including SVG)', async () => {
    const svg = join(tmp, 'c.svg');
    writeFileSync(svg, '<svg/>');

    const assets = await extractAssets(stub.context, {
      content: `![bad](${svg})\n![nope](/x.txt)\n`,
    });

    expect(assets).toHaveLength(0);
  });

  it('resolves relative paths against sourcePath when sourcePath is set', async () => {
    writeFileSync(join(tmp, 'side.png'), Buffer.from([0xff]));
    const sourcePath = join(tmp, 'plan.md');
    writeFileSync(sourcePath, '');

    const assets = await extractAssets(stub.context, {
      content: '![side](./side.png)\n',
      sourcePath,
    });

    expect(assets).toHaveLength(1);
    expect(assets[0]?.originalPath).toBe('./side.png');
  });

  it('resolves relative paths against process.cwd() when sourcePath is unset (stdin case)', async () => {
    const originalCwd = process.cwd();
    writeFileSync(join(tmp, 'side.png'), Buffer.from([0xfe]));
    process.chdir(tmp);
    try {
      const assets = await extractAssets(stub.context, {
        content: '![side](./side.png)\n',
      });
      expect(assets).toHaveLength(1);
      expect(assets[0]?.originalPath).toBe('./side.png');
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('logs error and skips when a referenced image cannot be read', async () => {
    const missing = join(tmp, 'missing.png');

    const assets = await extractAssets(stub.context, {
      content: `![ghost](${missing})\n`,
    });

    expect(assets).toHaveLength(0);
    const logs = readLogs(stub.logs);
    expect(logs.some((log) => log.level === 50 && log.msg === 'failed to read referenced image')).toBe(true);
  });

  it('logs warning and skips empty image files', async () => {
    const empty = join(tmp, 'empty.png');
    writeFileSync(empty, Buffer.from([]));

    const assets = await extractAssets(stub.context, {
      content: `![empty](${empty})\n`,
    });

    expect(assets).toHaveLength(0);
    const logs = readLogs(stub.logs);
    expect(logs.some((log) => log.level === 40 && log.msg === 'referenced image is empty')).toBe(true);
  });

  it('logs warning and skips images over the per-asset size limit', async () => {
    const oversized = join(tmp, 'oversized.png');
    writeFileSync(oversized, '');
    truncateSync(oversized, MAX_ASSET_BYTES + 1);

    const assets = await extractAssets(stub.context, {
      content: `![oversized](${oversized})\n`,
    });

    expect(assets).toHaveLength(0);
    const logs = readLogs(stub.logs);
    expect(logs.some((log) => log.level === 40 && log.msg === 'referenced image exceeds per-asset size limit')).toBe(
      true,
    );
  });

  it('logs warning and skips images that would exceed the total size limit', async () => {
    const first = join(tmp, 'first.png');
    const second = join(tmp, 'second.png');
    const overflow = join(tmp, 'overflow.png');
    writeFileSync(first, '');
    writeFileSync(second, '');
    writeFileSync(overflow, '');
    truncateSync(first, MAX_ASSET_BYTES);
    truncateSync(second, MAX_ASSET_BYTES);
    truncateSync(overflow, MAX_TOTAL_ASSET_BYTES - 2 * MAX_ASSET_BYTES + 1);

    const assets = await extractAssets(stub.context, {
      content: `![first](${first})\n![second](${second})\n![overflow](${overflow})\n`,
    });

    expect(assets).toHaveLength(2);
    const logs = readLogs(stub.logs);
    expect(logs.some((log) => log.level === 40 && log.msg === 'referenced images exceed total size limit')).toBe(true);
  });

  it('does not extract images inside fenced code blocks', async () => {
    const assets = await extractAssets(stub.context, {
      content: '```\n![not-an-image](/should/not/extract.png)\n```\n',
    });

    expect(assets).toHaveLength(0);
  });
});
