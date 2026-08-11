import type { ClaudePlanApprovalMode } from '@contextbridge/shared/claudeSettingsSchema';
import { CLAUDE_PLAN_APPROVAL_MODES } from '@contextbridge/shared/claudeSettingsSchema';
import { PlanApprovalModeOption } from './PlanApprovalModeOption.tsx';
import { SettingsSection } from './SettingsSection.tsx';

export const claudeCodeSectionTestIds = {
  option: (mode: ClaudePlanApprovalMode) => `claude-code-section-option-${mode}`,
};

export const claudeCodeSectionCopy = {
  title: 'Claude Code',
  description: 'What happens after you approve a plan.',
  modes: {
    auto: {
      label: 'Auto',
      description: "A model classifier decides each permission prompt. Claude Code's default.",
    },
    acceptEdits: {
      label: 'Accept Edits',
      description: 'Claude edits files without asking. Other tools still prompt.',
    },
    default: {
      label: 'Manual',
      description: "Claude asks for anything your settings don't already allow.",
    },
  },
} as const;

export interface ClaudeCodeSectionProps {
  readonly mode: ClaudePlanApprovalMode;
  readonly onSelect: (mode: ClaudePlanApprovalMode) => void;
}

export function ClaudeCodeSection({ mode, onSelect }: ClaudeCodeSectionProps) {
  return (
    <SettingsSection description={claudeCodeSectionCopy.description} title={claudeCodeSectionCopy.title}>
      <div className="flex flex-col gap-2 p-3">
        {CLAUDE_PLAN_APPROVAL_MODES.map((option) => (
          <PlanApprovalModeOption
            key={option}
            description={claudeCodeSectionCopy.modes[option].description}
            label={claudeCodeSectionCopy.modes[option].label}
            mode={option}
            onSelect={onSelect}
            selected={option === mode}
            testId={claudeCodeSectionTestIds.option(option)}
          />
        ))}
      </div>
    </SettingsSection>
  );
}
