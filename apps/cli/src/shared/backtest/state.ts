/**
 * Process-wide singleton tracking the currently running backtest, if any.
 *
 * The CLI runs at most one backtest at a time per process. Concurrent
 * invocations would clobber the shared `./backtest-results/*.jsonl` artifacts
 * truncated at the start of each `BacktestRunner.run`. The chat session and
 * both backtest entry points (CLI command and `/backtest` slash command) live
 * in the same Node process, so a module-level mutable handle is sufficient.
 */

export type BacktestSource = 'cli' | 'chat';

export interface BacktestProgress {
  startedAt: number;
  from: number;
  to: number;
  currentTime: number;
  intervalMs: number;
  ticksCompleted: number;
  totalTicks: number;
  percent: number;
  watchList: string[];
  initialCashUsd: number;
  currentEquity: number | null;
  source: BacktestSource;
}

export interface BacktestSessionInit {
  from: number;
  to: number;
  intervalMs: number;
  initialCashUsd: number;
  watchList: string[];
  source: BacktestSource;
}

export interface BacktestSessionHandle {
  tick(args: { currentTime: number; currentEquity: number }): void;
  finish(): void;
  fail(err: unknown): void;
}

let active: BacktestProgress | null = null;

export function getRunningBacktest(): BacktestProgress | null {
  return active ? { ...active } : null;
}

export function startBacktestSession(init: BacktestSessionInit): BacktestSessionHandle {
  if (active) {
    throw new Error('A backtest is already running');
  }
  const totalTicks = Math.max(1, Math.ceil((init.to - init.from) / init.intervalMs) + 1);
  active = {
    startedAt: Date.now(),
    from: init.from,
    to: init.to,
    currentTime: init.from,
    intervalMs: init.intervalMs,
    ticksCompleted: 0,
    totalTicks,
    percent: 0,
    watchList: [...init.watchList],
    initialCashUsd: init.initialCashUsd,
    currentEquity: null,
    source: init.source,
  };
  return {
    tick({ currentTime, currentEquity }) {
      if (!active) return;
      active.currentTime = currentTime;
      active.currentEquity = currentEquity;
      active.ticksCompleted += 1;
      const span = active.to - active.from;
      active.percent = span > 0 ? Math.min(100, ((currentTime - active.from) / span) * 100) : 100;
    },
    finish() {
      active = null;
    },
    fail(_err) {
      active = null;
    },
  };
}

export function tryStartBacktestSession(
  init: BacktestSessionInit,
): { handle: BacktestSessionHandle } | { running: BacktestProgress } {
  if (active) return { running: { ...active } };
  return { handle: startBacktestSession(init) };
}
