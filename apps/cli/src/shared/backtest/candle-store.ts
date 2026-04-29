import { HttpTransport, InfoClient } from '@nktkas/hyperliquid';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getHiveDir } from '../config/constant';
import { HyperLiquidTimeframe } from '../tools/pinescript/providers/hyperliquid/timeframe';
import { timeframeToMs } from '../tools/pinescript/providers/hyperliquid/utils';
import { Interval, RawCandle } from './types';

const CACHE_DIR = path.join(getHiveDir(), 'backtest-cache');

// Hyperliquid candleSnapshot caps per-call results; we page in windows.
const MAX_CANDLES_PER_REQUEST = 5000;

// When we have to fetch, extend the window past `to` by this many candles so
// repeated calls walking forward through time amortize across one HTTP fetch.
const LOOKAHEAD_CANDLES = 1000;

interface Range {
  from: number;
  to: number;
}

export interface PrefetchOptions {
  coins: string[];
  intervals: Interval[];
  from: number;
  to: number;
}

/**
 * Local OHLC cache. One JSONL file per (coin, interval). Candles for a
 * (coin, interval) are loaded lazily on first read: disk cache is consulted,
 * any uncovered time range is fetched from Hyperliquid in a chunk, then
 * served from the in-memory series via binary search.
 */
export class CandleStore {
  private series = new Map<string, RawCandle[]>(); // key = `${coin}|${interval}`
  private loadedRanges = new Map<string, Range[]>(); // sorted, merged
  private diskLoaded = new Set<string>();
  private inflight = new Map<string, Promise<void>>();

  private constructor(private info: InfoClient | null) {}

  static async create(): Promise<CandleStore> {
    const transport = new HttpTransport();
    const info = new InfoClient({ transport });
    return new CandleStore(info);
  }

  /** Test helper: build a store from in-memory candles. */
  static fromSeed(seed: Array<{ coin: string; interval: Interval; candles: RawCandle[] }>): CandleStore {
    const s = new CandleStore(null);
    for (const { coin, interval, candles } of seed) {
      const key = CandleStore.keyFor(coin, interval);
      const sorted = [...candles].sort((a, b) => a.t - b.t);
      s.series.set(key, sorted);
      s.diskLoaded.add(key);
      // Mark seed as covering an unbounded range so reads don't try to fetch.
      s.loadedRanges.set(key, [{ from: -Infinity, to: Infinity }]);
    }
    return s;
  }

  static keyFor(coin: string, interval: Interval): string {
    return `${coin}|${interval}`;
  }

  static cachePath(coin: string, interval: Interval): string {
    const safe = coin.replace(/[^A-Za-z0-9_-]/g, '_');
    return path.join(CACHE_DIR, `${safe}-${interval}.jsonl`);
  }

  /**
   * Optional warm-up. With lazy reads this is no longer required, but it
   * remains useful when callers want to front-load the disk/network cost.
   */
  async prefetch(opts: PrefetchOptions): Promise<void> {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    for (const coin of opts.coins) {
      for (const interval of opts.intervals) {
        await this.ensureWindow(coin, interval, opts.from, opts.to);
      }
    }
  }

  /** Returns candles in the [from, to) window, fetching lazily as needed. */
  async getCandles(coin: string, interval: Interval, from: number, to: number): Promise<RawCandle[]> {
    if (to <= from) return [];
    await this.ensureWindow(coin, interval, from, to);
    const arr = this.series.get(CandleStore.keyFor(coin, interval));
    if (!arr || arr.length === 0) return [];
    const lo = lowerBoundByOpenTime(arr, from);
    const hi = lowerBoundByOpenTime(arr, to);
    return arr.slice(lo, hi);
  }

  /**
   * Returns the candle whose [t, T] bracket contains `ts`. If `ts` lies in a
   * gap, returns the most recent candle whose openTime <= ts. Returns null
   * only if the series is empty or ts predates the first candle.
   */
  async getCandleAt(coin: string, interval: Interval, ts: number): Promise<RawCandle | null> {
    const tfMs = timeframeToMs(interval as HyperLiquidTimeframe);
    // Pull in a one-bar window covering ts so we always have the bracket.
    await this.ensureWindow(coin, interval, ts - tfMs, ts + 1);
    const arr = this.series.get(CandleStore.keyFor(coin, interval));
    if (!arr || arr.length === 0) return null;
    const idx = lowerBoundByOpenTime(arr, ts + 1) - 1;
    if (idx < 0) return null;
    return arr[idx];
  }

  /**
   * Ensure the [from, to) window is present in memory for (coin, interval).
   * Reads disk on first access and fetches any uncovered subranges over the
   * network. Concurrent calls for the same key are deduped.
   */
  async ensureWindow(coin: string, interval: Interval, from: number, to: number): Promise<void> {
    if (to <= from) return;
    if (!this.info) return; // seeded store: nothing to fetch.

    const key = CandleStore.keyFor(coin, interval);

    // Wait for any in-flight load for this key, then re-check coverage.
    while (this.inflight.has(key)) {
      await this.inflight.get(key);
    }

    if (!this.diskLoaded.has(key)) {
      const p = this._loadFromDisk(key, coin, interval);
      this.inflight.set(key, p);
      try {
        await p;
      } finally {
        this.inflight.delete(key);
      }
    }

    const ranges = this.loadedRanges.get(key) ?? [];
    const gaps = uncoveredSpans(ranges, from, to);
    if (gaps.length === 0) return;

    const p = this._fetchAndMerge(key, coin, interval, gaps);
    this.inflight.set(key, p);
    try {
      await p;
    } finally {
      this.inflight.delete(key);
    }
  }

