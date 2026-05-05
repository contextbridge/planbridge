import type { CommandRunner, RunCommandOptions, RunCommandResult } from '#src/CommandRunnerImpl.ts';

export interface FakeCommandCall {
  readonly cmd: string;
  readonly args: readonly string[];
  readonly opts: RunCommandOptions;
}

export class FakeCommandRunner implements CommandRunner {
  readonly calls: FakeCommandCall[] = [];
  private readonly whichMap = new Map<string, string | null>();
  private readonly scripted: RunCommandResult[] = [];

  setWhich(cmd: string, resolved: string | null): void {
    this.whichMap.set(cmd, resolved);
  }

  script(...results: RunCommandResult[]): void {
    this.scripted.push(...results);
  }

  which(cmd: string): string | null {
    return this.whichMap.has(cmd) ? (this.whichMap.get(cmd) ?? null) : null;
  }

  run(cmd: string, args: readonly string[], opts: RunCommandOptions = {}): Promise<RunCommandResult> {
    this.calls.push({ cmd, args, opts });
    const next = this.scripted.shift();
    if (!next) {
      return Promise.reject(new Error(`FakeCommandRunner: no scripted result for ${cmd} ${args.join(' ')}`));
    }
    return Promise.resolve(next);
  }
}
