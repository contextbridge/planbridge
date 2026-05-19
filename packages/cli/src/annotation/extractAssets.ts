import { createHash } from 'node:crypto';
import type { Stats } from 'node:fs';
import { stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSET_FILE_EXTENSIONS, type Asset, AssetMimeTypeSchema } from '@contextbridge/shared/annotationSchema';
import type { Image } from 'mdast';
import { Result, ResultAsync, err, ok } from 'neverthrow';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';
import type { CliContext } from '#src/context.ts';

export interface ExtractAssetsInput {
  content: string;
  sourcePath?: string;
}

const MIB = 1024 * 1024;
export const MAX_ASSET_BYTES = 10 * MIB;
export const MAX_TOTAL_ASSET_BYTES = 25 * MIB;

export async function extractAssets(ctx: CliContext, input: ExtractAssetsInput): Promise<Asset[]> {
  const { content, sourcePath } = input;
  const candidates = collectImageCandidates(ctx, content, sourcePath);
  return loadAssets(ctx, candidates);
}

type AssetExtractionIssue =
  | { kind: 'unsupportedScheme'; urlString: string }
  | { kind: 'unresolvablePath'; urlString: string }
  | { kind: 'unsupportedExtension'; urlString: string; readPath: string }
  | { kind: 'nonAbsolutePath'; urlString: string; readPath: string }
  | { kind: 'statFailed'; urlString: string; readPath: string; err: unknown }
  | { kind: 'readFailed'; urlString: string; readPath: string; err: unknown }
  | { kind: 'notAFile'; urlString: string; readPath: string }
  | { kind: 'unsupportedMime'; urlString: string; readPath: string; mime: string }
  | { kind: 'emptyFile'; urlString: string; readPath: string }
  | { kind: 'exceedsPerAssetLimit'; urlString: string; readPath: string; bytes: number }
  | { kind: 'exceedsTotalLimit'; urlString: string; readPath: string; bytes: number; totalAssetBytes: number };

type AssetFilter<T> = (value: T) => Result<void, AssetExtractionIssue>;

const ALLOWED_EXTENSIONS: ReadonlySet<string> = new Set(ASSET_FILE_EXTENSIONS);

interface ImageCandidate {
  urlString: string;
  readPath: string;
}

interface AssetAccumulator {
  assets: Asset[];
  totalAssetBytes: number;
}

interface LoadedAsset {
  asset: Asset;
  byteLength: number;
}

interface ResolvedImageReadPath {
  readPath: string;
  resolvedAgainstCwd: boolean;
}

const safeDecodeURIComponent = Result.fromThrowable(
  (value: string) => decodeURIComponent(value),
  (cause) => cause,
);

const safeFileUrlToPath = Result.fromThrowable(
  (value: string) => fileURLToPath(value),
  (cause) => cause,
);

function collectImageCandidates(ctx: CliContext, content: string, sourcePath: string | undefined): ImageCandidate[] {
  const candidates: ImageCandidate[] = [];
  for (const urlString of unique(collectMarkdownImageUrls(content))) {
    const result = toImageCandidate(ctx, urlString, sourcePath);
    if (result.isOk()) {
      candidates.push(result.value);
    } else {
      logIssue(ctx, result.error);
    }
  }
  return candidates;
}

function collectMarkdownImageUrls(content: string): string[] {
  const tree = unified().use(remarkParse).parse(content);
  const imageUrls: string[] = [];

  visit(tree, 'image', (node: Image) => {
    if (node.url) imageUrls.push(node.url);
  });

  return imageUrls;
}

function toImageCandidate(
  ctx: CliContext,
  urlString: string,
  sourcePath: string | undefined,
): Result<ImageCandidate, AssetExtractionIssue> {
  const { logger } = ctx;

  const scheme = detectScheme(urlString);
  if (scheme && scheme !== 'file') return err({ kind: 'unsupportedScheme', urlString });

  const resolved = resolveImageReadPath(urlString, sourcePath);
  if (!resolved) return err({ kind: 'unresolvablePath', urlString });
  if (resolved.resolvedAgainstCwd) {
    logger.debug({ urlString, cwd: process.cwd() }, 'resolving relative image ref against cwd (no sourcePath)');
  }

  const readPath = normalize(resolved.readPath);
  const candidate = { urlString, readPath };

  return validateExtension(candidate)
    .andThen(() => validateAbsolute(candidate))
    .map(() => candidate);
}

const validateExtension: AssetFilter<ImageCandidate> = ({ urlString, readPath }) => {
  const ext = extname(readPath).toLowerCase();
  if (ALLOWED_EXTENSIONS.has(ext)) return ok(undefined);
  return err({ kind: 'unsupportedExtension', urlString, readPath });
};

const validateAbsolute: AssetFilter<ImageCandidate> = ({ urlString, readPath }) => {
  if (isAbsolute(readPath)) return ok(undefined);
  return err({ kind: 'nonAbsolutePath', urlString, readPath });
};

async function loadAssets(ctx: CliContext, candidates: readonly ImageCandidate[]): Promise<Asset[]> {
  const accumulator = await candidates.reduce<Promise<AssetAccumulator>>(
    async (pendingAccumulator, candidate) => appendCandidateAsset(ctx, await pendingAccumulator, candidate),
    Promise.resolve({ assets: [], totalAssetBytes: 0 }),
  );
  return accumulator.assets;
}

async function appendCandidateAsset(
  ctx: CliContext,
  accumulator: AssetAccumulator,
  candidate: ImageCandidate,
): Promise<AssetAccumulator> {
  const result = await readAsset(candidate, accumulator.totalAssetBytes);
  if (result.isErr()) {
    logIssue(ctx, result.error);
    return accumulator;
  }

  const { asset, byteLength } = result.value;
  return {
    assets: [...accumulator.assets, asset],
    totalAssetBytes: accumulator.totalAssetBytes + byteLength,
  };
}

