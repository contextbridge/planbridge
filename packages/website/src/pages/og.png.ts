import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ATKINSON_FONT_DIR = path.resolve('./node_modules/@fontsource/atkinson-hyperlegible-next/files');
const ESBUILD_FONT_DIR = path.resolve('./src/assets/fonts');

const TANGERINE = '#f68b35';
const NEUTRAL_50 = '#fafafa';
const NEUTRAL_300 = '#d4d4d4';
const NEUTRAL_700 = '#404040';
const NEUTRAL_900 = '#171717';
const PAGE_BG = '#0a0a0a';

const PLANBRIDGE_PATH_1 = 'M127.035 43.2306L134.972 0H21.973L0 119.88H23.2335L37.303 43.2306H127.035Z';
const PLANBRIDGE_PATH_2 = 'M127.037 43.231L113.001 119.881H23.2355L15.332 163.111H128.297L150.304 43.231H127.037Z';

export async function GET() {
  const [regular, bold, headingBold, claudeSvg, codexPng] = await Promise.all([
    fs.readFile(path.join(ATKINSON_FONT_DIR, 'atkinson-hyperlegible-next-latin-400-normal.woff')),
    fs.readFile(path.join(ATKINSON_FONT_DIR, 'atkinson-hyperlegible-next-latin-700-normal.woff')),
    fs.readFile(path.join(ESBUILD_FONT_DIR, 'ESBuild-Bold.woff')),
    fs.readFile(path.resolve('./src/assets/brands/claude-code.svg')),
    fs.readFile(path.resolve('./src/assets/brands/codex-cli.png')),
  ]);

  const image = await sharp(Buffer.from(card({ regular, bold, headingBold, claudeSvg, codexPng })))
    .png()
    .toBuffer();

  return new Response(image, {
    headers: { 'content-type': 'image/png' },
  });
}

function card({
  regular,
  bold,
  headingBold,
  claudeSvg,
  codexPng,
}: {
  regular: Buffer;
  bold: Buffer;
  headingBold: Buffer;
  claudeSvg: Buffer;
  codexPng: Buffer;
}): string {
  const claudeDataUri = `data:image/svg+xml;base64,${claudeSvg.toString('base64')}`;
  const codexDataUri = `data:image/png;base64,${codexPng.toString('base64')}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <style>
    @font-face { font-family: Atkinson; src: url(data:font/woff;base64,${regular.toString('base64')}); font-weight: 400; }
    @font-face { font-family: Atkinson; src: url(data:font/woff;base64,${bold.toString('base64')}); font-weight: 700; }
    @font-face { font-family: ESBuild; src: url(data:font/woff;base64,${headingBold.toString('base64')}); font-weight: 700; }
  </style>
  <rect width="1200" height="630" fill="${PAGE_BG}"/>
  <g transform="translate(80 72)">
    <svg width="36" height="36" viewBox="-0.348 -0.445 151 164" fill="${NEUTRAL_50}"><path d="${PLANBRIDGE_PATH_1}"/><path d="${PLANBRIDGE_PATH_2}"/></svg>
    <text x="52" y="29" fill="${NEUTRAL_50}" font-family="ESBuild" font-size="36" font-weight="700">PlanBridge</text>
  </g>
  <rect x="80" y="251" width="140" height="6" fill="${TANGERINE}"/>
  <text x="80" y="357" fill="${NEUTRAL_50}" font-family="ESBuild" font-size="72" font-weight="700">Better code with inline comments</text>
  <text x="80" y="437" fill="${NEUTRAL_50}" font-family="ESBuild" font-size="72" font-weight="700">on your coding agent plans</text>
  <text x="80" y="570" fill="${NEUTRAL_300}" font-family="Atkinson" font-size="20" font-weight="700" letter-spacing="3">WORKS WITH</text>
  <g transform="translate(263 540)">
    <rect width="190" height="48" rx="24" fill="${NEUTRAL_900}" stroke="${NEUTRAL_700}"/>
    <image href="${claudeDataUri}" x="18" y="13" width="22" height="22"/>
    <text x="50" y="31" fill="${NEUTRAL_50}" font-family="Atkinson" font-size="24">Claude Code</text>
  </g>
  <g transform="translate(465 540)">
    <rect width="130" height="48" rx="24" fill="${NEUTRAL_900}" stroke="${NEUTRAL_700}"/>
    <image href="${codexDataUri}" x="18" y="13" width="22" height="22"/>
    <text x="50" y="31" fill="${NEUTRAL_50}" font-family="Atkinson" font-size="24">Codex</text>
  </g>
  <text x="1120" y="570" text-anchor="end" fill="${NEUTRAL_300}" font-family="Atkinson" font-size="24">plan.contextbridge.ai</text>
</svg>`;
}
