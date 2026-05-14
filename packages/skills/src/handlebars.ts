import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import Handlebars from 'handlebars';

export type HandlebarsEnv = ReturnType<typeof Handlebars.create>;

export function createHandlebars(partialsDir: string): HandlebarsEnv {
  const env = Handlebars.create();
  env.registerHelper('eq', (a: unknown, b: unknown) => a === b);
  for (const { name, source } of walkPartials(partialsDir)) {
    env.registerPartial(name, source);
  }
  return env;
}

interface LoadedPartial {
  readonly name: string;
  readonly source: string;
}

function walkPartials(rootDir: string): LoadedPartial[] {
  return walk(rootDir).map((absolutePath) => ({
    name: relative(rootDir, absolutePath).replace(/\.md$/, '').split(sep).join('/'),
    source: readFileSync(absolutePath, 'utf8'),
  }));
}

function walk(dir: string): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
  return entries.flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    if (entry.isFile() && entry.name.endsWith('.md')) return [full];
    return [];
  });
}
