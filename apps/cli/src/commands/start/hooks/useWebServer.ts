import { randomBytes } from 'node:crypto';
import { useEffect, useMemo, useState } from 'react';
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
}

export function useWebServer({
  port,
  runtime,
  eventBus,
  control,
}: UseWebServerArgs): WebServerStatus {
  const [state, setState] = useState<WebServerStatus>({ status: 'disabled' });
  // Stable token for the lifetime of the Ink app. Regenerated only when the
  // process restarts — old browser tabs become unauthenticated, which is the
  // intended behavior.
  const authToken = useMemo(() => randomBytes(24).toString('base64url'), []);

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
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ status: 'error', error: extractErrorMessage(err) });
      });

    return () => {
      cancelled = true;
      if (handle) void handle.stop();
    };
  }, [port, runtime, eventBus, control, authToken]);

  return state;
}
