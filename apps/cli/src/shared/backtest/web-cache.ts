/**
 * Process-wide cache for the most recent web-initiated backtest result.
 *
 * Lives outside `app.tsx` so both the runtime (writer) and the web server
 * routes (reader in `web/server.ts`) can share state without a circular
 * import. The CLI singleton lock in `state.ts` covers the run-in-flight
 * progress; this module covers the terminal completed/failed states the
 * `/api/backtest/status` route returns once the run has wrapped up.
 *
 * Cleared on agent exit alongside `resetBacktestState()` so a re-entered
 * dashboard doesn't surface the previous agent's result.
 */

import type { BacktestSummary } from './runner';

let latestSummary: BacktestSummary | null = null;
let latestError: string | null = null;

export function setBacktestResult(summary: BacktestSummary | null): void {
  latestSummary = summary;
}

export function setBacktestError(error: string | null): void {
  latestError = error;
}

export function getBacktestResult(): BacktestSummary | null {
  return latestSummary;
}

export function getBacktestError(): string | null {
  return latestError;
}

export function resetBacktestCache(): void {
  latestSummary = null;
  latestError = null;
}
