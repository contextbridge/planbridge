import { describe, expect, it } from 'bun:test';
import { harnessDescriptor } from '#src/testFactories.ts';
import { createStubContext } from '#src/testHelpers/index.ts';
import { detectHarness, detectHarnesses } from './detect.ts';

describe('detectHarness', () => {
  it('returns binaryOnPath: true when which() finds the binary', () => {
    const { context, commandRunner } = createStubContext();
    const descriptor = harnessDescriptor.build();
    commandRunner.setWhich('claude', '/usr/local/bin/claude');

    const result = detectHarness(context, descriptor);

    expect(result).toEqual({ descriptor, binaryOnPath: true });
  });

  it('returns binaryOnPath: false when which() returns null', () => {
    const { context, commandRunner } = createStubContext();
    const descriptor = harnessDescriptor.build({ id: 'aider', displayName: 'Aider', binaryName: 'aider' });
    commandRunner.setWhich('aider', null);

    const result = detectHarness(context, descriptor);

    expect(result).toEqual({ descriptor, binaryOnPath: false });
  });
});

describe('detectHarnesses', () => {
  it('detects every descriptor in order', () => {
    const { context, commandRunner } = createStubContext();
    const claude = harnessDescriptor.build();
    const aider = harnessDescriptor.build({ id: 'aider', displayName: 'Aider', binaryName: 'aider' });
    commandRunner.setWhich('claude', '/usr/local/bin/claude');
    commandRunner.setWhich('aider', null);

    const result = detectHarnesses(context, [claude, aider]);

    expect(result).toEqual([
      { descriptor: claude, binaryOnPath: true },
      { descriptor: aider, binaryOnPath: false },
    ]);
  });
});
