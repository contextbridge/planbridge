import { type ResultAsync, errAsync, okAsync } from 'neverthrow';
import { AbortError } from '#src/commands/abort.ts';
import type { ConfirmOptions, Prompter, SelectOptions, SelectValue } from '#src/prompter.ts';

export class FakePrompter implements Prompter {
  readonly calls: ConfirmOptions[] = [];
  readonly selectCalls: SelectOptions<SelectValue>[] = [];
  private readonly confirmAnswers: boolean[] = [];
  private readonly selectAnswers: SelectValue[] = [];

  setConfirm(...answers: boolean[]): void {
    this.confirmAnswers.push(...answers);
  }

  setSelect<T extends SelectValue>(...answers: T[]): void {
    this.selectAnswers.push(...answers);
  }

  confirm(options: ConfirmOptions): ResultAsync<boolean, AbortError> {
    this.calls.push(options);
    const next = this.confirmAnswers.shift();
    if (next === undefined) {
      return errAsync(
        AbortError.runtime('prompter', `FakePrompter: no scripted confirm answer for "${options.message}"`),
      );
    }
    return okAsync(next);
  }

  select<T extends SelectValue>(options: SelectOptions<T>): ResultAsync<T, AbortError> {
    this.selectCalls.push(options);
    const next = this.selectAnswers.shift();
    if (next === undefined) {
      return errAsync(
        AbortError.runtime('prompter', `FakePrompter: no scripted select answer for "${options.message}"`),
      );
    }
    return okAsync(next as T);
  }
}
