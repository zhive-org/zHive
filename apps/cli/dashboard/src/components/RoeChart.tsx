import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { RoeSeries } from '../lib/useRoeSeries';

interface RoeChartProps {
  series: RoeSeries;
  height?: number;
}

export function RoeChart({ series, height = 220 }: RoeChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);

  // Initialize the plot once.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const opts: uPlot.Options = {
      width: el.clientWidth,
      height,
      padding: [12, 12, 8, 8],
      cursor: { drag: { x: false, y: false }, points: { size: 6 } },
      legend: { show: false },
      scales: {
        x: { time: false },
        y: { auto: true },
      },
      axes: [
        {
          stroke: '#52525b',
          grid: { stroke: 'rgba(63,63,70,0.4)', width: 1 },
          ticks: { stroke: 'rgba(63,63,70,0.4)' },
          values: (_u, splits) => splits.map((s) => `${s}s`),
        },
        {
          stroke: '#52525b',
          grid: { stroke: 'rgba(63,63,70,0.4)', width: 1 },
          ticks: { stroke: 'rgba(63,63,70,0.4)' },
          values: (_u, splits) =>
            splits.map((s) => `${s > 0 ? '+' : ''}${s.toFixed(2)}%`),
        },
      ],
      series: [
        {},
        {
          stroke: '#fbbf24',
          width: 2,
          fill: 'rgba(251,191,36,0.08)',
          points: { show: false },
        },
      ],
    };

    plotRef.current = new uPlot(opts, [series.t, series.roeDelta], el);

    const onResize = (): void => {
      if (plotRef.current && el) {
        plotRef.current.setSize({ width: el.clientWidth, height });
      }
    };
    const observer = new ResizeObserver(onResize);
    observer.observe(el);

    return () => {
      observer.disconnect();
      plotRef.current?.destroy();
      plotRef.current = null;
    };
    // We deliberately omit `series` and `height` — the plot is initialized once
    // and updated via setData below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push new data on each series update.
  useEffect(() => {
    plotRef.current?.setData([series.t, series.roeDelta]);
  }, [series]);

  return <div ref={containerRef} className="w-full" style={{ height }} />;
}
