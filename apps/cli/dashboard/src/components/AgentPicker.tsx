import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { fetchAgentsStats, selectAgent } from '../lib/api';
import { formatPercent, formatUsd } from '../lib/format';
import type { PickerAgentStats, PickerAgentsStats, PickerAgentSummary } from '../lib/types';
import { PageHeader } from './primitives/PageHeader';
import { SectionHeader } from './primitives/SectionHeader';

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
  // Unrealized PnL isn't included here — the picker rows can't carry per-agent
  // live mids without N×WS subscriptions. The dashboard's equity strip folds
  // it back in for the active agent's headline number.
  return STARTING_EQUITY_USD + stats.total_pnl_usd;
}

function StatCell({
  label,
  value,
  color = 'text-hive-text-primary',
  size = 'sm',
}: {
  label: string;
  value: string;
  color?: string;
  size?: 'sm' | 'md';
}) {
  const valueClass =
    size === 'md' ? 'font-mono text-sm font-bold tabular-nums' : 'font-mono text-xs font-semibold tabular-nums';
  return (
    <div className="flex min-w-0 flex-col items-end">
      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-hive-text-dim">
        {label}
      </span>
      <span className={`${valueClass} ${color}`}>{value}</span>
    </div>
  );
}

/** Minimal zero-state values for agents the platform doesn't know about yet
 * (e.g. just-created, self-hosted-only, or transient leaderboard fetch
 * failure). Renders the same column shape as the live row so the picker grid
 * stays aligned and every agent has visible stats. */
function defaultStats(): {
  pnl: number;
  roi: number;
  trades: number;
  winRatePct: number;
  equity: number;
} {
  return {
    pnl: 0,
    roi: 0,
    trades: 0,
    winRatePct: 0,
    equity: STARTING_EQUITY_USD,
  };
}

function StatsRow({
  stats,
  loading,
}: {
  stats: PickerAgentStats | null;
  loading: boolean;
}) {
  const view = stats ? {
    pnl: stats.total_pnl_usd,
    roi: stats.roi_pct,
    trades: stats.total_trades,
    winRatePct: stats.win_rate_pct * 100,
    equity: deriveEquity(stats),
  } : defaultStats();

  const pnlColor =
    view.pnl > 0
      ? 'text-hive-bullish'
      : view.pnl < 0
        ? 'text-hive-bearish'
        : 'text-hive-text-secondary';
  const roiColor =
    view.roi > 0
      ? 'text-hive-bullish'
      : view.roi < 0
        ? 'text-hive-bearish'
        : 'text-hive-text-secondary';
  const winColor =
    view.trades === 0
      ? 'text-hive-text-secondary'
      : view.winRatePct >= 50
        ? 'text-hive-bullish'
        : 'text-hive-bearish';

  const indicator = loading
    ? 'loading…'
    : stats === null
      ? 'no trades yet'
      : null;

  return (
    <div className="flex shrink-0 items-center gap-5">
      <StatCell label="equity" value={formatUsd(view.equity)} size="md" />
      <StatCell
        label="PnL"
        value={formatUsd(view.pnl, { signed: true })}
        color={pnlColor}
      />
      <StatCell label="ROI" value={formatPercent(view.roi)} color={roiColor} />
      <StatCell
        label="win"
        value={view.trades === 0 ? '—' : `${view.winRatePct.toFixed(0)}%`}
        color={winColor}
      />
      <StatCell label="trades" value={view.trades.toLocaleString()} />
      {indicator && (
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-hive-text-dim">
          {indicator}
        </span>
      )}
    </div>
  );
}

export function AgentPicker({ agents }: AgentPickerProps) {
  const [pendingName, setPendingName] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('equity');
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
    <div className="flex h-screen flex-col bg-hive-black font-mono text-hive-text-primary">
      <PageHeader title="select agent" />

      <main className="flex flex-1 items-start justify-center overflow-y-auto p-6">
        <div className="w-full max-w-5xl">
          <section className="bg-hive-near-black">
            <SectionHeader
              title={`agents.list · ${agents.length}`}
              right={
                <span className="flex items-center gap-3">
                  <span className="text-hive-text-dim">sort</span>
                  {SORT_OPTIONS.map((opt) => {
                    const active = sortKey === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setSortKey(opt.key)}
                        className={`uppercase tracking-[0.22em] transition-colors ${
                          active
                            ? 'text-hive-honey'
                            : 'text-hive-text-dim hover:text-hive-text-secondary'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </span>
              }
            />

            {agents.length === 0 ? (
              <div className="px-6 py-10 text-center font-mono text-sm text-hive-text-secondary">
                No agents found. Create one with{' '}
                <code className="text-hive-honey">npx @zhive/cli@latest create</code>
              </div>
            ) : (
              <ul className="divide-y divide-hive-border">
                {sorted.map((agent) => {
                  const isPending = pendingName === agent.name;
                  const isFocused = focusedName === agent.name;
                  const isDimmed = mutation.isPending && !isPending;
                  const loadingStats = statsQuery.data === undefined;
                  const stats = loadingStats
                    ? null
                    : (statsQuery.data?.[agent.name] ?? null);

                  const rowClass = isPending
                    ? 'bg-hive-honey-dim animate-hive-glow'
                    : isFocused
                      ? 'bg-hive-honey-dim/60'
                      : 'bg-hive-near-black hover:bg-hive-honey-dim/30';
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
                        className={`group relative flex w-full items-center gap-4 px-4 py-3.5 text-left transition-all duration-150 disabled:cursor-not-allowed ${rowClass} ${dimClass}`}
                      >
                        {/* Honey marker rail on focused/pending state. */}
                        <span
                          aria-hidden
                          className={`absolute inset-y-0 left-0 w-0.5 transition-colors ${
                            isFocused || isPending
                              ? 'bg-hive-honey'
                              : 'bg-transparent group-hover:bg-hive-honey/40'
                          }`}
                        />
                        {agent.avatarUrl ? (
                          <img
                            src={agent.avatarUrl}
                            alt=""
                            className="h-14 w-14 shrink-0 border border-hive-border bg-hive-black object-cover"
                          />
                        ) : (
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center border border-hive-border bg-hive-black font-mono text-xl font-bold text-hive-honey">
                            {agent.name.slice(0, 1).toLowerCase()}
                          </div>
                        )}
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex items-baseline gap-2">
                            <span
                              className={`truncate font-mono text-sm font-bold tracking-tight transition-colors ${
                                isFocused || isPending
                                  ? 'text-hive-honey'
                                  : 'text-hive-text-primary group-hover:text-hive-honey'
                              }`}
                            >
                              {agent.name}
                            </span>
                            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-hive-text-dim">
                              · created {formatCreated(agent.created)}
                            </span>
                          </div>
                          {agent.bio && (
                            <span className="mt-0.5 truncate font-mono text-[11px] text-hive-text-secondary">
                              {agent.bio}
                            </span>
                          )}
                        </div>
                        <StatsRow stats={stats} loading={loadingStats} />
                        {isPending && (
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-end pr-6 font-mono text-[10px] uppercase tracking-[0.32em] text-hive-honey">
                            <span className="animate-hive-breathe">starting…</span>
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {agents.length > 0 && !mutation.isPending && (
            <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.32em] text-hive-text-dim">
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
