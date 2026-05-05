import type { CheckForUpdateOptions, PerformUpdateResult, UpdateNotice } from '#src/updater/types.ts';
import type { Updater } from '#src/updater/UpdaterImpl.ts';

export class FakeUpdater implements Updater {
  readonly checkForUpdateCalls: CheckForUpdateOptions[] = [];
  performUpdateCallCount = 0;

  private checkResult: UpdateNotice | null = null;
  private performResult: PerformUpdateResult = { status: 'skipped-already-latest', currentVersion: 'test' };

  setCheckResult(result: UpdateNotice | null): void {
    this.checkResult = result;
  }

  setPerformResult(result: PerformUpdateResult): void {
    this.performResult = result;
  }

  checkForUpdate(options: CheckForUpdateOptions = {}): Promise<UpdateNotice | null> {
    this.checkForUpdateCalls.push(options);
    return Promise.resolve(this.checkResult);
  }

  performUpdate(): Promise<PerformUpdateResult> {
    this.performUpdateCallCount += 1;
    return Promise.resolve(this.performResult);
  }
}
