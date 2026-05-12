import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { fetchAgentsStats, selectAgent } from '../lib/api';
import { formatPercent, formatUsd } from '../lib/format';
import type { PickerAgentStats, PickerAgentsStats, PickerAgentSummary } from '../lib/types';

interface AgentPickerProps {
  agents: PickerAgentSummary[];
}

type SortKey = 'created' | 'equity' | 'pnl';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'created', label: 'created' },
  { key: 'equity', label: 'equity' },
  { key: 'pnl', label: 'PnL' },
];

function formatCreated(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const STARTING_EQUITY_USD = 10_000;

function sortAgents(
  agents: PickerAgentSummary[],
  key: SortKey,
  stats: PickerAgentsStats | undefined,
): PickerAgentSummary[] {
  const copy = [...agents];
  if (key === 'created') {
    copy.sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());
    return copy;
  }
  // Stats-based sorts: highest first. Agents without a leaderboard entry
  // (null/undefined stats) fall to the bottom, then are ordered by created.
  const valueFor = (name: string): number | null => {
    const s = stats?.[name];
    if (!s) return null;
    return key === 'equity' ? STARTING_EQUITY_USD + s.total_pnl_usd : s.total_pnl_usd;
  };
  copy.sort((a, b) => {
    const va = valueFor(a.name);
    const vb = valueFor(b.name);
    if (va === null && vb === null) {
      return new Date(a.created).getTime() - new Date(b.created).getTime();
    }
    if (va === null) return 1;
    if (vb === null) return -1;
    return vb - va;
  });
  return copy;
}

function deriveEquity(stats: PickerAgentStats): number {
  // Mirror the backend's composition: equity = starting + realized.
  // We don't include unrealized here (picker rows can't carry per-agent
  // live mids without N×WS subscriptions). The dashboard's RealizedPnlChart
  // adds unrealized for the active agent's headline number.
  return STARTING_EQUITY_USD + stats.total_pnl_usd;
}

function StatCell({
  label,
  value,
  color = 'text-hive-text-primary',
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col items-end">
      <span className="font-mono text-[10px] uppercase tracking-wider text-hive-text-dim">
        {label}
      </span>
      <span className={`font-mono text-xs ${color}`}>{value}</span>
    </div>
  );
}

function StatsRow({ stats }: { stats: PickerAgentStats | null | undefined }) {
  if (stats === null) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-wider text-hive-text-dim">
        no trades yet
      </span>
    );
  }
  if (stats === undefined) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-wider text-hive-text-dim">
        loading…
      </span>
    );
  }

  const pnl = stats.total_pnl_usd;
  const pnlColor =
    pnl > 0 ? 'text-hive-bullish' : pnl < 0 ? 'text-hive-bearish' : 'text-hive-text-secondary';
  const roi = stats.roi_pct;
  const roiColor =
    roi > 0 ? 'text-hive-bullish' : roi < 0 ? 'text-hive-bearish' : 'text-hive-text-secondary';
  const equity = deriveEquity(stats);

  return (
    <div className="flex shrink-0 items-center gap-5">
      <StatCell label="equity" value={formatUsd(equity)} />
      <StatCell label="PnL" value={formatUsd(pnl, { signed: true })} color={pnlColor} />
      <StatCell label="ROI" value={formatPercent(roi)} color={roiColor} />
      <StatCell label="trades" value={stats.total_trades.toLocaleString()} />
    </div>
  );
}

