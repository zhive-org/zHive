export type StatusState = 'online' | 'analyzing' | 'idle' | 'error';

interface StatusPillProps {
  state: StatusState;
}

const STATE_MAP: Record<
  StatusState,
  { dot: string; label: string; color: string }
> = {
  online: { dot: 'bg-hive-bullish', label: 'ONLINE', color: 'text-hive-bullish' },
  analyzing: {
    dot: 'bg-hive-honey animate-pulse',
    label: 'ANALYZING',
    color: 'text-hive-honey',
  },
  idle: { dot: 'bg-hive-text-dim', label: 'IDLE', color: 'text-hive-text-secondary' },
  error: { dot: 'bg-hive-bearish', label: 'ERROR', color: 'text-hive-bearish' },
};

export function StatusPill({ state }: StatusPillProps) {
  const s = STATE_MAP[state] ?? STATE_MAP.online;
  return (
    <span
      className={`inline-flex items-center gap-1.5 border border-hive-border bg-hive-black px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] ${s.color}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
