import { z } from 'zod';

const booleanEnv = z.stringbool({ truthy: ['1', 'true', 'yes'], falsy: ['', '0', 'false', 'no'] }).default(false);
export const PortSchema = z.coerce.number().int().min(1).max(65535);
const portEnv = PortSchema.optional();

const Environment = z.object({
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),
  DO_NOT_TRACK: booleanEnv,
  CONTEXTBRIDGE_TELEMETRY_DISABLED: booleanEnv,
  CI: booleanEnv,
  CONTEXTBRIDGE_UPDATE_CHECK_DISABLED: booleanEnv,
  CONTEXTBRIDGE_PORT: portEnv,
  CONTEXTBRIDGE_DB_PATH: z.string().trim().nonempty().optional(),
  XDG_CONFIG_HOME: z.string().optional(),
  XDG_DATA_HOME: z.string().optional(),
  HOME: z.string().optional(),
});

export type Environment = z.infer<typeof Environment>;

export function getEnvironment(env: NodeJS.ProcessEnv = process.env): Environment {
  return Environment.parse(env);
}

export function parsePort(value: unknown): number {
  return PortSchema.parse(value);
}
