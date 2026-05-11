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
  /** Cumulative realized equity per day. */
  equity: Float64Array;
  /** Date labels aligned with `t` for tooltip display. */
  dates: string[];
}

function buildSeries(
  dailyPnl: { date: string; realized_pnl_usd: number }[],
  startingEquity: number,
): ChartSeries {
  // Always start at the window's leading edge so the chart shows the
  // starting baseline even when the agent has zero closed trades in range.
  const t = new Float64Array(dailyPnl.length + 1);
  const equity = new Float64Array(dailyPnl.length + 1);
  const dates: string[] = ['start'];
  t[0] = 0;
  equity[0] = startingEquity;
  let cumulative = startingEquity;
  for (let i = 0; i < dailyPnl.length; i++) {
    cumulative += dailyPnl[i].realized_pnl_usd;
    t[i + 1] = i + 1;
    equity[i + 1] = cumulative;
    dates.push(dailyPnl[i].date);
  }
  return { t, equity, dates };
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
  const currentEquity = data?.current_equity_usd ?? 0;
  const allTimePnl = data?.all_time_pnl_usd ?? 0;
  const roi = startingEquity > 0 ? (allTimePnl / startingEquity) * 100 : 0;
  const isPositive = allTimePnl >= 0;
  const pnlColor = isPositive ? 'text-hive-bullish' : 'text-hive-bearish';

  const series = useMemo<ChartSeries>(() => {
    if (!data) return { t: new Float64Array([0]), equity: new Float64Array([0]), dates: ['—'] };
    return buildSeries(data.daily_pnl, data.starting_equity_usd);
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
        y: { auto: true },
      },
      axes: [
        {
          stroke: AXIS_STROKE,
          font: '11px "JetBrains Mono", monospace',
          grid: { stroke: GRID_STROKE, width: 1 },
          ticks: { stroke: GRID_STROKE },
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
              if (Math.abs(value) >= 1000) {
                return `$${(value / 1000).toFixed(1)}k`;
              }
              return `$${value.toFixed(0)}`;
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

    plotRef.current = new uPlot(opts, [series.t, series.equity], el);

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
    plotRef.current?.setData([series.t, series.equity]);
  }, [series]);

  return (
    <section className="border border-hive-border bg-hive-near-black">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-hive-border px-4 py-3">
        <div className="flex items-baseline gap-3">
          <h2 className="font-mono text-xs font-medium uppercase tracking-wider text-hive-text-secondary">
            Realized PnL · cumulative
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-wider text-hive-text-dim">
            chart is realized-only — headline includes unrealized
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
            equity
          </span>
          <span className="font-mono text-base font-semibold text-hive-text-primary">
            {formatUsd(currentEquity)}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-hive-text-dim">
            total PnL
          </span>
          <span className={`font-mono text-sm font-semibold ${pnlColor}`}>
            {formatUsd(allTimePnl, { signed: true })}
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
