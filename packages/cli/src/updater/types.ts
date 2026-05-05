import type { Channel, UpdateNotice } from '@contextbridge/shared/updateNoticeSchema';

export type { Channel, UpdateNotice };

export type InstallMethod = 'homebrew' | 'curl' | 'unknown';

export interface CheckForUpdateOptions {
  readonly forceRefresh?: boolean;
}

export interface UnknownInstallMethodDiagnostics {
  readonly execPath: string;
  readonly realPath: string;
  readonly platform: NodeJS.Platform;
  readonly arch: string;
  readonly homedir: string;
}

export type PerformUpdateResult =
  | { readonly status: 'refused'; readonly reason: 'dev-build' | 'opt-out'; readonly message: string }
  | {
      readonly status: 'recovery-needed';
      readonly reason: 'unknown-install-method';
      readonly message: string;
      readonly fallbackCommands: readonly string[];
      readonly diagnostics: UnknownInstallMethodDiagnostics;
    }
  | { readonly status: 'skipped-already-latest'; readonly currentVersion: string }
  | { readonly status: 'executed'; readonly command: readonly string[]; readonly exitCode: number }
  | { readonly status: 'error'; readonly message: string; readonly cause: unknown };
