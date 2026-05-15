export type HarnessId = 'claude' | 'codex' | 'gemini' | 'cursor' | 'aider' | 'opencode' | 'aether';

export interface SkillRenderingRules {
  /** On-disk install directory name for this harness. */
  readonly installName: (logicalName: string) => string;
  /** Output directory for rendered SKILL.md files, relative to the repo root. */
  readonly destDir: string;
}

export interface HarnessDescriptor {
  readonly id: HarnessId;
  readonly displayName: string;
  readonly binaryName: string;
  /** Set when PlanBridge can install itself into this harness; absent for detection-only harnesses. */
  readonly installUrl?: string;
  /** Set when this harness consumes agentskills.io-style SKILL.md content. */
  readonly skillRendering?: SkillRenderingRules;
}

export type InstallableHarness = HarnessDescriptor & { readonly installUrl: string };
export type SkillRenderableHarness = HarnessDescriptor & { readonly skillRendering: SkillRenderingRules };
