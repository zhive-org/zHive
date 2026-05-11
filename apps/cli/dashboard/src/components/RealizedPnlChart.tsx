import { useEffect, useMemo, useRef, useState } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { useQuery } from '@tanstack/react-query';
import { fetchAgentPortfolio } from '../lib/api';
import { formatPercent, formatUsd } from '../lib/format';
import type { PortfolioRange } from '../lib/types';

const RANGES: PortfolioRange[] = ['7d', '30d', '90d', 'all'];

const HONEY = '#F5A623';
const HONEY_FILL = 'rgba(245,166,35,0.10)';
const BEARISH = '#E14B4B';
const BEARISH_FILL = 'rgba(225,75,75,0.10)';
const AXIS_STROKE = '#555555';
const GRID_STROKE = 'rgba(204,204,204,0.08)';

interface RealizedPnlChartProps {
  height?: number;
}

interface ChartSeries {
  /** Days from window start, 0-indexed. uPlot wants strictly ascending. */
  t: Float64Array;
  /** Cumulative realized PnL per day (starts at 0). */
  pnl: Float64Array;
  /** Date labels aligned with `t` for tooltip / axis display (MM-DD). */
  dates: string[];
}

function formatShortDate(iso: string): string {
  // Server gives YYYY-MM-DD; show MM-DD to fit the axis.
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[1]}-${m[2]}` : iso;
}

function buildSeries(dailyPnl: { date: string; realized_pnl_usd: number }[]): ChartSeries {
  // Always start at 0 so the chart shows the baseline even when the agent
  // has zero closed trades in range.
  const t = new Float64Array(dailyPnl.length + 1);
  const pnl = new Float64Array(dailyPnl.length + 1);
  const dates: string[] = ['start'];
  t[0] = 0;
  pnl[0] = 0;
  let cumulative = 0;
  for (let i = 0; i < dailyPnl.length; i++) {
    cumulative += dailyPnl[i].realized_pnl_usd;
    t[i + 1] = i + 1;
    pnl[i + 1] = cumulative;
    dates.push(formatShortDate(dailyPnl[i].date));
  }
  return { t, pnl, dates };
}

export function RealizedPnlChart({ height = 240 }: RealizedPnlChartProps) {
  const [range, setRange] = useState<PortfolioRange>('all');

  const portfolioQuery = useQuery({
    queryKey: ['agent-portfolio', range],
    queryFn: () => fetchAgentPortfolio(range),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const data = portfolioQuery.data;
  const startingEquity = data?.starting_equity_usd ?? 0;
  const netRealized = useMemo(
    () => (data?.daily_pnl ?? []).reduce((sum, e) => sum + e.realized_pnl_usd, 0),
    [data],
  );
  const roi = startingEquity > 0 ? (netRealized / startingEquity) * 100 : 0;
  const isPositive = netRealized >= 0;
  const pnlColor = isPositive ? 'text-hive-bullish' : 'text-hive-bearish';

  const series = useMemo<ChartSeries>(() => {
    if (!data) return { t: new Float64Array([0]), pnl: new Float64Array([0]), dates: ['—'] };
    return buildSeries(data.daily_pnl);
  }, [data]);

  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
  const seriesRef = useRef(series);
  // Keep the stable color tied to the SIGN of cumulative PnL — flipping
  // colors on every refetch would be visual noise.
  const color = isPositive ? HONEY : BEARISH;
  const fill = isPositive ? HONEY_FILL : BEARISH_FILL;

  useEffect(() => {
    seriesRef.current = series;
  }, [series]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const opts: uPlot.Options = {
      width: el.clientWidth,
      height,
      padding: [12, 16, 8, 8],
      cursor: { drag: { x: false, y: false }, points: { size: 6 } },
      legend: { show: false },
      scales: {
        x: { time: false },
        y: {
          // Auto-range hugs data extents, which lets the line clip the top
          // gridline. Anchor to zero and add ~12% headroom on the active side
          // so the peak/trough breathes.
          range: (_u, dmin, dmax) => {
            const lo = dmin > 0 ? 0 : dmin;
            const hi = dmax < 0 ? 0 : dmax;
            const span = Math.max(hi - lo, 1);
            const pad = span * 0.12;
            return [lo === 0 ? 0 : lo - pad, hi === 0 ? 0 : hi + pad];
          },
        },
      },
      axes: [
        {
          stroke: AXIS_STROKE,
          font: '11px "JetBrains Mono", monospace',
          grid: { stroke: GRID_STROKE, width: 1 },
          ticks: { stroke: GRID_STROKE },
          // Pick ~6 evenly spaced integer indices so MM-DD labels don't
          // overlap regardless of the active range (7d–all).
          splits: (u, _axisIdx, scaleMin, scaleMax) => {
            const len = seriesRef.current.dates.length;
            if (len <= 1) return [0];
            const plotW = u.bbox.width / devicePixelRatio;
            const target = Math.max(2, Math.min(8, Math.floor(plotW / 80)));
            const lo = Math.max(0, Math.ceil(scaleMin));
            const hi = Math.min(len - 1, Math.floor(scaleMax));
            const span = hi - lo;
            if (span <= 0) return [lo];
            const step = Math.max(1, Math.ceil(span / (target - 1)));
            const out: number[] = [];
            for (let i = lo; i <= hi; i += step) out.push(i);
            if (out[out.length - 1] !== hi) out.push(hi);
            return out;
          },
          values: (_u, splits) =>
            splits.map((tickIdx) => {
              const labels = seriesRef.current.dates;
              const i = Math.round(tickIdx);
              return labels[i] ?? '';
            }),
        },
        {
          stroke: AXIS_STROKE,
          font: '11px "JetBrains Mono", monospace',
          size: 64,
          grid: { stroke: GRID_STROKE, width: 1 },
          ticks: { stroke: GRID_STROKE },
          values: (_u, splits) =>
            splits.map((value) => {
              const sign = value < 0 ? '-' : '';
              const abs = Math.abs(value);
              if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
              return `${sign}$${abs.toFixed(0)}`;
            }),
        },
      ],
      series: [
        {},
        {
          stroke: color,
          width: 2,
          fill,
          points: { show: false },
        },
      ],
    };

    plotRef.current = new uPlot(opts, [series.t, series.pnl], el);

    // Idempotency guard: ResizeObserver can fire on our own setSize calls,
    // and inside a grid track without `min-w-0` that's enough to feed back
    // into the track's min-content sizing and inflate the chart 1px per
    // frame indefinitely. Skip when the measured width is unchanged.
    const onResize = (): void => {
      if (!plotRef.current || !el) return;
      const w = el.clientWidth;
      if (w === 0 || w === plotRef.current.width) return;
      plotRef.current.setSize({ width: w, height });
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(el);

    return () => {
      observer.disconnect();
      plotRef.current?.destroy();
      plotRef.current = null;
    };
    // Color changes are picked up on the next data update via setData — no
    // need to tear down the plot for them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    plotRef.current?.setData([series.t, series.pnl]);
  }, [series]);

  return (
    <section className="border border-hive-border bg-hive-near-black">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-hive-border px-4 py-3">
        <div className="flex items-baseline gap-3">
          <h2 className="font-mono text-xs font-medium uppercase tracking-wider text-hive-text-secondary">
            Realized PnL
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-wider text-hive-text-dim">
            cumulative · closed positions only
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`border px-2 py-0.5 font-mono text-[10px] transition-colors ${
                range === r
                  ? 'border-hive-honey/40 bg-hive-honey/10 text-hive-honey'
                  : 'border-transparent text-hive-text-dim hover:text-hive-text-primary'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-baseline gap-4 px-4 py-3">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-hive-text-dim">
            net realized
          </span>
          <span className={`font-mono text-base font-semibold ${pnlColor}`}>
            {formatUsd(netRealized, { signed: true })}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-hive-text-dim">
            ROI
          </span>
          <span className={`font-mono text-xs ${pnlColor}`}>{formatPercent(roi)}</span>
        </div>
      </div>

      <div ref={containerRef} className="w-full px-2 pb-3" style={{ height }} />
    </section>
  );
}
