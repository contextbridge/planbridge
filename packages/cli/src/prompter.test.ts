import { describe, expect, it } from 'bun:test';
import { CommanderError } from 'commander';
import { PROMPTER_NON_TTY_CODE, createClackPrompter } from './prompter.ts';
import { FakeIo } from '#src/testHelpers/index.ts';

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
});
