import '@contextbridge/ui/styles.css';
import '@contextbridge/shared/time';
import { createFrontendContext } from '@contextbridge/context/frontend';
import { type FrontendConfig, FrontendConfigSchema } from '@contextbridge/shared/frontendConfigSchema';
import type { PlanReviewSubmission, SubmissionPayload } from '@contextbridge/shared/planReviewSchema';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { fetchPerformUpdate } from './fetchPerformUpdate.ts';
import { fetchUpdateNotice } from './fetchUpdateNotice.ts';
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
  const config = (await fetchConfig()) ?? FALLBACK_CONFIG;

  const base = createFrontendContext({
    config,
    surface: 'plan',
  });

  const context: PlanAppContextValue = {
    ...base,
    fetchPayload,
    fetchUpdateNotice: () => fetchUpdateNotice(base.fetcher),
    performUpdate: () => fetchPerformUpdate(base.fetcher),
    submitPlanReview,
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
}

async function fetchConfig(): Promise<FrontendConfig | null> {
  try {
    const response = await fetch('/config');
    if (!response.ok) return null;
    return FrontendConfigSchema.parse(await response.json());
  } catch {
    return null;
  }
}

async function fetchPayload(): Promise<SubmissionPayload> {
  const response = await fetch('/payload');
  return (await response.json()) as SubmissionPayload;
}

async function submitPlanReview(submission: PlanReviewSubmission): Promise<void> {
  const response = await fetch('/submit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(submission),
  });

  if (response.ok) {
    return;
  }

  const body = (await response.text()).trim();
  if (body.length > 0) {
    throw new Error(body);
  }

  throw new Error(`submit failed with status ${response.status}`);
}
