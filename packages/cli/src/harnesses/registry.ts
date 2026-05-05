import type { HarnessDescriptor, HarnessId, SupportedHarnessDescriptor, SupportedHarnessId } from './types.ts';

export const SUPPORTED_HARNESS_DESCRIPTORS: readonly SupportedHarnessDescriptor[] = [
  {
    id: 'claude',
    displayName: 'Claude Code',
    binaryName: 'claude',
    installUrl: 'https://docs.claude.com/en/docs/claude-code/setup',
  },
  {
    id: 'codex',
    displayName: 'Codex CLI',
    binaryName: 'codex',
    installUrl: 'https://developers.openai.com/codex/cli/',
  },
];

export const HARNESS_DESCRIPTORS: readonly HarnessDescriptor[] = [
  ...SUPPORTED_HARNESS_DESCRIPTORS,
  { id: 'gemini', displayName: 'Gemini CLI', binaryName: 'gemini' },
  { id: 'cursor', displayName: 'Cursor', binaryName: 'cursor' },
  { id: 'aider', displayName: 'Aider', binaryName: 'aider' },
  { id: 'opencode', displayName: 'opencode', binaryName: 'opencode' },
  { id: 'aether', displayName: 'Aether', binaryName: 'aether' },
];

export function getDescriptor(id: HarnessId): HarnessDescriptor {
  const descriptor = HARNESS_DESCRIPTORS.find((d) => d.id === id);
  if (!descriptor) throw new Error(`Harness descriptor not found: ${id}`);
  return descriptor;
}

export function getSupportedDescriptor(id: SupportedHarnessId): SupportedHarnessDescriptor {
  const descriptor = SUPPORTED_HARNESS_DESCRIPTORS.find((d) => d.id === id);
  if (!descriptor) throw new Error(`Supported harness descriptor not found: ${id}`);
  return descriptor;
}
