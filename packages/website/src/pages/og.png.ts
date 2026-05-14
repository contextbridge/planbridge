import fs from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from '@vercel/og';
import { type ReactElement, type ReactNode, createElement as h } from 'react';

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
    // @vercel/og uses satori, which doesn't parse WOFF2. The browser-facing font load
    // goes through the Astro Fonts API (woff2 only). This one WOFF stays in src/assets/
    // alongside the woff2 family for build-time OG rendering, and never ships to clients.
    fs.readFile(path.join(ESBUILD_FONT_DIR, 'ESBuild-Bold.woff')),
    fs.readFile(path.resolve('./src/assets/brands/claude-code.svg')),
    fs.readFile(path.resolve('./src/assets/brands/codex-cli.png')),
  ]);

  const claudeDataUri = `data:image/svg+xml;base64,${claudeSvg.toString('base64')}`;
  const codexDataUri = `data:image/png;base64,${codexPng.toString('base64')}`;

  return new ImageResponse(card(claudeDataUri, codexDataUri), {
    width: 1200,
    height: 630,
    fonts: [
      { name: 'Atkinson', data: regular, weight: 400, style: 'normal' },
      { name: 'Atkinson', data: bold, weight: 700, style: 'normal' },
      { name: 'ESBuild', data: headingBold, weight: 700, style: 'normal' },
    ],
  });
}

function card(claudeIcon: string, codexIcon: string): ReactElement {
  return h(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: PAGE_BG,
        padding: '72px 80px',
        fontFamily: 'Atkinson',
        color: NEUTRAL_50,
        position: 'relative',
      },
    },
    brandRow(),
    headline(),
    bottomRow(claudeIcon, codexIcon),
  );
}

function brandRow(): ReactNode {
  return h(
    'div',
    {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      },
    },
    h(
      'svg',
      {
        width: 36,
        height: 36,
        viewBox: '-0.348 -0.445 151 164',
        xmlns: 'http://www.w3.org/2000/svg',
        fill: NEUTRAL_50,
      },
      h('path', { d: PLANBRIDGE_PATH_1 }),
      h('path', { d: PLANBRIDGE_PATH_2 }),
    ),
    h('span', { style: { fontFamily: 'ESBuild', fontSize: 36, fontWeight: 700, color: NEUTRAL_50 } }, 'PlanBridge'),
  );
}

function headline(): ReactNode {
  return h(
    'div',
    {
      style: {
        display: 'flex',
        flexDirection: 'column',
        marginTop: -40,
      },
    },
    h('span', {
      style: {
        width: 140,
        height: 6,
        background: TANGERINE,
        marginBottom: 26,
      },
    }),
    h(
      'span',
      {
        style: {
          fontFamily: 'ESBuild',
          fontSize: 72,
          fontWeight: 700,
          lineHeight: 1.05,
          color: NEUTRAL_50,
        },
      },
      'Better code with inline comments',
    ),
    h(
      'span',
      {
        style: {
          fontFamily: 'ESBuild',
          fontSize: 72,
          fontWeight: 700,
          lineHeight: 1.05,
          color: NEUTRAL_50,
          marginTop: 4,
        },
      },
      'on your coding agent plans',
    ),
  );
}

function bottomRow(claudeIcon: string, codexIcon: string): ReactNode {
  return h(
    'div',
    {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      },
    },
    h(
      'div',
      { style: { display: 'flex', alignItems: 'center', gap: 12 } },
      h(
        'span',
        {
          style: {
            fontSize: 20,
            color: NEUTRAL_300,
            fontWeight: 700,
            letterSpacing: 3,
            marginRight: 8,
            textTransform: 'uppercase',
          },
        },
        'Works with',
      ),
      chip('Claude Code', claudeIcon),
      chip('Codex', codexIcon),
    ),
    h('span', { style: { fontSize: 24, color: NEUTRAL_300 } }, 'plan.contextbridge.ai'),
  );
}

function chip(label: string, iconSrc: string): ReactNode {
  return h(
    'span',
    {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: NEUTRAL_900,
        border: `1px solid ${NEUTRAL_700}`,
        color: NEUTRAL_50,
        fontSize: 24,
        padding: '8px 18px',
        borderRadius: 9999,
      },
    },
    h('img', {
      src: iconSrc,
      width: 22,
      height: 22,
      style: { borderRadius: 4 },
    }),
    label,
  );
}
