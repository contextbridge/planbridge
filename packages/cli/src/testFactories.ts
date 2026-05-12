import { Factory } from 'fishery';
import type { RunAnnotationArgs } from '#src/annotation/runAnnotation.ts';
import type {
  CodexStopHookPayload,
  CodexTranscriptHookPromptLine,
  CodexTranscriptPlanLine,
} from '#src/commands/codexHookSchema.ts';
import type { Environment } from '#src/environment.ts';
import type { HarnessDescriptor } from '#src/harnesses/types.ts';

export const codexStopHookPayload = Factory.define<CodexStopHookPayload>(() => ({
  session_id: 'sess_123',
  transcript_path: '/tmp/transcript.jsonl',
  cwd: '/work',
  hook_event_name: 'Stop',
  model: 'gpt-5.3-codex',
  permission_mode: 'plan',
  turn_id: 'turn_123',
  stop_hook_active: false,
  last_assistant_message: 'No plan.',
}));

export const codexTranscriptPlanLine = Factory.define<CodexTranscriptPlanLine, { text: string; turnId: string }>(
  ({ transientParams }) => {
    const { text = '# Plan', turnId = 'turn_123' } = transientParams;
    return {
      type: 'event_msg',
      payload: {
        type: 'item_completed',
        turn_id: turnId,
        item: { type: 'Plan', text },
      },
    };
  },
);

export const codexTranscriptHookPromptLine = Factory.define<CodexTranscriptHookPromptLine>(() => ({
  type: 'response_item',
  payload: {
    type: 'message',
    role: 'user',
    content: [
      {
        type: 'input_text',
        text: '<hook_prompt hook_run_id="stop:0:/work/.codex/config.toml"># Plan review: changes requested\n</hook_prompt>',
      },
    ],
  },
}));

export const annotationArgs = Factory.define<RunAnnotationArgs>(() => ({
  content: '# Plan',
  contentKind: 'plan',
  entrypoint: 'plan_command',
}));

export const environment = Factory.define<Environment>(() => ({
  LOG_LEVEL: 'info',
  DO_NOT_TRACK: false,
  CONTEXTBRIDGE_TELEMETRY_DISABLED: false,
  CI: false,
  CONTEXTBRIDGE_UPDATE_CHECK_DISABLED: false,
  CONTEXTBRIDGE_PORT: undefined,
}));

export const harnessDescriptor = Factory.define<HarnessDescriptor>(() => ({
  id: 'claude',
  displayName: 'Claude Code',
  binaryName: 'claude',
}));
