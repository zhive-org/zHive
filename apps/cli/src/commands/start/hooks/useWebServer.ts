import { randomBytes } from 'node:crypto';
import { useEffect, useMemo, useState } from 'react';
import open from 'open';
import { type BuildAppOptions, startWebServer, type WebServerHandle } from '../web/server';
import { extractErrorMessage } from '../../../shared/utils';

export type WebServerStatus =
  | { status: 'disabled' }
  | { status: 'starting' }
  | { status: 'listening'; url: string; port: number }
  | { status: 'error'; error: string };

interface UseWebServerArgs {
  port: number | undefined;
  /** Lazy accessors for the unified server. The HTTP server reads these on
   * every request, so it can bind once and survive any number of agent
   * select/exit cycles. */
  getRuntimeState: BuildAppOptions['getRuntimeState'];
  getAgents: BuildAppOptions['getAgents'];
  onSelect: BuildAppOptions['onSelect'];
  onExit: BuildAppOptions['onExit'];
  isStarting: BuildAppOptions['isStarting'];
  openInBrowser?: boolean;
  /** Optional pre-existing token. If omitted, a fresh one is generated and
   * persists for the lifetime of the Ink app. */
  authToken?: string;
}

export function useWebServer({
  port,
  getRuntimeState,
  getAgents,
  onSelect,
  onExit,
  isStarting,
  openInBrowser,
  authToken: providedAuthToken,
}: UseWebServerArgs): WebServerStatus {
  const [state, setState] = useState<WebServerStatus>({ status: 'disabled' });
  // Stable token for the lifetime of the Ink app. Regenerated only when the
  // process restarts — old browser tabs become unauthenticated, which is the
  // intended behavior.
  const authToken = useMemo(
    () => providedAuthToken ?? randomBytes(24).toString('base64url'),
    [providedAuthToken],
  );

  useEffect(() => {
    if (port === undefined) {
      setState({ status: 'disabled' });
      return;
    }

    let cancelled = false;
    let handle: WebServerHandle | null = null;

    setState({ status: 'starting' });
    startWebServer({
      port,
      authToken,
      getRuntimeState,
      getAgents,
      onSelect,
      onExit,
      isStarting,
    })
      .then((started) => {
        if (cancelled) {
          void started.stop();
          return;
        }
        handle = started;
        setState({ status: 'listening', url: started.url, port: started.port });
        if (openInBrowser) {
          // Fire-and-forget: failures (no display, headless env, etc.) shouldn't
          // crash the TUI — the URL is still printed for the user to copy.
          open(started.url).catch(() => {});
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ status: 'error', error: extractErrorMessage(err) });
      });

    return () => {
      cancelled = true;
      if (handle) void handle.stop();
    };
    // The accessors are intentionally NOT in the deps: they read mutable refs
    // and don't need to be referentially stable. Restarting the server on
    // every render would defeat the whole "single server" goal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [port, authToken, openInBrowser]);

  return state;
}