  private async _loadFromDisk(key: string, coin: string, interval: Interval): Promise<void> {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const file = CandleStore.cachePath(coin, interval);
    const cached = await readJsonl(file);
    this.series.set(key, cached);
    const cov = bracketCoverage(cached);
    this.loadedRanges.set(key, cov ? [{ from: cov.from, to: cov.to }] : []);
    this.diskLoaded.add(key);
  }

  private async _fetchAndMerge(
    key: string,
    coin: string,
    interval: Interval,
    gaps: Range[],
  ): Promise<void> {
    const tfMs = timeframeToMs(interval as HyperLiquidTimeframe);
    const file = CandleStore.cachePath(coin, interval);
    const ranges = this.loadedRanges.get(key) ?? [];
    let merged = this.series.get(key) ?? [];

    for (const gap of gaps) {
      // Extend the gap forward by a lookahead chunk so that the typical
      // walk-forward read pattern hits in-memory data on subsequent ticks.
      const extendedTo = gap.to + LOOKAHEAD_CANDLES * tfMs;
      const fetched = await this._fetchRange(coin, interval, gap.from, extendedTo);
      merged = mergeCandles(merged, fetched);
      ranges.push({ from: gap.from, to: extendedTo });
    }

    this.series.set(key, merged);
    this.loadedRanges.set(key, mergeRanges(ranges));
    await writeJsonl(file, merged);
  }

  private async _fetchRange(
    coin: string,
    interval: Interval,
    from: number,
    to: number,
  ): Promise<RawCandle[]> {
    if (!this.info) {
      throw new Error('CandleStore was constructed without a network client');
    }
    const tfMs = timeframeToMs(interval as HyperLiquidTimeframe);
    const out: RawCandle[] = [];
    let cursor = from;

    while (cursor < to) {
      const windowEnd = Math.min(to, cursor + MAX_CANDLES_PER_REQUEST * tfMs);
      const raw = await this.info.candleSnapshot({
        coin,
        interval,
        startTime: cursor,
        endTime: windowEnd,
      });
      if (raw.length === 0) {
        cursor = windowEnd;
        continue;
      }

      for (const c of raw) {
        out.push({
          t: c.t,
          T: c.T,
          o: parseFloat(c.o),
          h: parseFloat(c.h),
          l: parseFloat(c.l),
          c: parseFloat(c.c),
          v: parseFloat(c.v),
          n: c.n,
        });
      }

      const lastT = raw[raw.length - 1].t;
      cursor = Math.max(lastT + tfMs, cursor + tfMs);
    }

    return out;
  }
}

function lowerBoundByOpenTime(arr: RawCandle[], ts: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid].t < ts) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function bracketCoverage(arr: RawCandle[]): { from: number; to: number } | null {
  if (arr.length === 0) return null;
  return { from: arr[0].t, to: arr[arr.length - 1].T };
}

function mergeCandles(a: RawCandle[], b: RawCandle[]): RawCandle[] {
  if (a.length === 0) return [...b].sort((x, y) => x.t - y.t);
  if (b.length === 0) return a;
  const seen = new Map<number, RawCandle>();
  for (const c of a) seen.set(c.t, c);
  for (const c of b) seen.set(c.t, c); // newer wins
  return Array.from(seen.values()).sort((x, y) => x.t - y.t);
}

/** Returns subranges of [from, to) not covered by `ranges` (sorted, merged). */
function uncoveredSpans(ranges: Range[], from: number, to: number): Range[] {
  const out: Range[] = [];
  let cursor = from;
  for (const r of ranges) {
    if (r.to <= cursor) continue;
    if (r.from >= to) break;
    if (r.from > cursor) out.push({ from: cursor, to: Math.min(r.from, to) });
    cursor = Math.max(cursor, r.to);
    if (cursor >= to) break;
  }
  if (cursor < to) out.push({ from: cursor, to });
  return out;
}

function mergeRanges(ranges: Range[]): Range[] {
  if (ranges.length === 0) return ranges;
  const sorted = [...ranges].sort((a, b) => a.from - b.from);
  const out: Range[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    const cur = sorted[i];
    if (cur.from <= last.to) {
      last.to = Math.max(last.to, cur.to);
    } else {
      out.push(cur);
    }
  }
  return out;
}

async function readJsonl(file: string): Promise<RawCandle[]> {
  try {
    const txt = await fs.readFile(file, 'utf8');
    return txt
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as RawCandle);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function writeJsonl(file: string, candles: RawCandle[]): Promise<void> {
  const body = candles.map((c) => JSON.stringify(c)).join('\n') + '\n';
  await fs.writeFile(file, body, 'utf8');
}