async function readAsset(
  candidate: ImageCandidate,
  totalAssetBytes: number,
): Promise<Result<LoadedAsset, AssetExtractionIssue>> {
  const { urlString, readPath } = candidate;

  const statResult = await ResultAsync.fromPromise(stat(readPath), (cause) => cause);
  if (statResult.isErr()) return err({ kind: 'statFailed', urlString, readPath, err: statResult.error });

  const fileTypeCheck = validateIsFile({ ...candidate, info: statResult.value });
  if (fileTypeCheck.isErr()) return err(fileTypeCheck.error);

  const statSizeCheck = validateSizeLimits({ ...candidate, byteLength: statResult.value.size, totalAssetBytes });
  if (statSizeCheck.isErr()) return err(statSizeCheck.error);

  const file = Bun.file(readPath);
  const mimeResult = AssetMimeTypeSchema.safeParse(file.type);
  if (!mimeResult.success) return err({ kind: 'unsupportedMime', urlString, readPath, mime: file.type });

  const bytesResult = await ResultAsync.fromPromise(file.bytes(), (cause) => cause);
  if (bytesResult.isErr()) return err({ kind: 'readFailed', urlString, readPath, err: bytesResult.error });

  const bytes = bytesResult.value;
  const bytesSizeCheck = validateSizeLimits({ ...candidate, byteLength: bytes.byteLength, totalAssetBytes });
  if (bytesSizeCheck.isErr()) return err(bytesSizeCheck.error);

  return ok({
    asset: createAsset(candidate, bytes, mimeResult.data),
    byteLength: bytes.byteLength,
  });
}

const validateIsFile: AssetFilter<ImageCandidate & { info: Stats }> = ({ urlString, readPath, info }) => {
  if (info.isFile()) return ok(undefined);
  return err({ kind: 'notAFile', urlString, readPath });
};

const validateSizeLimits: AssetFilter<ImageCandidate & { byteLength: number; totalAssetBytes: number }> = ({
  urlString,
  readPath,
  byteLength,
  totalAssetBytes,
}) => {
  if (byteLength === 0) return err({ kind: 'emptyFile', urlString, readPath });
  if (byteLength > MAX_ASSET_BYTES)
    return err({ kind: 'exceedsPerAssetLimit', urlString, readPath, bytes: byteLength });
  if (totalAssetBytes + byteLength > MAX_TOTAL_ASSET_BYTES) {
    return err({ kind: 'exceedsTotalLimit', urlString, readPath, bytes: byteLength, totalAssetBytes });
  }
  return ok(undefined);
};

function logIssue(ctx: CliContext, issue: AssetExtractionIssue): void {
  const { logger } = ctx;
  switch (issue.kind) {
    case 'unsupportedScheme':
    case 'unresolvablePath':
    case 'unsupportedExtension':
    case 'nonAbsolutePath':
      return;
    case 'statFailed':
    case 'readFailed':
      logger.error(
        { err: issue.err, urlString: issue.urlString, readPath: issue.readPath },
        'failed to read referenced image',
      );
      return;
    case 'notAFile':
      logger.warn({ urlString: issue.urlString, readPath: issue.readPath }, 'referenced image is not a file');
      return;
    case 'unsupportedMime':
      logger.error(
        { urlString: issue.urlString, readPath: issue.readPath, mime: issue.mime },
        'image has unsupported mime type',
      );
      return;
    case 'emptyFile':
      logger.warn({ urlString: issue.urlString, readPath: issue.readPath }, 'referenced image is empty');
      return;
    case 'exceedsPerAssetLimit':
      logger.warn(
        { urlString: issue.urlString, readPath: issue.readPath, bytes: issue.bytes },
        'referenced image exceeds per-asset size limit',
      );
      return;
    case 'exceedsTotalLimit':
      logger.warn(
        {
          urlString: issue.urlString,
          readPath: issue.readPath,
          bytes: issue.bytes,
          totalAssetBytes: issue.totalAssetBytes,
        },
        'referenced images exceed total size limit',
      );
      return;
  }
}

function createAsset(candidate: ImageCandidate, bytes: Uint8Array, mimeType: Asset['mimeType']): Asset {
  const id = createHash('sha256').update(bytes).digest('hex').slice(0, 12);

  return {
    id,
    originalPath: candidate.urlString,
    mimeType,
    dataBase64: Buffer.from(bytes).toString('base64'),
  };
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function resolveImageReadPath(urlString: string, sourcePath: string | undefined): ResolvedImageReadPath | null {
  const scheme = detectScheme(urlString);
  if (scheme === 'file') {
    const decoded = safeFileUrlToPath(urlString);
    return decoded.isOk() ? { readPath: decoded.value, resolvedAgainstCwd: false } : null;
  }

  let absolutePath: string;
  let resolvedAgainstCwd = false;
  if (urlString.startsWith('/')) {
    absolutePath = urlString;
  } else if (sourcePath) {
    absolutePath = resolve(dirname(sourcePath), urlString);
  } else {
    absolutePath = resolve(process.cwd(), urlString);
    resolvedAgainstCwd = true;
  }

  const decoded = safeDecodeURIComponent(absolutePath);
  return decoded.isOk() ? { readPath: decoded.value, resolvedAgainstCwd } : null;
}

function detectScheme(value: string): string | null {
  if (/^[a-z]:/i.test(value)) return null;
  const match = /^([a-z][a-z0-9+.-]*):/i.exec(value);
  return match ? match[1]!.toLowerCase() : null;
}
