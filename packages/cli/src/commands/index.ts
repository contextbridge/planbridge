import { QUICKSTART_URL } from '@contextbridge/shared/links';
import { Command } from 'commander';
import type { CliContext } from '#src/context.ts';
import { registerHookClaude } from './hookClaude.ts';
import { registerHookCodex } from './hookCodex.ts';
import { registerInstall } from './install.ts';
import { registerOpen } from './open.ts';
import { registerPlan } from './plan.ts';
import { registerUninstall } from './uninstall.ts';
import { registerUpdate } from './update.ts';

export function createProgram(ctx: CliContext): Command {
  const { io, buildInfo } = ctx;
  const program = new Command()
    .name('contextbridge')
    .description('Human review for AI coding agents. Currently ships PlanBridge (plan review).')
    .version(buildInfo.version)
    .exitOverride()
    .configureOutput({
      writeOut: (s) => io.writeStdout(s),
      writeErr: (s) => io.writeStderr(s),
    })
    .addHelpText('after', `\nDocs: ${QUICKSTART_URL}`);

  registerPlan(ctx, program);
  registerOpen(ctx, program);
  registerUpdate(ctx, program);

  const hookCommand = program
    .command('hook')
    .description(
      'Harness-specific hook adapters that read event JSON on stdin and emit a hook response on stdout. Currently: claude, codex.',
    );
  registerHookClaude(ctx, hookCommand);
  registerHookCodex(ctx, hookCommand);

  registerInstall(ctx, program);
  registerUninstall(ctx, program);

  return program;
}
