import { rmSync } from 'node:fs';
import type { HarnessDescriptor } from '@contextbridge/harness';
import { toError } from '@contextbridge/shared/errors';
import { Result, ResultAsync } from 'neverthrow';
import prettier from 'prettier';
import type { Skill } from '#src/skills.ts';

export interface RenderTarget {
  readonly harness: HarnessDescriptor;
  readonly path: string;
  readonly body: string;
}

export abstract class GeneratedOutput {
  abstract readonly id: string;
  abstract readonly outputDir: string;

  targetsFor(skills: readonly Skill[]): ResultAsync<RenderTarget[], Error> {
    return ResultAsync.fromSafePromise(Promise.all(skills.map((skill) => this.targetFor(skill)))).andThen((results) =>
      Result.combine(results),
    );
  }

  clean(): void {
    rmSync(this.outputDir, { recursive: true, force: true });
  }

  abstract findOrphans(expectedPaths: ReadonlySet<string>): string[];

  protected abstract targetFor(skill: Skill): ResultAsync<RenderTarget, Error>;

  protected formatTarget(path: string, body: string, harness: HarnessDescriptor): ResultAsync<RenderTarget, Error> {
    return ResultAsync.fromPromise(prettier.resolveConfig(path), toError)
      .andThen((config) => ResultAsync.fromPromise(prettier.format(body, { ...config, filepath: path }), toError))
      .map((formatted) => ({ harness, path, body: formatted }));
  }
}
