import type { PlanReviewClient } from './PlanReviewClient.ts';

export type PageHideListener = (callback: () => void) => () => void;

/** Schedule a repeating callback. Returns a cancel function. */
export type ScheduleInterval = (handler: () => void, intervalMs: number) => () => void;

export interface StartHeartbeatOptions {
  intervalMs?: number;
  addPageHideListener?: PageHideListener;
  scheduleInterval?: ScheduleInterval;
}

export function startHeartbeat(
  client: Pick<PlanReviewClient, 'sendHeartbeat'>,
  options: StartHeartbeatOptions = {},
): () => void {
  const {
    intervalMs = 2_000,
    addPageHideListener = defaultPageHideListener,
    scheduleInterval = defaultScheduleInterval,
  } = options;

  void client.sendHeartbeat();

  const cancelInterval = scheduleInterval(() => void client.sendHeartbeat(), intervalMs);
  const removePageHideListener = addPageHideListener(() => {
    cancelInterval();
  });

  return () => {
    cancelInterval();
    removePageHideListener();
  };
}

function defaultPageHideListener(callback: () => void): () => void {
  const handler = () => callback();
  window.addEventListener('pagehide', handler);
  return () => window.removeEventListener('pagehide', handler);
}

function defaultScheduleInterval(handler: () => void, intervalMs: number): () => void {
  const id = setInterval(handler, intervalMs);
  return () => clearInterval(id);
}
