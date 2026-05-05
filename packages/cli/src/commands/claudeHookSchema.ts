import type { PermissionRequestHookInput } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

export const ClaudeHookPayloadSchema = z.object({
  session_id: z.string().trim().nonempty(),
  transcript_path: z.string().trim().nonempty(),
  cwd: z.string().trim().nonempty(),
  permission_mode: z.string().trim().nonempty().optional(),
  hook_event_name: z.string().trim().nonempty(),
  tool_name: z.string().trim().nonempty().optional(),
  tool_input: z
    .object({
      plan: z.string().refine((value) => value.trim().length > 0, { message: 'plan content must not be empty' }),
    })
    .optional(),
});
export type ClaudeHookPayload = z.infer<typeof ClaudeHookPayloadSchema>;

// Compile-time drift canary: if Claude Code renames or restructures the
// PermissionRequest hook input, the SDK type loses one of these fields and
// this assertion fails to compile — forcing us to update the schema above.
type Assert<T extends true> = T;
export type _PermissionRequestHookInputDriftCanary = Assert<
  PermissionRequestHookInput extends {
    session_id: string;
    transcript_path: string;
    cwd: string;
    hook_event_name: 'PermissionRequest';
    tool_name: string;
    tool_input: unknown;
  }
    ? true
    : false
>;
