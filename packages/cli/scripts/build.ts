#!/usr/bin/env bun
import { cbBuildDefines, parseBuildEnv } from '@contextbridge/context/build';

const injections = parseBuildEnv();

const defineArgs = Object.entries(cbBuildDefines(injections)).flatMap(([key, value]) => [
  '--define',
  `${key}=${value}`,
]);

const { exitCode } = Bun.spawnSync({
  cmd: [
    'bun',
    'build',
    '--compile',
    '--minify',
    '--sourcemap',
    ...defineArgs,
    '--outfile',
    '../../dist/contextbridge',
    './src/cli.ts',
  ],
  stdio: ['inherit', 'inherit', 'inherit'],
});

process.exit(exitCode);
