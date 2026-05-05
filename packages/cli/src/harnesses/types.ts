export type HarnessId = 'claude' | 'codex' | 'gemini' | 'cursor' | 'aider' | 'opencode' | 'aether';

export interface HarnessDescriptor {
  readonly id: HarnessId;
  readonly displayName: string;
  readonly binaryName: string;
}

export type SupportedHarnessId = 'claude' | 'codex';

export interface SupportedHarnessDescriptor extends HarnessDescriptor {
  readonly id: SupportedHarnessId;
  readonly installUrl: string;
}

export interface HarnessDetection {
  readonly descriptor: HarnessDescriptor;
  readonly binaryOnPath: boolean;
}
