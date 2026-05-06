import type { PlanReviewClient } from './PlanReviewClient.ts';

export type PageHideListener = (callback: () => void) => () => void;

export interface StartHeartbeatOptions {
  intervalMs?: number;
  addPageHideListener?: PageHideListener;
}

export function startHeartbeat(
  client: Pick<PlanReviewClient, 'sendHeartbeat'>,
  options: StartHeartbeatOptions = {},
): () => void {
  const { intervalMs = 2_000, addPageHideListener = defaultPageHideListener } = options;

  void client.sendHeartbeat();

  const intervalId = setInterval(() => void client.sendHeartbeat(), intervalMs);
  const removePageHideListener = addPageHideListener(() => {
    clearInterval(intervalId);
  });

  return () => {
    clearInterval(intervalId);
    removePageHideListener();
  };
}

function defaultPageHideListener(callback: () => void): () => void {
  const handler = () => callback();
  window.addEventListener('pagehide', handler);
  return () => window.removeEventListener('pagehide', handler);
}
