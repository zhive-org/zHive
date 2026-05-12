import { useEffect, useState } from 'react';

interface CountdownClockProps {
  /** Wall-clock time the next eval is expected to fire. ms since epoch.
   * Pass `null` to render the dormant "—" state. */
  nextEvalAt: number | null;
  /** Full interval length in ms — used for the progress bar denominator. */
  intervalMs: number;
  /** When true, the agent is mid-eval — the clock pauses and shows
   * "EVALUATING…" instead of the countdown. */
  evaluating?: boolean;
  size?: 'lg' | 'xl';
}

/** Big monospace HH:MM:SS countdown with a thin progress bar underneath.
 *
 * Re-derives the remaining time off the absolute `nextEvalAt` rather than
 * decrementing local state — that way the clock stays accurate even if the
 * browser throttles the interval (background tab, sleep), and "0s" resets
 * automatically when the runtime publishes the next sleep event. */
export function CountdownClock({
  nextEvalAt,
  intervalMs,
  evaluating = false,
  size = 'xl',
}: CountdownClockProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const totalSeconds = Math.max(0, Math.floor(intervalMs / 1000));
  const remainingSec = nextEvalAt
    ? Math.max(0, Math.floor((nextEvalAt - now) / 1000))
    : 0;

  const hh = String(Math.floor(remainingSec / 3600)).padStart(2, '0');
  const mm = String(Math.floor((remainingSec % 3600) / 60)).padStart(2, '0');
  const ss = String(remainingSec % 60).padStart(2, '0');

  const fontSize = size === 'xl' ? 96 : 72;
  const pct =
    totalSeconds > 0 ? Math.min(100, (remainingSec / totalSeconds) * 100) : 0;

  const cycleLabel =
    intervalMs >= 60 * 60 * 1000
      ? `${Math.round(intervalMs / (60 * 60 * 1000))}h cycle`
      : `${Math.round(intervalMs / (60 * 1000))}m cycle`;

  const headerLabel = evaluating
    ? 'EVALUATING'
    : nextEvalAt
      ? 'NEXT EVAL IN'
      : 'NEXT EVAL';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-hive-text-dim">
          {headerLabel}
        </span>
        <span className="h-px flex-1 bg-hive-border" />
        <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-hive-honey/60">
          {cycleLabel}
        </span>
      </div>
      <div
        className="flex items-baseline gap-1 font-mono font-bold leading-none tabular-nums text-hive-honey"
        style={{ fontSize, letterSpacing: '-0.02em' }}
      >
        {evaluating ? (
          <span
            className="animate-pulse uppercase tracking-tight text-hive-honey"
            style={{ fontSize: fontSize * 0.46, letterSpacing: '0.02em' }}
          >
            evaluating
            <span className="text-hive-honey/60">…</span>
          </span>
        ) : nextEvalAt ? (
          <>
            <span>{hh}</span>
            <span className="text-hive-text-dim">:</span>
            <span>{mm}</span>
            <span className="text-hive-text-dim">:</span>
            <span className="text-hive-honey/70">{ss}</span>
          </>
        ) : (
          <span className="text-hive-text-dim">--:--:--</span>
        )}
      </div>
      <div
        className={`relative h-[3px] w-full bg-hive-border/40 ${
          evaluating ? 'animate-pulse' : ''
        }`}
      >
        <div
          className="absolute inset-y-0 left-0 bg-hive-honey transition-all"
          style={{ width: evaluating ? '100%' : `${pct}%` }}
        />
        {!evaluating && (
          <div
            className="absolute -top-0.5 h-[5px] w-px bg-hive-honey shadow-[0_0_8px_rgba(245,166,35,0.8)]"
            style={{ left: `${pct}%` }}
          />
        )}
      </div>
    </div>
  );
}
