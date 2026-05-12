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
  return STARTING_EQUITY_USD + stats.total_pnl_usd;
}

function pnlColorClass(pnl: number): string {
  if (pnl > 0) return 'text-hive-bullish';
  if (pnl < 0) return 'text-hive-bearish';
  return 'text-hive-text-secondary';
}

function Avatar({
  agent,
  size,
}: {
  agent: PickerAgentSummary;
  size: 'sm' | 'lg' | 'xl';
}) {
  const sizeClass =
    size === 'sm' ? 'h-12 w-12 text-lg' : size === 'lg' ? 'h-24 w-24 text-3xl' : 'h-32 w-32 text-4xl';
  if (agent.avatarUrl) {
    return (
      <img
        src={agent.avatarUrl}
        alt=""
        className={`${sizeClass} shrink-0 border border-hive-border bg-hive-black object-cover`}
      />
    );
  }
  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center border border-hive-border bg-hive-black font-mono font-bold text-hive-honey`}
    >
      {agent.name.slice(0, 1).toUpperCase()}
    </div>
  );
}

function AgentCard({
  agent,
  stats,
  isFocused,
  isSelected,
  isDimmed,
  onFocus,
  onSelect,
  disabled,
}: {
  agent: PickerAgentSummary;
  stats: PickerAgentStats | null | undefined;
  isFocused: boolean;
  isSelected: boolean;
  isDimmed: boolean;
  onFocus: () => void;
  onSelect: () => void;
  disabled: boolean;
}) {
  const pnl = stats?.total_pnl_usd ?? 0;
  const equity = stats ? deriveEquity(stats) : STARTING_EQUITY_USD;

  const stateClass = isSelected
    ? 'border-hive-honey animate-hive-glow scale-[1.03] z-10'
    : isFocused
      ? 'border-hive-honey bg-hive-honey-dim'
      : 'border-hive-border bg-hive-near-black hover:border-hive-honey/60';

  const dimClass = isDimmed ? 'opacity-30 blur-[1px]' : 'opacity-100';

  return (
    <button
      type="button"
      disabled={disabled}
      onMouseEnter={onFocus}
      onFocus={onFocus}
      onClick={onSelect}
      className={`group relative flex w-full flex-col items-center gap-3 border p-4 text-center transition-all duration-200 disabled:cursor-not-allowed ${stateClass} ${dimClass}`}
    >
      {/* Rookie ribbon — visible until the agent has a leaderboard entry. */}
      {stats === null && (
        <span className="absolute right-0 top-0 border-b border-l border-hive-border bg-hive-black px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-hive-pending">
          rookie
        </span>
      )}

      <Avatar agent={agent} size="lg" />

      <div className="flex w-full min-w-0 flex-col items-center">
        <span className="truncate font-mono text-sm font-medium text-hive-text-primary group-hover:text-hive-honey">
          {agent.name}
        </span>
        {agent.bio && (
          <span className="mt-0.5 line-clamp-2 font-mono text-[11px] text-hive-text-dim">
            {agent.bio}
          </span>
        )}
      </div>

      <div className="flex w-full items-center justify-between border-t border-hive-border pt-2 font-mono text-[10px]">
        <div className="flex flex-col items-start">
          <span className="text-hive-text-dim">equity</span>
          <span className="text-hive-text-primary">{formatUsd(equity)}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-hive-text-dim">PnL</span>
          <span className={pnlColorClass(pnl)}>
            {stats ? formatUsd(pnl, { signed: true }) : '—'}
          </span>
        </div>
      </div>

      {isSelected && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-hive-black/40 font-mono text-xs uppercase tracking-widest text-hive-honey">
          <span className="animate-hive-breathe">starting…</span>
        </div>
      )}
    </button>
  );
}

function StatLine({
  label,
  value,
  color = 'text-hive-text-primary',
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-baseline justify-between border-b border-hive-border py-1.5">
      <span className="font-mono text-[10px] uppercase tracking-wider text-hive-text-dim">
        {label}
      </span>
      <span className={`font-mono text-xs ${color}`}>{value}</span>
    </div>
  );
}

function FocusedPanel({
  agent,
  stats,
  onSelect,
  disabled,
  isSelecting,
}: {
  agent: PickerAgentSummary;
  stats: PickerAgentStats | null | undefined;
  onSelect: () => void;
  disabled: boolean;
  isSelecting: boolean;
}) {
  return (
    <aside className="sticky top-0 flex flex-col gap-4 border border-hive-border bg-hive-near-black p-5">
      <div className="flex flex-col items-center gap-3">
        <Avatar agent={agent} size="xl" />
        <div className="flex w-full flex-col items-center text-center">
          <span className="font-mono text-base font-medium text-hive-text-primary">
            {agent.name}
          </span>
          <span className="mt-1 font-mono text-[10px] uppercase tracking-wider text-hive-text-dim">
            joined {formatCreated(agent.created)}
          </span>
        </div>
      </div>

      {agent.bio && (
        <p className="border-t border-hive-border pt-3 font-mono text-xs leading-relaxed text-hive-text-secondary">
          {agent.bio}
        </p>
      )}

      <div className="flex flex-col">
        <h3 className="mb-1 font-mono text-[10px] uppercase tracking-wider text-hive-text-dim">
          stats
        </h3>
        {stats === undefined ? (
          <span className="py-2 font-mono text-xs text-hive-text-dim">loading…</span>
        ) : stats === null ? (
          <span className="py-2 font-mono text-xs text-hive-text-dim">no trades yet</span>
        ) : (
          <>
            <StatLine label="equity" value={formatUsd(deriveEquity(stats))} />
            <StatLine
              label="PnL"
              value={formatUsd(stats.total_pnl_usd, { signed: true })}
              color={pnlColorClass(stats.total_pnl_usd)}
            />
            <StatLine
              label="ROI"
              value={formatPercent(stats.roi_pct)}
              color={pnlColorClass(stats.roi_pct)}
            />
            <StatLine label="trades" value={stats.total_trades.toLocaleString()} />
            <StatLine label="win rate" value={formatPercent(stats.win_rate_pct)} />
            <StatLine label="sharpe" value={stats.sharpe_ratio.toFixed(2)} />
            <StatLine label="max DD" value={formatPercent(stats.max_drawdown_pct)} />
          </>
        )}
      </div>

      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        className="mt-2 border border-hive-honey bg-hive-honey-dim px-4 py-2 font-mono text-xs uppercase tracking-widest text-hive-honey transition-colors hover:bg-hive-honey hover:text-hive-black disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSelecting ? 'starting…' : 'enter ►'}
      </button>
      <p className="text-center font-mono text-[9px] uppercase tracking-wider text-hive-text-dim">
        <span className="text-hive-text-secondary">↑ ↓ ← →</span> navigate ·{' '}
        <span className="text-hive-text-secondary">enter</span> select
      </p>
    </aside>
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

  // Default focus to the first sorted agent, but only if the current
  // focus has fallen out of the list (e.g. sort changed and the previous
  // focus is still valid — keep it). This also keeps the side panel
  // populated as soon as agents arrive.
  useEffect(() => {
    if (sorted.length === 0) {
      setFocusedName(null);
      return;
    }
    if (!focusedName || !sorted.some((a) => a.name === focusedName)) {
      setFocusedName(sorted[0].name);
    }
  }, [sorted, focusedName]);

  const focusedAgent = useMemo(
    () => sorted.find((a) => a.name === focusedName) ?? null,
    [sorted, focusedName],
  );
  const focusedStats =
    focusedAgent && statsQuery.data !== undefined
      ? (statsQuery.data[focusedAgent.name] ?? null)
      : undefined;

  const containerRef = useRef<HTMLDivElement>(null);
  // Two cards per row on lg+, one on smaller — used by keyboard nav to
  // compute up/down moves. Matches the Tailwind grid below.
  const columnsRef = useRef(2);
  useEffect(() => {
    const update = (): void => {
      columnsRef.current = window.innerWidth >= 1024 ? 2 : 1;
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const handleSelect = useCallback(
    (name: string) => {
      if (mutation.isPending) return;
      mutation.mutate(name);
    },
    [mutation],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent): void => {
      if (sorted.length === 0 || mutation.isPending) return;
      const idx = sorted.findIndex((a) => a.name === focusedName);
      if (idx === -1) return;
      const cols = columnsRef.current;
      let next = idx;
      switch (e.key) {
        case 'ArrowLeft':
          next = Math.max(0, idx - 1);
          break;
        case 'ArrowRight':
          next = Math.min(sorted.length - 1, idx + 1);
          break;
        case 'ArrowUp':
          next = Math.max(0, idx - cols);
          break;
        case 'ArrowDown':
          next = Math.min(sorted.length - 1, idx + cols);
          break;
        case 'Enter':
          e.preventDefault();
          handleSelect(sorted[idx].name);
          return;
        default:
          return;
      }
      if (next !== idx) {
        e.preventDefault();
        setFocusedName(sorted[next].name);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sorted, focusedName, mutation.isPending, handleSelect]);

  return (
    <div ref={containerRef} className="flex h-screen flex-col bg-hive-black">
      <header className="border-b border-hive-border bg-hive-near-black px-6 py-4">
        <h1 className="text-lg font-bold tracking-tight">
          <span className="text-hive-honey">zHive</span>
          <span className="ml-1.5 text-hive-text-dim">·</span>
          <span className="ml-1.5 font-mono text-hive-text-primary">select agent</span>
        </h1>
      </header>

      <main className="flex flex-1 items-start justify-center overflow-y-auto p-6">
        <div className="w-full max-w-6xl">
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
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {sorted.map((agent) => {
                  const isPending = pendingName === agent.name;
                  const isFocused = focusedName === agent.name;
                  const isDimmed = mutation.isPending && !isPending;
                  const stats =
                    statsQuery.data === undefined
                      ? undefined
                      : (statsQuery.data[agent.name] ?? null);
                  return (
                    <AgentCard
                      key={agent.name}
                      agent={agent}
                      stats={stats}
                      isFocused={isFocused}
                      isSelected={isPending}
                      isDimmed={isDimmed}
                      disabled={mutation.isPending}
                      onFocus={() => setFocusedName(agent.name)}
                      onSelect={() => handleSelect(agent.name)}
                    />
                  );
                })}
              </div>

              {focusedAgent && (
                <FocusedPanel
                  agent={focusedAgent}
                  stats={focusedStats}
                  onSelect={() => handleSelect(focusedAgent.name)}
                  disabled={mutation.isPending}
                  isSelecting={pendingName === focusedAgent.name}
                />
              )}
            </div>
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
