/**
 * Shared time cursor for the backtest. The exchange and the data provider
 * read from this so they advance together. Treat it as authoritative —
 * never call Date.now() inside backtest code paths.
 */
export class BacktestClock {
  private _now: number;

  constructor(initialMs: number) {
    this._now = initialMs;
  }

  now(): number {
    return this._now;
  }

  set(ms: number): void {
    if (ms < this._now) {
      throw new Error(`BacktestClock cannot move backwards (${this._now} → ${ms})`);
    }
    this._now = ms;
  }
}
