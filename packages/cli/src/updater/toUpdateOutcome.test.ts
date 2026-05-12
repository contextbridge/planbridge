import { describe, expect, it } from 'bun:test';
import { toUpdateOutcome } from './toUpdateOutcome.ts';
import type { PerformUpdateResult } from './types.ts';

describe('toUpdateOutcome', () => {
  it('maps executed → success', () => {
    const result: PerformUpdateResult = {
      status: 'executed',
      command: ['brew', 'upgrade', '--cask', 'contextbridge'],
      exitCode: 0,
    };
    expect(toUpdateOutcome(result)).toEqual({ status: 'success' });
  });

  it('maps skipped-already-latest → success', () => {
    const result: PerformUpdateResult = {
      status: 'skipped-already-latest',
      currentVersion: '0.4.2',
    };
    expect(toUpdateOutcome(result)).toEqual({ status: 'success' });
  });

  it('maps refused → unrecoverable failure', () => {
    const result: PerformUpdateResult = {
      status: 'refused',
      reason: 'dev-build',
      message: 'Updates are disabled for dev builds.',
    };
    expect(toUpdateOutcome(result)).toEqual({
      status: 'failed',
      message: 'Updates are disabled for dev builds.',
      recoverable: false,
    });
  });

  it('maps recovery-needed → recoverable failure', () => {
    const result: PerformUpdateResult = {
      status: 'recovery-needed',
      reason: 'unknown-install-method',
      message: 'Install method could not be detected.',
      fallbackCommands: ['curl …'],
      diagnostics: {
        execPath: '/usr/local/bin/contextbridge',
        realPath: '/usr/local/bin/contextbridge',
        platform: 'darwin',
        arch: 'arm64',
        homedir: '/Users/test',
      },
    };
    expect(toUpdateOutcome(result)).toEqual({
      status: 'failed',
      message: 'Install method could not be detected.',
      recoverable: true,
    });
  });

  it('maps error → recoverable failure', () => {
    const result: PerformUpdateResult = {
      status: 'error',
      message: 'brew upgrade exited with code 1',
      cause: new Error('Process failed'),
    };
    expect(toUpdateOutcome(result)).toEqual({
      status: 'failed',
      message: 'brew upgrade exited with code 1',
      recoverable: true,
    });
  });
});
