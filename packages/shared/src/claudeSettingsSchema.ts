import { z } from 'zod';

// A subset of the Claude Agent SDK's PermissionMode union, narrowed to the modes that behave
// sanely once a plan is approved. This package must not depend on the SDK; the subset stays
// honest through contextual typing where the mode flows into a PermissionUpdate in
// packages/cli/src/formatters/plan/claudeHookResponse.ts.
export const CLAUDE_PLAN_APPROVAL_MODES = ['auto', 'acceptEdits', 'default'] as const;

export const ClaudePlanApprovalModeSchema = z.enum(CLAUDE_PLAN_APPROVAL_MODES);
export type ClaudePlanApprovalMode = z.infer<typeof ClaudePlanApprovalModeSchema>;
