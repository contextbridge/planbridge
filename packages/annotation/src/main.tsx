import '@contextbridge/ui/styles.css';
import '@contextbridge/shared/time';
import { createFrontendContext } from '@contextbridge/context/frontend';
import type { AnnotationPayload, AnnotationSubmission } from '@contextbridge/shared/annotationSchema';
import { type FrontendConfig, FrontendConfigSchema } from '@contextbridge/shared/frontendConfigSchema';
import { resolveSettings } from '@contextbridge/shared/settingsSchema';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { fetchUpdateNotice } from './fetchUpdateNotice.ts';
import { ThemeControllerImpl, applyInitialTheme } from './ThemeController.ts';
import { createUpdateSettings } from './updateSettings.ts';
import type { AnnotationAppContext as AnnotationAppContextValue } from './useAppContext.ts';
import { AnnotationAppContext } from './useAppContext.ts';

const FALLBACK_CONFIG: FrontendConfig = {
  distinctId: 'local-development',
  telemetryDisabled: true,
  settings: resolveSettings(),
};

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('#root not found');

void bootstrap(rootElement);

async function bootstrap(target: HTMLElement): Promise<void> {
  const config = (await fetchConfig()) ?? FALLBACK_CONFIG;

  const themeController = new ThemeControllerImpl();
  applyInitialTheme(themeController, config.settings.ui.theme);

  const base = createFrontendContext({
    config,
    surface: 'plan',
  });

  const context: AnnotationAppContextValue = {
    ...base,
    fetchPayload,
    fetchUpdateNotice: () => fetchUpdateNotice(base.fetcher),
    submitAnnotation,
    settings: config.settings,
    updateSettings: createUpdateSettings({ logger: base.logger }),
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
