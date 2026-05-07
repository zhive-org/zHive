import {
  HttpRequestError,
  type AllMidsParameters,
  type AllMidsResponse,
  type CandleSnapshotParameters,
  type CandleSnapshotResponse,
  type ClearinghouseStateParameters,
  type ClearinghouseStateResponse,
  type InfoClient,
  type MetaAndAssetCtxsParameters,
  type MetaAndAssetCtxsResponse,
  type SpotClearinghouseStateParameters,
  type SpotClearinghouseStateResponse,
} from '@nktkas/hyperliquid';
import { TtlCache } from '../cache/ttl-cache';

const DEFAULT_META_TTL_MS = 30_000;
const DEFAULT_CANDLE_TTL_MS = 30_000;

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_MAX_DELAY_MS = 8_000;

export interface RetryConfig {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export class HyperliquidService {
  private metaCache: TtlCache<MetaAndAssetCtxsResponse>;
  private candleCache: TtlCache<CandleSnapshotResponse>;
  private maxAttempts: number;
  private baseDelayMs: number;
  private maxDelayMs: number;

  constructor(
    private info: InfoClient,
    opts: { metaTtlMs?: number; candleTtlMs?: number; retry?: RetryConfig } = {},
  ) {
    this.metaCache = new TtlCache(opts.metaTtlMs ?? DEFAULT_META_TTL_MS);
    this.candleCache = new TtlCache(opts.candleTtlMs ?? DEFAULT_CANDLE_TTL_MS);
    this.maxAttempts = opts.retry?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    this.baseDelayMs = opts.retry?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
    this.maxDelayMs = opts.retry?.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  }

  metaAndAssetCtxs(args?: MetaAndAssetCtxsParameters): Promise<MetaAndAssetCtxsResponse> {
    const key = `dex=${args?.dex ?? ''}`;
    return this.metaCache.getOrFetch(key, () => this.retry(() => this.info.metaAndAssetCtxs(args)));
  }

  candleSnapshot(args: CandleSnapshotParameters): Promise<CandleSnapshotResponse> {
    const key = `${args.coin}|${args.interval}|${args.startTime}|${args.endTime}`;
    return this.candleCache.getOrFetch(key, () => this.retry(() => this.info.candleSnapshot(args)));
  }

  allMids(params: AllMidsParameters = {}): Promise<AllMidsResponse> {
    return this.retry(() => this.info.allMids(params));
  }

  clearinghouseState(args: ClearinghouseStateParameters): Promise<ClearinghouseStateResponse> {
    return this.retry(() => this.info.clearinghouseState(args));
  }

  spotClearinghouseState(
    args: SpotClearinghouseStateParameters,
  ): Promise<SpotClearinghouseStateResponse> {
    return this.retry(() => this.info.spotClearinghouseState(args));
  }

  private async retry<T>(fn: () => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (!isRateLimited(err) || attempt === this.maxAttempts) {
          throw err;
        }
        const delay = this.computeDelay(err, attempt);
        await sleep(delay);
      }
    }
    throw lastErr;
  }

  private computeDelay(err: unknown, attempt: number): number {
    const retryAfter = parseRetryAfter(err);
    if (retryAfter !== null) {
      return retryAfter;
    }
    const exp = Math.min(this.maxDelayMs, this.baseDelayMs * 2 ** (attempt - 1));
    return Math.random() * exp;
  }
}

function isRateLimited(err: unknown): err is HttpRequestError {
  return err instanceof HttpRequestError && err.response?.status === 429;
}

function parseRetryAfter(err: unknown): number | null {
  if (!(err instanceof HttpRequestError) || !err.response) return null;
  const raw = err.response.headers.get('retry-after');
  if (!raw) return null;
  const seconds = parseInt(raw, 10);
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  return seconds * 1000;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
