import { describe, expect, it } from 'bun:test';
import { CommanderError } from 'commander';
import { PROMPTER_CANCELLED_CODE, PROMPTER_NON_TTY_CODE, createClackPrompter } from './prompter.ts';
import { FakeIo } from './testHelpers/index.ts';

describe('createClackPrompter', () => {
  it('throws a CommanderError directing the user to --yes when stdin is not a TTY', async () => {
    const io = new FakeIo();
    const prompter = createClackPrompter(io);

    try {
      await prompter.confirm({ message: 'proceed?' });
      throw new Error('expected confirm() to reject');
    } catch (err) {
      expect(err).toBeInstanceOf(CommanderError);
      const cmdErr = err as CommanderError;
      expect(cmdErr.code).toBe(PROMPTER_NON_TTY_CODE);
      expect(cmdErr.message).toContain('--yes');
    }
  });

  it('throws a CommanderError when a confirm prompt is cancelled', () => {
    const io = new FakeIo();
    io.stdin.isTTY = true;
    Object.assign(io.stdin, { setRawMode() {} });
    const prompter = createClackPrompter(io);
    const result = prompter.confirm({ message: 'proceed?' });

    io.stdin.write('\u0003');

    expect(result).rejects.toMatchObject({ code: PROMPTER_CANCELLED_CODE, exitCode: 130 });
  });
});
