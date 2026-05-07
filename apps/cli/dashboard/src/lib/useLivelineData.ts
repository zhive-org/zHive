import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { LivelinePoint } from 'liveline';
import { priceBufferStore } from './priceBufferStore';

interface UseLivelineDataOptions {
  maxPoints?: number;
  windowSecs?: number;
  seriesKey?: string;
  minWindowSecs?: number;
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value);
}

/**
 * Live-only liveline buffer hook. Appends every Hyperliquid WS tick under
 * the given seriesKey and exposes a rolling window for `<Liveline>`. Multiple
 * consumers of the same seriesKey share one buffer (and a BTC tick only
 * re-renders BTC consumers).
 */
export function useLivelineData(
  livePrice: number | null | undefined,
  options: UseLivelineDataOptions = {},
): { data: LivelinePoint[]; value: number; activeWindowSecs: number } {
  const { maxPoints = 720, windowSecs = 30, seriesKey = '', minWindowSecs = 3 } = options;
  const normalizedLivePrice = isFiniteNumber(livePrice) ? livePrice : null;

  const bufferKey = `price:${seriesKey}`;
  const policy = useMemo(
    () => ({ maxPoints, initialWindowSecs: minWindowSecs }),
    [maxPoints, minWindowSecs],
  );

  // Append on every real tick; re-register stall handler so it closes over
  // the latest known price.
  useEffect(() => {
    if (normalizedLivePrice == null) return;
    const appendNow = (): void => {
      priceBufferStore.appendPoint(
        bufferKey,
        { time: Date.now() / 1000, value: normalizedLivePrice },
        policy,
      );
    };
    appendNow();
    const unregister = priceBufferStore.registerStallHandler(bufferKey, appendNow);
    return unregister;
  }, [bufferKey, normalizedLivePrice, policy]);

  const subscribe = useCallback(
    (cb: () => void) => priceBufferStore.subscribe(bufferKey, cb),
    [bufferKey],
  );
  const getSnapshot = useCallback(() => priceBufferStore.getSnapshot(bufferKey), [bufferKey]);
  const buffer = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const value = normalizedLivePrice ?? buffer[buffer.length - 1]?.value ?? 0;
  const firstPoint = buffer[0];
  const lastPoint = buffer[buffer.length - 1];
  const seriesSpanSecs =
    firstPoint && lastPoint ? Math.max(0, Math.ceil(lastPoint.time - firstPoint.time)) : 0;
  const activeWindowSecs = Math.min(windowSecs, Math.max(minWindowSecs, seriesSpanSecs || 0));

  return { data: buffer, value, activeWindowSecs };
}
