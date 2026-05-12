import { describe, expect, it } from 'bun:test';
import { AbortError } from './commands/abort.ts';
import { PROMPTER_NON_TTY_CODE, createClackPrompter } from './prompter.ts';
import { FakeIo, expectErr } from './testHelpers/index.ts';

describe('createClackPrompter', () => {
  it('returns a typed error directing the user to --yes when stdin is not a TTY', async () => {
    const io = new FakeIo();
    const prompter = createClackPrompter(io);

    const err = await expectErr(prompter.confirm({ message: 'proceed?' }));

    expect(err).toBeInstanceOf(AbortError);
    expect(err.code).toBe(PROMPTER_NON_TTY_CODE);
    expect(err.message).toContain('--yes');
  });
});
