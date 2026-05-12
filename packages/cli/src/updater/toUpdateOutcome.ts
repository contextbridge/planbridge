import type { UpdateOutcome } from '@contextbridge/shared/updateOutcomeSchema';
import type { PerformUpdateResult } from './types.ts';

export function toUpdateOutcome(result: PerformUpdateResult): UpdateOutcome {
  switch (result.status) {
    case 'executed':
    case 'skipped-already-latest':
      return { status: 'success' };
    case 'refused':
      return { status: 'failed', message: result.message, recoverable: false };
    case 'recovery-needed':
    case 'error':
      return { status: 'failed', message: result.message, recoverable: true };
  }
}
