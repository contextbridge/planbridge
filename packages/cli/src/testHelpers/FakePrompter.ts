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

  confirm(options: ConfirmOptions): Promise<boolean> {
    this.calls.push(options);
    const next = this.confirmAnswers.shift();
    if (next === undefined) {
      return Promise.reject(new Error(`FakePrompter: no scripted confirm answer for "${options.message}"`));
    }
    return Promise.resolve(next);
  }

  select<T extends SelectValue>(options: SelectOptions<T>): Promise<T> {
    this.selectCalls.push(options);
    const next = this.selectAnswers.shift();
    if (next === undefined) {
      return Promise.reject(new Error(`FakePrompter: no scripted select answer for "${options.message}"`));
    }
    return Promise.resolve(next as T);
  }
}
