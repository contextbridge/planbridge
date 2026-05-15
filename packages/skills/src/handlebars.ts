import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Handlebars from 'handlebars';

export type HandlebarsEnv = ReturnType<typeof Handlebars.create>;

export function createHandlebars(partialsDir: string): HandlebarsEnv {
  const env = Handlebars.create();
  env.registerHelper('eq', (a: unknown, b: unknown) => a === b);
  for (const { name, source } of loadPartials(partialsDir)) {
    env.registerPartial(name, source);
  }
  return env;
}

interface LoadedPartial {
  readonly name: string;
  readonly source: string;
}

function loadPartials(rootDir: string): LoadedPartial[] {
  if (!existsSync(rootDir)) return [];
  return Array.from(new Bun.Glob('**/*.md').scanSync(rootDir))
    .sort((a, b) => a.localeCompare(b))
    .map((relPath) => ({
      name: relPath.replace(/\.md$/, ''),
      source: readFileSync(join(rootDir, relPath), 'utf8'),
    }));
}
