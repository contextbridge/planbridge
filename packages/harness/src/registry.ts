import type { HarnessDescriptor, HarnessId, InstallableHarness, SkillRenderableHarness } from './types.ts';

export const HARNESSES: readonly HarnessDescriptor[] = [
  {
    id: 'claude',
    displayName: 'Claude Code',
    binaryName: 'claude',
    installUrl: 'https://docs.claude.com/en/docs/claude-code/setup',
    skillDestDir: 'harnessIntegrations/claude/skills',
  },
  {
    id: 'codex',
    displayName: 'Codex CLI',
    binaryName: 'codex',
    installUrl: 'https://developers.openai.com/codex/cli/',
    skillDestDir: 'harnessIntegrations/codex/skills',
  },
  { id: 'gemini', displayName: 'Gemini CLI', binaryName: 'gemini' },
  { id: 'cursor', displayName: 'Cursor', binaryName: 'cursor' },
  { id: 'aider', displayName: 'Aider', binaryName: 'aider' },
  { id: 'opencode', displayName: 'opencode', binaryName: 'opencode' },
  { id: 'aether', displayName: 'Aether', binaryName: 'aether' },
];

export const INSTALLABLE_HARNESSES: readonly InstallableHarness[] = HARNESSES.filter(isInstallable);

export const SKILL_RENDERABLE_HARNESSES: readonly SkillRenderableHarness[] = HARNESSES.filter(isSkillRenderable);

export function getHarness(id: HarnessId): HarnessDescriptor {
  const harness = HARNESSES.find((h) => h.id === id);
  if (!harness) throw new Error(`Harness not found: ${id}`);
  return harness;
}

export function getInstallableHarness(id: HarnessId): InstallableHarness {
  const harness = INSTALLABLE_HARNESSES.find((h) => h.id === id);
  if (!harness) throw new Error(`Installable harness not found: ${id}`);
  return harness;
}

function isInstallable(harness: HarnessDescriptor): harness is InstallableHarness {
  return harness.installUrl !== undefined;
}

function isSkillRenderable(harness: HarnessDescriptor): harness is SkillRenderableHarness {
  return harness.skillDestDir !== undefined;
}
