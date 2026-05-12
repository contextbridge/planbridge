import {
  type Option as ClackOption,
  confirm as clackConfirm,
  isCancel as clackIsCancel,
  select as clackSelect,
} from '@clack/prompts';
import { getErrorMessage } from '@contextbridge/shared/errors';
import { type Result, ResultAsync, err, errAsync, ok, okAsync } from 'neverthrow';
import { AbortError } from '#src/commands/abort.ts';
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
  confirm(options: ConfirmOptions): ResultAsync<boolean, AbortError>;
  select<T extends SelectValue>(options: SelectOptions<T>): ResultAsync<T, AbortError>;
}

export function createClackPrompter(io: Io): Prompter {
  return {
    confirm({ message, default: defaultValue = true }) {
      const tty = assertTty(io);
      if (tty.isErr()) return errAsync(tty.error);
      return ResultAsync.fromPromise(
        clackConfirm({
          message,
          initialValue: defaultValue,
          input: io.stdin,
          output: io.stderr,
        }),
        (e) => AbortError.runtime('prompter', getErrorMessage(e)),
      ).andThen((result) => {
        if (clackIsCancel(result)) {
          return errAsync(AbortError.cancelled('prompter', 'Cancelled.', { code: PROMPTER_CANCELLED_CODE }));
        }
        return okAsync(result);
      });
    },
    select<T extends SelectValue>({
      message,
      choices,
      default: defaultValue,
    }: SelectOptions<T>): ResultAsync<T, AbortError> {
      const tty = assertTty(io);
      if (tty.isErr()) return errAsync(tty.error);
      const options: ClackOption<T>[] = choices.map((c) =>
        c.hint === undefined
          ? ({ value: c.value, label: c.label } as ClackOption<T>)
          : ({ value: c.value, label: c.label, hint: c.hint } as ClackOption<T>),
      );
      return ResultAsync.fromPromise(
        clackSelect<T>({
          message,
          options,
          initialValue: defaultValue,
          input: io.stdin,
          output: io.stderr,
        }),
        (e) => AbortError.runtime('prompter', getErrorMessage(e)),
      ).andThen((result) => {
        if (clackIsCancel(result)) {
          return errAsync(AbortError.cancelled('prompter', 'Cancelled.', { code: PROMPTER_CANCELLED_CODE }));
        }
        return okAsync(result);
      });
    },
  };
}

function assertTty(io: Io): Result<void, AbortError> {
  if (io.stdinIsTTY !== true) {
    return err(
      AbortError.input('prompter', 'Cannot prompt in a non-interactive session. Pass `--yes` to skip confirmations.', {
        code: PROMPTER_NON_TTY_CODE,
      }),
    );
  }
  return ok(undefined);
}
