import {
  type Option as ClackOption,
  confirm as clackConfirm,
  isCancel as clackIsCancel,
  select as clackSelect,
} from '@clack/prompts';
import { CommanderError } from 'commander';
import type { Io } from '#src/IoImpl.ts';

export const PROMPTER_CANCELLED_CODE = 'contextbridge.prompter.cancelled';
export const PROMPTER_NON_TTY_CODE = 'contextbridge.prompter.nonTty';

export interface ConfirmOptions {
  readonly message: string;
  readonly default?: boolean;
}

export type SelectValue = string | number | boolean;

export interface SelectChoice<T extends SelectValue> {
  readonly value: T;
  readonly label: string;
  readonly hint?: string;
}

export interface SelectOptions<T extends SelectValue> {
  readonly message: string;
  readonly choices: readonly SelectChoice<T>[];
  readonly default?: T;
}

export interface Prompter {
  confirm(options: ConfirmOptions): Promise<boolean>;
  select<T extends SelectValue>(options: SelectOptions<T>): Promise<T>;
}

export function createClackPrompter(io: Io): Prompter {
  return {
    async confirm({ message, default: defaultValue = true }) {
      assertTty(io);
      const result = await clackConfirm({
        message,
        initialValue: defaultValue,
        input: io.stdin,
        output: io.stderr,
      });
      if (clackIsCancel(result)) {
        throw new CommanderError(130, PROMPTER_CANCELLED_CODE, 'Cancelled.');
      }
      return result;
    },
    async select<T extends SelectValue>({ message, choices, default: defaultValue }: SelectOptions<T>): Promise<T> {
      assertTty(io);
      const options: ClackOption<T>[] = choices.map((c) =>
        c.hint === undefined
          ? ({ value: c.value, label: c.label } as ClackOption<T>)
          : ({ value: c.value, label: c.label, hint: c.hint } as ClackOption<T>),
      );
      const result = await clackSelect<T>({
        message,
        options,
        initialValue: defaultValue,
        input: io.stdin,
        output: io.stderr,
      });
      if (clackIsCancel(result)) {
        throw new CommanderError(130, PROMPTER_CANCELLED_CODE, 'Cancelled.');
      }
      return result;
    },
  };
}

function assertTty(io: Io): void {
  if (io.stdinIsTTY !== true) {
    throw new CommanderError(
      1,
      PROMPTER_NON_TTY_CODE,
      'Cannot prompt in a non-interactive session. Pass `--yes` to skip confirmations.',
    );
  }
}
