import '@contextbridge/ui/styles.css';
import '@contextbridge/shared/time';
import { createFrontendContext } from '@contextbridge/context/frontend';
import type { AnnotationPayload, AnnotationSubmission } from '@contextbridge/shared/annotationSchema';
import { type FrontendConfig, FrontendConfigSchema } from '@contextbridge/shared/frontendConfigSchema';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { fetchUpdateNotice } from './fetchUpdateNotice.ts';
import { ThemeControllerImpl, applyInitialTheme } from './ThemeController.ts';
import type { AnnotationAppContext as AnnotationAppContextValue } from './useAppContext.ts';
import { AnnotationAppContext } from './useAppContext.ts';

const FALLBACK_CONFIG: FrontendConfig = {
  distinctId: 'local-development',
  telemetryDisabled: true,
};

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('#root not found');

void bootstrap(rootElement);

async function bootstrap(target: HTMLElement): Promise<void> {
  const themeController = new ThemeControllerImpl();
  applyInitialTheme(themeController);

  const config = (await fetchConfig()) ?? FALLBACK_CONFIG;

  const base = createFrontendContext({
    config,
    surface: 'plan',
  });

  const context: AnnotationAppContextValue = {
    ...base,
    fetchPayload,
    fetchUpdateNotice: () => fetchUpdateNotice(base.fetcher),
    submitAnnotation,
    autoCloseDelaySeconds: 3,
    themeController,
  };

  const { ErrorBoundary } = context.telemetry;

  createRoot(target).render(
    <StrictMode>
      <ErrorBoundary>
        <AnnotationAppContext.Provider value={context}>
          <App />
        </AnnotationAppContext.Provider>
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

async function fetchPayload(): Promise<AnnotationPayload> {
  const response = await fetch('/payload');
  return (await response.json()) as AnnotationPayload;
}

async function submitAnnotation(submission: AnnotationSubmission): Promise<void> {
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
