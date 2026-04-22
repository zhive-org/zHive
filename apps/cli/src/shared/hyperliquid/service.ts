import type {
  AllMidsParameters,
  AllMidsResponse,
  CandleSnapshotParameters,
  CandleSnapshotResponse,
  InfoClient,
  MetaAndAssetCtxsParameters,
  MetaAndAssetCtxsResponse,
} from '@nktkas/hyperliquid';
import { TtlCache } from '../cache/ttl-cache';

const DEFAULT_META_TTL_MS = 30_000;
const DEFAULT_CANDLE_TTL_MS = 30_000;

export class HyperliquidService {
  private metaCache: TtlCache<MetaAndAssetCtxsResponse>;
  private candleCache: TtlCache<CandleSnapshotResponse>;

  constructor(
    public readonly info: InfoClient,
    opts: { metaTtlMs?: number; candleTtlMs?: number } = {},
  ) {
    this.metaCache = new TtlCache(opts.metaTtlMs ?? DEFAULT_META_TTL_MS);
    this.candleCache = new TtlCache(opts.candleTtlMs ?? DEFAULT_CANDLE_TTL_MS);
  }

  metaAndAssetCtxs(args?: MetaAndAssetCtxsParameters): Promise<MetaAndAssetCtxsResponse> {
    const key = `dex=${args?.dex ?? ''}`;
    return this.metaCache.getOrFetch(key, () => this.info.metaAndAssetCtxs(args));
  }

  candleSnapshot(args: CandleSnapshotParameters): Promise<CandleSnapshotResponse> {
    const key = `${args.coin}|${args.interval}|${args.startTime}|${args.endTime}`;
    return this.candleCache.getOrFetch(key, () => this.info.candleSnapshot(args));
  }

  allMids(params: AllMidsParameters = {}): Promise<AllMidsResponse> {
    return this.info.allMids(params);
  }
}
