import type { AnnotationEntrypoint, PlanRevisionMetadata } from '@contextbridge/shared/annotationSchema';
import type { RevisionInstructions } from '#src/formatters/annotation/templates.ts';
import { formatPlanIdDirective } from '#src/planPersistence/planIdDirective.ts';

export function buildPlanRevisionInstructions(args: {
  readonly plan: PlanRevisionMetadata | undefined;
  readonly entrypoint: AnnotationEntrypoint;
  readonly sourcePath?: string;
}): RevisionInstructions | undefined {
  const { plan, entrypoint, sourcePath } = args;
  if (!plan) return undefined;

  if (entrypoint === 'plan_command') {
    return {
      planId: plan.id,
      command: ['contextbridge plan', '--plan-id', shellQuote(plan.id), sourcePath ? shellQuote(sourcePath) : '']
        .filter(Boolean)
        .join(' '),
    };
  }

  return {
    planId: plan.id,
    directive: formatPlanIdDirective(plan.id),
  };
}

function shellQuote(value: string): string {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(value)) return value;
  return `'${value.replaceAll("'", "'\\''")}'`;
}
