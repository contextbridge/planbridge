import type { CliContext } from '#src/context.ts';
import { HARNESS_DESCRIPTORS } from './registry.ts';
import type { HarnessDescriptor, HarnessDetection } from './types.ts';

export function detectHarness(ctx: CliContext, descriptor: HarnessDescriptor): HarnessDetection {
  const { commandRunner } = ctx;
  return { descriptor, binaryOnPath: commandRunner.which(descriptor.binaryName) !== null };
}

export function detectHarnesses(
  ctx: CliContext,
  descriptors: readonly HarnessDescriptor[] = HARNESS_DESCRIPTORS,
): readonly HarnessDetection[] {
  return descriptors.map((descriptor) => detectHarness(ctx, descriptor));
}
