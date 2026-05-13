import { ClaudeInstaller } from './ClaudeInstaller.ts';
import { CodexInstaller } from './CodexInstaller.ts';
import type { HarnessInstaller } from './HarnessInstaller.ts';

export const ALL_INSTALLERS: readonly HarnessInstaller[] = [new ClaudeInstaller(), new CodexInstaller()];
