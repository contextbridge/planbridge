import type { FrontendConfig } from '@contextbridge/shared/frontendConfigSchema';

export function handleConfig(config: FrontendConfig): Response {
  return Response.json(config);
}
