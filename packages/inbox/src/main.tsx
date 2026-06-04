import '@contextbridge/ui/styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createInboxApiClient } from './apiClient.ts';
import { App } from './App.tsx';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('#root not found');

const apiClient = createInboxApiClient();

createRoot(rootElement).render(
  <StrictMode>
    <App apiClient={apiClient} />
  </StrictMode>,
);
