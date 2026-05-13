import { HARNESSES, type HarnessDescriptor } from '@contextbridge/harness';
import type { CliContext } from '#src/context.ts';

export interface HarnessDetection {
  readonly descriptor: HarnessDescriptor;
  readonly binaryOnPath: boolean;
}

export function detectHarness(ctx: CliContext, descriptor: HarnessDescriptor): HarnessDetection {
  const { commandRunner } = ctx;
  return { descriptor, binaryOnPath: commandRunner.which(descriptor.binaryName) !== null };
}

export function detectHarnesses(
  ctx: CliContext,
  descriptors: readonly HarnessDescriptor[] = HARNESSES,
): readonly HarnessDetection[] {
  return descriptors.map((descriptor) => detectHarness(ctx, descriptor));
}
