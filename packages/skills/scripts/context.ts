import { type BaseContext, createBaseContext, createLogger } from '@contextbridge/context';

export function createScriptContext(): BaseContext {
  const logger = createLogger({ level: 'info', destination: process.stderr });
  return createBaseContext({
    logger,
    distinctId: 'skills-script',
    telemetryDisabled: true,
  });
}
