import { randomBytes } from 'node:crypto';
import { useEffect, useMemo, useState } from 'react';
import open from 'open';
import { AgentRuntime } from '../../../shared/agent/runtime';
import { startWebServer, type WebServerHandle } from '../web/server';
import type { WebEventBus } from '../web/events';
import type { WebControl } from '../web/control';
import { extractErrorMessage } from '../../../shared/megathread/utils';

export type WebServerStatus =
  | { status: 'disabled' }
  | { status: 'starting' }
  | { status: 'listening'; url: string; port: number }
  | { status: 'error'; error: string };

interface UseWebServerArgs {
  port: number | undefined;
  runtime: AgentRuntime | undefined;
  eventBus: WebEventBus;
  control: WebControl;
  openInBrowser?: boolean;
  /** Optional pre-existing token (e.g. inherited from the picker server so the
   * already-open browser tab stays authenticated across the server swap). */
  authToken?: string;
}

export function useWebServer({
  port,
  runtime,
  eventBus,
  control,
  openInBrowser,
  authToken: providedAuthToken,
}: UseWebServerArgs): WebServerStatus {
  const [state, setState] = useState<WebServerStatus>({ status: 'disabled' });
  // Stable token for the lifetime of the Ink app. Regenerated only when the
  // process restarts — old browser tabs become unauthenticated, which is the
  // intended behavior. If the caller passed one in (handoff from picker), use
  // that instead so the open browser tab keeps its cookie.
  const authToken = useMemo(
    () => providedAuthToken ?? randomBytes(24).toString('base64url'),
    [providedAuthToken],
  );

  useEffect(() => {
    if (port === undefined) {
      setState({ status: 'disabled' });
      return;
    }
    if (!runtime) return;

    let cancelled = false;
    let handle: WebServerHandle | null = null;

    setState({ status: 'starting' });
    startWebServer({ port, eventBus, control, authToken })
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
  }, [port, runtime, eventBus, control, authToken, openInBrowser]);

  return state;
}
