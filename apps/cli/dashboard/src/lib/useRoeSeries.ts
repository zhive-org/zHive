import { useEffect, useRef, useState } from 'react';

const WINDOW_MS = 30_000;
const MAX_POINTS = 720;

export interface RoeSeries {
  /** Relative seconds from window start (oldest first). */
  t: Float64Array;
  /** ROE % delta from window-start ROE. */
  roeDelta: Float64Array;
}

interface Sample {
  ts: number;
  roe: number;
}

export function useRoeSeries(currentRoePercent: number): RoeSeries {
  const samplesRef = useRef<Sample[]>([]);
  const [series, setSeries] = useState<RoeSeries>({
    t: new Float64Array([0]),
    roeDelta: new Float64Array([0]),
  });

  useEffect(() => {
    const now = Date.now();
    const samples = samplesRef.current;
    samples.push({ ts: now, roe: currentRoePercent });

    const cutoff = now - WINDOW_MS;
    while (samples.length > 1 && samples[0].ts < cutoff) samples.shift();
    if (samples.length > MAX_POINTS) samplesRef.current = samples.slice(-MAX_POINTS);

    const head = samplesRef.current[0];
    const t = new Float64Array(samplesRef.current.length);
    const roeDelta = new Float64Array(samplesRef.current.length);
    for (let i = 0; i < samplesRef.current.length; i++) {
      t[i] = (samplesRef.current[i].ts - head.ts) / 1000;
      roeDelta[i] = samplesRef.current[i].roe - head.roe;
    }
    setSeries({ t, roeDelta });
  }, [currentRoePercent]);

  return series;
}
