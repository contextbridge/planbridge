import { toError } from '@contextbridge/shared/errors';
import type { CommandRunner, RunCommandOptions, RunCommandResult } from '#src/CommandRunnerImpl.ts';

export interface FakeCommandCall {
  readonly cmd: string;
  readonly args: readonly string[];
  readonly opts: RunCommandOptions;
}

export interface CommandStub {
  /** Defaults: `exitCode: 0`, `stdout: ''`, `stderr: ''`. Pass a partial to override. */
  resolves(result?: Partial<RunCommandResult>): void;
  /** Reject the run() promise (simulates the runner itself throwing — not a non-zero exit). */
  rejects(err: unknown): void;
}

type Matcher = (cmd: string, args: readonly string[]) => boolean;
type Outcome = { kind: 'resolve'; result: RunCommandResult } | { kind: 'reject'; err: unknown };

interface Responder {
  readonly matcher: Matcher;
  readonly label: string;
  readonly outcome: Outcome;
}

export class FakeCommandRunner implements CommandRunner {
  readonly calls: FakeCommandCall[] = [];
  private readonly whichMap = new Map<string, string | null>();
  private readonly responders: Responder[] = [];

  setWhich(cmd: string, resolved: string | null): void {
    this.whichMap.set(cmd, resolved);
  }

  which(cmd: string): string | null {
    return this.whichMap.get(cmd) ?? null;
  }

  on(cmd: string, args: readonly string[] = []): CommandStub {
    return this.register(
      (c, callArgs) => c === cmd && args.every((v, i) => callArgs[i] === v),
      `on(${JSON.stringify(cmd)}${args.length === 0 ? '' : `, ${JSON.stringify(args)}`})`,
    );
  }

  onAny(): CommandStub {
    return this.register(() => true, 'onAny()');
  }

  callsTo(cmd: string, args: readonly string[] = []): FakeCommandCall[] {
    return this.calls.filter((call) => call.cmd === cmd && args.every((v, i) => call.args[i] === v));
  }

  run(cmd: string, args: readonly string[], opts: RunCommandOptions = {}): Promise<RunCommandResult> {
    this.calls.push({ cmd, args, opts });
    const responder = this.responders.find((r) => r.matcher(cmd, args));
    if (!responder) {
      return Promise.reject(new Error(this.formatMiss(cmd, args)));
    }
    return responder.outcome.kind === 'resolve'
      ? Promise.resolve(responder.outcome.result)
      : Promise.reject(toError(responder.outcome.err));
  }

  private register(matcher: Matcher, label: string): CommandStub {
    const push = (outcome: Outcome): void => {
      this.responders.push({ matcher, label, outcome });
    };
    return {
      resolves: ({ exitCode = 0, stdout = '', stderr = '' } = {}) =>
        push({ kind: 'resolve', result: { exitCode, stdout, stderr } }),
      rejects: (err) => push({ kind: 'reject', err }),
    };
  }

  private formatMiss(cmd: string, args: readonly string[]): string {
    const prior = this.calls.slice(0, -1);
    const matchers =
      this.responders.length === 0 ? '  (none)' : this.responders.map((r, i) => `  ${i + 1}. ${r.label}`).join('\n');
    const priorList =
      prior.length === 0 ? '  (none)' : prior.map((c, i) => `  ${i + 1}. ${[c.cmd, ...c.args].join(' ')}`).join('\n');
    return [
      `FakeCommandRunner: no responder for \`${[cmd, ...args].join(' ')}\`.`,
      `Registered matchers (${this.responders.length}, in order):`,
      matchers,
      `Prior calls in this run (${prior.length}):`,
      priorList,
    ].join('\n');
  }
}
