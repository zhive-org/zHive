import { memo, useMemo } from 'react';
import { Liveline } from 'liveline';
import type { LivelinePoint, Momentum } from 'liveline';
import { formatUsd } from '../lib/format';
import { useLivelineData } from '../lib/useLivelineData';

const COLOR_BULLISH = '#27C587';
const COLOR_BEARISH = '#E14B4B';
const WINDOW_SECS = 30;
// 1s initial window — keeps liveline's visible-point filter happy on first paint.
const INITIAL_WINDOW_SECS = 1;

// Stable references for `<Liveline>` props. The mids WS feed re-renders the
// chart's parent on every tick; if these were inline-literal each render,
// Liveline sees a new prop reference and treats it as a "config changed"
// signal — which in practice resets its internal animation/canvas state
// and produces visible flicker + lost history. Hoisting to module scope
// gives Liveline reference-stable inputs so it only updates when `data`
// or `value` actually change.
const LIVELINE_PADDING = { top: 4, bottom: 4, left: 4, right: 4 };
const LIVELINE_STYLE = { width: '100%', height: '100%' };
const LIVELINE_DEGEN = { scale: 0.7, downMomentum: true } as const;
const formatLivelineValue = (v: number): string => formatUsd(v);

interface LivelineMiniChartProps {
  symbol: string;
  livePrice: number | null | undefined;
  className?: string;
}

function getLivelineMomentum(points: LivelinePoint[]): Momentum {
  if (points.length < 2) return 'up';

  const start = Math.max(0, points.length - 20);
  let min = Infinity;
  let max = -Infinity;
  for (let i = start; i < points.length; i++) {
    const v = points[i]?.value ?? 0;
    if (v < min) min = v;
    if (v > max) max = v;
  }

  const tailStart = Math.max(start, points.length - 5);
  const first = points[tailStart]?.value ?? points[0]?.value ?? 0;
  const last = points[points.length - 1]?.value ?? first;
  const delta = last - first;
  const range = max - min;

  if (range > 0) {
    const threshold = range * 0.12;
    if (delta > threshold) return 'up';
    if (delta < -threshold) return 'down';
  }
  return last >= first ? 'up' : 'down';
}

function LivelineMiniChartInner({ symbol, livePrice, className }: LivelineMiniChartProps) {
  const { data, value, activeWindowSecs } = useLivelineData(livePrice, {
    maxPoints: 720,
    windowSecs: WINDOW_SECS,
    minWindowSecs: INITIAL_WINDOW_SECS,
    seriesKey: symbol,
  });
  const hasData = data.length > 1;
  const momentum = useMemo(() => getLivelineMomentum(data), [data]);
  const lineColor = momentum === 'down' ? COLOR_BEARISH : COLOR_BULLISH;

  return (
    <div className={`relative h-full w-full bg-hive-near-black ${className ?? ''}`}>
      <Liveline
        data={data}
        value={value}
        color={lineColor}
        theme="dark"
        window={activeWindowSecs}
        loading={!hasData}
        grid={false}
        fill
        momentum={momentum}
        degen={LIVELINE_DEGEN}
        badge={false}
        scrub={false}
        formatValue={formatLivelineValue}
        padding={LIVELINE_PADDING}
        style={LIVELINE_STYLE}
      />
    </div>
  );
}

// React.memo skips re-renders when symbol/livePrice/className haven't
// changed by value. Without it, every mids WS tick (~1Hz per coin)
// re-renders EVERY watchlist row, including the ones whose price didn't
// change — N coins × per-tick re-renders for no reason, and each one
// touches Liveline's prop interface even though our hoist made the props
// referentially stable. Memo turns this into "only re-render the row
// whose price actually changed."
export const LivelineMiniChart = memo(LivelineMiniChartInner);
