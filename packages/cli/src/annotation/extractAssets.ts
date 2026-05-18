import { createHash } from 'node:crypto';
import type { Stats } from 'node:fs';
import { stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ASSET_FILE_EXTENSIONS, type Asset, AssetMimeTypeSchema } from '@contextbridge/shared/annotationSchema';
import type { Image } from 'mdast';
import { Result, ResultAsync } from 'neverthrow';
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
  (err) => err,
);

const safeFileUrlToPath = Result.fromThrowable(
  (value: string) => fileURLToPath(value),
  (err) => err,
);

function collectImageCandidates(ctx: CliContext, content: string, sourcePath: string | undefined): ImageCandidate[] {
  return unique(collectMarkdownImageUrls(content))
    .map((urlString) => toImageCandidate(ctx, urlString, sourcePath))
    .filter(isPresent);
}

function collectMarkdownImageUrls(content: string): string[] {
  const tree = unified().use(remarkParse).parse(content);
  const imageUrls: string[] = [];

  visit(tree, 'image', (node: Image) => {
    if (node.url) imageUrls.push(node.url);
  });

  return imageUrls;
}

function toImageCandidate(ctx: CliContext, urlString: string, sourcePath: string | undefined): ImageCandidate | null {
  const { logger } = ctx;

  const scheme = detectScheme(urlString);
  if (scheme && scheme !== 'file') return null;

  const resolvedPath = resolveImageReadPath(urlString, sourcePath);
  if (!resolvedPath) return null;
  if (resolvedPath.resolvedAgainstCwd) {
    logger.debug({ urlString, cwd: process.cwd() }, 'resolving relative image ref against cwd (no sourcePath)');
  }

  const ext = extname(resolvedPath.readPath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) return null;

  const readPath = normalize(resolvedPath.readPath);
  if (!isAbsolute(readPath)) return null;

  return { urlString, readPath };
}

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
  const loadedAsset = await readAsset(ctx, candidate, accumulator.totalAssetBytes);
  if (!loadedAsset) return accumulator;

  return {
    assets: [...accumulator.assets, loadedAsset.asset],
    totalAssetBytes: accumulator.totalAssetBytes + loadedAsset.byteLength,
  };
}

async function readAsset(
  ctx: CliContext,
  candidate: ImageCandidate,
  totalAssetBytes: number,
): Promise<LoadedAsset | null> {
  const { logger } = ctx;
  const { urlString, readPath } = candidate;

  const statResult = await ResultAsync.fromPromise(stat(readPath), (err) => err);
  if (statResult.isErr()) {
    logger.error({ err: statResult.error, urlString, readPath }, 'failed to read referenced image');
    return null;
  }

  if (!isReadableImageFile(ctx, candidate, statResult.value, totalAssetBytes)) return null;

  const file = Bun.file(readPath);
  const mimeResult = AssetMimeTypeSchema.safeParse(file.type);
  if (!mimeResult.success) {
    logger.error({ urlString, readPath, mime: file.type }, 'image has unsupported mime type');
    return null;
  }

  const bytesResult = await ResultAsync.fromPromise(file.bytes(), (err) => err);
  if (bytesResult.isErr()) {
    logger.error({ err: bytesResult.error, urlString, readPath }, 'failed to read referenced image');
    return null;
  }

  const bytes = bytesResult.value;
  if (!isWithinSizeLimits(ctx, candidate, bytes.byteLength, totalAssetBytes)) return null;

  return {
    asset: createAsset(candidate, bytes, mimeResult.data),
    byteLength: bytes.byteLength,
  };
}

function isReadableImageFile(
  ctx: CliContext,
  candidate: ImageCandidate,
  fileInfo: Stats,
  totalAssetBytes: number,
): boolean {
  const { logger } = ctx;
  const { urlString, readPath } = candidate;

  if (!fileInfo.isFile()) {
    logger.warn({ urlString, readPath }, 'referenced image is not a file');
    return false;
  }

  return isWithinSizeLimits(ctx, candidate, fileInfo.size, totalAssetBytes);
}

function isWithinSizeLimits(
  ctx: CliContext,
  candidate: ImageCandidate,
  byteLength: number,
  totalAssetBytes: number,
): boolean {
  const { logger } = ctx;
  const { urlString, readPath } = candidate;

  if (byteLength === 0) {
    logger.warn({ urlString, readPath }, 'referenced image is empty');
    return false;
  }
  if (byteLength > MAX_ASSET_BYTES) {
    logger.warn({ urlString, readPath, bytes: byteLength }, 'referenced image exceeds per-asset size limit');
    return false;
  }
  if (totalAssetBytes + byteLength > MAX_TOTAL_ASSET_BYTES) {
    logger.warn(
      { urlString, readPath, bytes: byteLength, totalAssetBytes },
      'referenced images exceed total size limit',
    );
    return false;
  }

  return true;
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

function isPresent<T>(value: T | null): value is T {
  return value !== null;
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
