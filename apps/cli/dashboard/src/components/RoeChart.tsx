import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import type { RoeSeries } from '../lib/useRoeSeries';

interface RoeChartProps {
  series: RoeSeries;
  height?: number;
}

const HONEY = '#F5A623';
const HONEY_FILL = 'rgba(245,166,35,0.10)';
const AXIS_STROKE = '#555555';
const GRID_STROKE = 'rgba(204,204,204,0.08)';

export function RoeChart({ series, height = 220 }: RoeChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);

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
          values: (_u, splits) => splits.map((s) => `${s}s`),
        },
        {
          stroke: AXIS_STROKE,
          font: '11px "JetBrains Mono", monospace',
          size: 64,
          grid: { stroke: GRID_STROKE, width: 1 },
          ticks: { stroke: GRID_STROKE },
          values: (_u, splits) => splits.map((s) => `${s > 0 ? '+' : ''}${s.toFixed(2)}%`),
        },
      ],
      series: [
        {},
        {
          stroke: HONEY,
          width: 2,
          fill: HONEY_FILL,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    plotRef.current?.setData([series.t, series.roeDelta]);
  }, [series]);

  return <div ref={containerRef} className="w-full" style={{ height }} />;
}
