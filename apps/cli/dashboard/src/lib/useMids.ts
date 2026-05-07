import { useEffect, useMemo, useState } from 'react';
import { hyperliquidClient, type WsStatus } from './hyperliquid';

export interface MidsSnapshot {
  mids: Map<string, number>;
  status: WsStatus;
  tick: number;
}

const STATUS_RANK: Record<WsStatus, number> = {
  reconnecting: 0,
  stalled: 1,
  connecting: 2,
  live: 3,
};

const DEFAULT_DEX_SENTINEL = '__default__';

/** HIP-3 builder DEX coins are namespaced like `xyz:AAPL`; the prefix is the dex name. */
function coinToDex(coin: string): string | undefined {
  const i = coin.indexOf(':');
  if (i <= 0) return undefined;
  return coin.slice(0, i);
}

function worstStatus(statuses: WsStatus[]): WsStatus {
  if (statuses.length === 0) return 'connecting';
  let worst = statuses[0];
  for (const s of statuses) {
    if (STATUS_RANK[s] < STATUS_RANK[worst]) worst = s;
  }
  return worst;
}

/**
 * Subscribes to Hyperliquid `allMids` for every dex implied by `coins[]`.
 * `xyz:TSLA` → opens an `xyz` dex client; `BTC` → opens the default-dex
 * client; the merged result is keyed by the original full coin string so
 * `mids.get('xyz:TSLA')` and `mids.get('BTC')` both work.
 *
 * Mirrors zhive-app's MarketGrid pattern (split by prefix, one client per dex,
 * merge price maps).
 */
export function useMids(coins: string[]): MidsSnapshot {
  const dexKey = useMemo(() => {
    const set = new Set<string>();
    for (const c of coins) {
      set.add(coinToDex(c) ?? DEFAULT_DEX_SENTINEL);
    }
    return Array.from(set).sort().join(',');
  }, [coins]);

  const dexes = useMemo<(string | undefined)[]>(() => {
    if (dexKey === '') return [];
    return dexKey.split(',').map((d) => (d === DEFAULT_DEX_SENTINEL ? undefined : d));
  }, [dexKey]);

  const [snapshot, setSnapshot] = useState<MidsSnapshot>(() => ({
    mids: new Map(),
    status: 'connecting',
    tick: 0,
  }));

  useEffect(() => {
    if (dexes.length === 0) return;

    const perDexMids: Map<string | undefined, Map<string, number>> = new Map();
    const perDexStatus: Map<string | undefined, WsStatus> = new Map();

    const recompute = (): void => {
      const merged = new Map<string, number>();
      for (const m of perDexMids.values()) {
        for (const [k, v] of m) merged.set(k, v);
      }
      const status = worstStatus(Array.from(perDexStatus.values()));
      setSnapshot((prev) => ({ mids: merged, status, tick: prev.tick + 1 }));
    };

    const unsubscribers: Array<() => void> = [];
    for (const dex of dexes) {
      const client = hyperliquidClient(dex);
      client.start();
      const off = client.subscribe((mids, status) => {
        perDexMids.set(dex, new Map(mids));
        perDexStatus.set(dex, status);
        recompute();
      });
      unsubscribers.push(off);
    }

    return () => {
      for (const off of unsubscribers) off();
    };
  }, [dexes]);

  return snapshot;
}
