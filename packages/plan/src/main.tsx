import '@contextbridge/ui/styles.css';
import '@contextbridge/shared/time';
import { createFrontendContext } from '@contextbridge/context/frontend';
import type { FrontendConfig } from '@contextbridge/shared/frontendConfigSchema';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { startHeartbeat } from './heartbeat.ts';
import { PlanReviewClient } from './PlanReviewClient.ts';
import type { PlanAppContext as PlanAppContextValue } from './useAppContext.ts';
import { PlanAppContext } from './useAppContext.ts';

const FALLBACK_CONFIG: FrontendConfig = {
  distinctId: 'local-development',
  telemetryDisabled: true,
};

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('#root not found');

void bootstrap(rootElement);

async function bootstrap(target: HTMLElement): Promise<void> {
  const client = new PlanReviewClient(fetch);

  const config = (await client.fetchConfig()) ?? FALLBACK_CONFIG;

  const base = createFrontendContext({
    config,
    surface: 'plan',
  });

  const context: PlanAppContextValue = {
    ...base,
    fetchPayload: () => client.fetchPayload(),
    fetchUpdateNotice: () => client.fetchUpdateNotice(),
    submitPlanReview: (submission) => client.submitPlanReview(submission),
    autoCloseDelaySeconds: 3,
  };

  const { ErrorBoundary } = context.telemetry;

  createRoot(target).render(
    <StrictMode>
      <ErrorBoundary>
        <PlanAppContext.Provider value={context}>
          <App />
        </PlanAppContext.Provider>
      </ErrorBoundary>
    </StrictMode>,
  );

  startHeartbeat(client);
}
