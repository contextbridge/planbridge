import type { InboxFilters, InboxSnapshot } from '@contextbridge/shared/inboxSchema';
import { useEffect, useRef, useState } from 'react';
import type { InboxApiClient } from './apiClient.ts';

export type SnapshotStatus = 'loading' | 'loaded' | 'error';

export interface SnapshotState {
  readonly snapshot: InboxSnapshot | null;
  readonly status: SnapshotStatus;
  readonly error: Error | null;
}

export interface UseInboxSnapshotResult extends SnapshotState {
  readonly refresh: () => Promise<void>;
}

const LOADING_STATE: SnapshotState = Object.freeze({ snapshot: null, status: 'loading', error: null });

// The snapshot is fetched once and refreshed only on explicit user action.
// Section switching, draft/repository filtering, and sorting are all derived
// client-side from this snapshot — none of them re-hit GitHub. So the hook always
// fetches the same complete set; `fetchFilters` only scopes what the server
// returns (e.g. always include drafts so the client can toggle them locally).
export function useInboxSnapshot(apiClient: InboxApiClient, fetchFilters: InboxFilters = {}): UseInboxSnapshotResult {
  const [state, setState] = useState<SnapshotState>(LOADING_STATE);
  const filtersRef = useRef<InboxFilters>(fetchFilters);
  const mountedRef = useRef(true);
  const fetchIdRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const id = ++fetchIdRef.current;

    apiClient.fetchSnapshot(filtersRef.current).then(
      (result) => {
        if (!mountedRef.current || fetchIdRef.current !== id) return;
        setState({ snapshot: result, status: 'loaded', error: null });
      },
      (err: unknown) => {
        if (!mountedRef.current || fetchIdRef.current !== id) return;
        setState({
          snapshot: null,
          status: 'error',
          error: err instanceof Error ? err : new Error(String(err)),
        });
      },
    );
  }, [apiClient]);

  async function refresh(): Promise<void> {
    const id = ++fetchIdRef.current;
    setState(LOADING_STATE);
    try {
      const result = await apiClient.fetchSnapshot(filtersRef.current);
      if (!mountedRef.current || fetchIdRef.current !== id) return;
      setState({ snapshot: result, status: 'loaded', error: null });
    } catch (err: unknown) {
      if (!mountedRef.current || fetchIdRef.current !== id) return;
      setState({
        snapshot: null,
        status: 'error',
        error: err instanceof Error ? err : new Error(String(err)),
      });
    }
  }

  return { ...state, refresh };
}
