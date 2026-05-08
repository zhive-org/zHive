import type { WebEventBus } from './events';

/**
 * Routes process-level errors and `console.error` / `console.warn` calls
 * into a `WebEventBus` so the dashboard's ActivityFeed surfaces them.
 *
 * Currently the agent runtime pushes its own errors (see `useAgent.ts`'s
 * `onError` callback). This bridge catches everything *else* — third-party
 * SDK errors (LangSmith, Hyperliquid 429s) that come through `console.error`,
 * and unhandled rejections / uncaught exceptions that escape the runtime
 * entirely.
 */

const MAX_MESSAGE_LENGTH = 1024;

function truncate(message: string): string {
  if (message.length <= MAX_MESSAGE_LENGTH) return message;
  return message.slice(0, MAX_MESSAGE_LENGTH) + '… [truncated]';
}

function formatArgs(args: unknown[]): string {
  return args
    .map((a) => {
      if (a instanceof Error) return a.stack ?? a.message;
      if (typeof a === 'string') return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ');
}

export interface ErrorBridgeHandle {
  detach: () => void;
}

export function attachErrorBridge(eventBus: WebEventBus): ErrorBridgeHandle {
  // Re-entry guard: if pushing to the bus itself triggers a console.error
  // (e.g., a downstream subscriber throws and Node logs it), we'd recurse
  // forever. The flag short-circuits the wrap during a push.
  let pushing = false;

  const safePush = (errorMessage: string): void => {
    if (pushing) return;
    pushing = true;
    try {
      eventBus.push({ type: 'error', errorMessage: truncate(errorMessage) });
    } catch {
      // Bus push failed (cap exceeded? schema mismatch?) — swallow rather
      // than re-enter the wrapped console.error.
    } finally {
      pushing = false;
    }
  };

  const originalConsoleError = console.error.bind(console);
  const originalConsoleWarn = console.warn.bind(console);

  // Wrap console.error to call the original AND push to the bus. We must
  // call the original first so users still see the message in the terminal.
  console.error = (...args: unknown[]) => {
    originalConsoleError(...args);
    safePush(formatArgs(args));
  };

  console.warn = (...args: unknown[]) => {
    originalConsoleWarn(...args);
    safePush(formatArgs(args));
  };

  const onUnhandledRejection = (reason: unknown): void => {
    const raw =
      reason instanceof Error
        ? (reason.stack ?? reason.message)
        : typeof reason === 'string'
          ? reason
          : (() => {
              try {
                return JSON.stringify(reason);
              } catch {
                return String(reason);
              }
            })();
    safePush(`Unhandled rejection: ${raw}`);
  };

  const onUncaughtException = (err: Error): void => {
    safePush(`Uncaught exception: ${err.stack ?? err.message}`);
  };

  process.on('unhandledRejection', onUnhandledRejection);
  process.on('uncaughtException', onUncaughtException);

  return {
    detach: () => {
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
      process.off('unhandledRejection', onUnhandledRejection);
      process.off('uncaughtException', onUncaughtException);
    },
  };
}
