import { z } from 'zod';

// `@openai/codex-sdk` does not export the Stop hook input shape — the SDK is scoped to
// programmatic Codex runs (Thread/Codex classes + runtime ThreadEvent / ThreadItem types).
// Upstream publishes a JSON Schema (Draft-07) generated from the Rust types; mirror it by hand
// here and re-check on Codex bumps:
// https://github.com/openai/codex/blob/main/codex-rs/hooks/schema/generated/stop.command.input.schema.json
export const CodexStopHookPayloadSchema = z.object({
  session_id: z.string().trim().nonempty(),
  transcript_path: z.string().trim().nonempty().nullable(),
  cwd: z.string().trim().nonempty(),
  hook_event_name: z.literal('Stop'),
  model: z.string().trim().nonempty(),
  permission_mode: z.enum(['default', 'acceptEdits', 'plan', 'dontAsk', 'bypassPermissions']),
  turn_id: z.string().trim().nonempty(),
  stop_hook_active: z.boolean(),
  last_assistant_message: z.string().nullable(),
});
export type CodexStopHookPayload = z.infer<typeof CodexStopHookPayloadSchema>;

// Transcript JSONL line that surfaces a structured Plan item. Unlike the hook input above, the
// on-disk transcript format has no upstream schema — it's a separate internal protocol with
// different discriminators (PascalCase `Plan` here vs. snake_case `agent_message` in the SDK).
// These are the fields we've observed and need.
export const CodexTranscriptPlanLineSchema = z.object({
  type: z.literal('event_msg'),
  payload: z.object({
    type: z.literal('item_completed'),
    turn_id: z.string().trim().nonempty(),
    item: z.object({
      type: z.enum(['Plan', 'plan']),
      text: z.string().trim().nonempty(),
    }),
  }),
});
export type CodexTranscriptPlanLine = z.infer<typeof CodexTranscriptPlanLineSchema>;

export const CodexTranscriptHookPromptLineSchema = z.object({
  type: z.literal('response_item'),
  payload: z.object({
    type: z.literal('message'),
    role: z.literal('user'),
    content: z.array(
      z.object({
        type: z.literal('input_text'),
        text: z.string(),
      }),
    ),
  }),
});
export type CodexTranscriptHookPromptLine = z.infer<typeof CodexTranscriptHookPromptLineSchema>;
