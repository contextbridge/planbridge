import { type Result, err, ok } from 'neverthrow';

export interface ExtractedPlanIdDirective {
  readonly content: string;
  readonly planId: string | null;
}

export class PlanIdDirectiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanIdDirectiveError';
  }
}

const DIRECTIVE_PATTERN = /^[ \t]*<!--[ \t]*contextbridge-plan-id:[ \t]*([^\s>][^>]*)[ \t]*-->[ \t]*(?:\r?\n|$)/gm;

export function formatPlanIdDirective(planId: string): string {
  return `<!-- contextbridge-plan-id: ${planId} -->`;
}

export function extractPlanIdDirective(content: string): ExtractedPlanIdDirective {
  const { content: stripped, planIds } = stripPlanIdDirectives(content);
  return { content: stripped, planId: planIds[0] ?? null };
}

export function resolvePlanIdInput(args: {
  readonly explicitPlanId?: string;
  readonly content: string;
}): Result<ExtractedPlanIdDirective, PlanIdDirectiveError> {
  const explicitPlanId = args.explicitPlanId?.trim();
  if (args.explicitPlanId !== undefined && !explicitPlanId) {
    return err(new PlanIdDirectiveError('plan ID must not be empty'));
  }

  const stripped = stripPlanIdDirectives(args.content);
  const uniqueDirectivePlanIds = Array.from(new Set(stripped.planIds));
  if (uniqueDirectivePlanIds.length > 1) {
    return err(new PlanIdDirectiveError('conflicting contextbridge-plan-id directives'));
  }

  const directivePlanId = uniqueDirectivePlanIds[0] ?? null;
  if (explicitPlanId && directivePlanId && explicitPlanId !== directivePlanId) {
    return err(
      new PlanIdDirectiveError('conflicting plan IDs: --plan-id does not match contextbridge-plan-id directive'),
    );
  }

  return ok({ content: stripped.content, planId: explicitPlanId || directivePlanId });
}

function stripPlanIdDirectives(content: string): { readonly content: string; readonly planIds: readonly string[] } {
  const planIds: string[] = [];
  const stripped = content.replace(DIRECTIVE_PATTERN, (_match, rawPlanId: string) => {
    const planId = rawPlanId.trim();
    if (planId.length > 0) planIds.push(planId);
    return '';
  });
  return { content: stripped, planIds };
}