export function AgentPicker({ agents }: AgentPickerProps) {
  const [pendingName, setPendingName] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('created');
  const [focusedName, setFocusedName] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: selectAgent,
    onMutate: (name) => setPendingName(name),
    onError: () => setPendingName(null),
  });

  // Picker stats are batched server-side from one Hive call refreshed every
  // 60s. Polling here every 60s keeps the picker in sync while the user
  // stares at it. Stale data is harmless — the next click reloads anyway.
  const statsQuery = useQuery({
    queryKey: ['picker-stats'],
    queryFn: fetchAgentsStats,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const sorted = useMemo(
    () => sortAgents(agents, sortKey, statsQuery.data),
    [agents, sortKey, statsQuery.data],
  );

  // Default keyboard focus to the first row, and recover gracefully if a
  // sort change drops the previously-focused name off the list.
  useEffect(() => {
    if (sorted.length === 0) {
      setFocusedName(null);
      return;
    }
    if (!focusedName || !sorted.some((a) => a.name === focusedName)) {
      setFocusedName(sorted[0].name);
    }
  }, [sorted, focusedName]);

  const handleSelect = useCallback(
    (name: string) => {
      if (mutation.isPending) return;
      mutation.mutate(name);
    },
    [mutation],
  );

  useEffect(() => {
    if (sorted.length === 0 || mutation.isPending) return;
    const onKey = (e: KeyboardEvent): void => {
      const idx = sorted.findIndex((a) => a.name === focusedName);
      if (idx === -1) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedName(sorted[Math.min(sorted.length - 1, idx + 1)].name);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedName(sorted[Math.max(0, idx - 1)].name);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSelect(sorted[idx].name);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sorted, focusedName, mutation.isPending, handleSelect]);

  // Scroll the focused row into view when keyboard nav moves it.
  const rowRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  useEffect(() => {
    if (!focusedName) return;
    rowRefs.current.get(focusedName)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focusedName]);

  return (
    <div className="flex h-screen flex-col bg-hive-black">
      <header className="border-b border-hive-border bg-hive-near-black px-6 py-4">
        <h1 className="text-lg font-bold tracking-tight">
          <span className="text-hive-honey">zHive</span>
          <span className="ml-1.5 text-hive-text-dim">·</span>
          <span className="ml-1.5 font-mono text-hive-text-primary">select agent</span>
        </h1>
      </header>

      <main className="flex flex-1 items-start justify-center overflow-y-auto p-6">
        <div className="w-full max-w-4xl">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 className="font-mono text-xs font-medium uppercase tracking-wider text-hive-text-secondary">
              {agents.length} {agents.length === 1 ? 'agent' : 'agents'}
            </h2>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[10px] uppercase tracking-wider text-hive-text-dim">
                sort
              </span>
              {SORT_OPTIONS.map((opt) => {
                const active = sortKey === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setSortKey(opt.key)}
                    className={`font-mono text-xs uppercase tracking-wider transition-colors ${
                      active
                        ? 'text-hive-honey'
                        : 'text-hive-text-dim hover:text-hive-text-secondary'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {agents.length === 0 ? (
            <div className="border border-hive-border bg-hive-near-black p-6 text-center font-mono text-sm text-hive-text-secondary">
              No agents found. Create one with{' '}
              <code className="text-hive-honey">npx @zhive/cli@latest create</code>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {sorted.map((agent) => {
                const isPending = pendingName === agent.name;
                const isFocused = focusedName === agent.name;
                const isDimmed = mutation.isPending && !isPending;
                const stats =
                  statsQuery.data === undefined
                    ? undefined
                    : (statsQuery.data[agent.name] ?? null);

                const stateClass = isPending
                  ? 'border-hive-honey bg-hive-honey-dim animate-hive-glow scale-[1.01] z-10'
                  : isFocused
                    ? 'border-hive-honey bg-hive-honey-dim'
                    : 'border-hive-border bg-hive-near-black hover:border-hive-honey/70 hover:bg-hive-honey-dim/40';
                const dimClass = isDimmed ? 'opacity-30 blur-[1px]' : 'opacity-100';

                return (
                  <li
                    key={agent.name}
                    ref={(el) => {
                      if (el) rowRefs.current.set(agent.name, el);
                      else rowRefs.current.delete(agent.name);
                    }}
                  >
                    <button
                      type="button"
                      disabled={mutation.isPending}
                      onMouseEnter={() => setFocusedName(agent.name)}
                      onFocus={() => setFocusedName(agent.name)}
                      onClick={() => handleSelect(agent.name)}
                      className={`group relative flex w-full items-center gap-4 border px-4 py-4 text-left transition-all duration-200 disabled:cursor-not-allowed ${stateClass} ${dimClass}`}
                    >
                      {agent.avatarUrl ? (
                        <img
                          src={agent.avatarUrl}
                          alt=""
                          className="h-16 w-16 shrink-0 border border-hive-border bg-hive-black object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center border border-hive-border bg-hive-black font-heading text-2xl font-bold text-hive-honey">
                          {agent.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span
                          className={`truncate font-heading text-base font-bold transition-colors ${
                            isFocused || isPending
                              ? 'text-hive-honey'
                              : 'text-hive-text-primary group-hover:text-hive-honey'
                          }`}
                        >
                          {agent.name}
                        </span>
                        {agent.bio && (
                          <span className="mt-0.5 truncate font-mono text-xs text-hive-text-dim">
                            {agent.bio}
                          </span>
                        )}
                        <span className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-hive-text-dim">
                          created {formatCreated(agent.created)}
                        </span>
                      </div>
                      <StatsRow stats={stats} />
                      {isPending && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-end pr-6 font-mono text-xs uppercase tracking-widest text-hive-honey">
                          <span className="animate-hive-breathe">starting…</span>
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {agents.length > 0 && !mutation.isPending && (
            <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-widest text-hive-text-dim">
              <span className="text-hive-text-secondary">↑ ↓</span> navigate ·{' '}
              <span className="text-hive-text-secondary">enter</span> select
            </p>
          )}

          {mutation.isError && (
            <div className="mt-4 border border-hive-bearish bg-hive-near-black p-3 font-mono text-xs text-hive-bearish">
              {mutation.error instanceof Error ? mutation.error.message : 'failed to select agent'}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
