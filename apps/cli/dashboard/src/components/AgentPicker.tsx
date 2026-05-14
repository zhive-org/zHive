import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { fetchAgentsStats, selectAgent } from '../lib/api';
import { formatPercent, formatUsd } from '../lib/format';
import type { PickerAgentStats, PickerAgentsStats, PickerAgentSummary } from '../lib/types';
import { PageHeader } from './primitives/PageHeader';
import { SectionHeader } from './primitives/SectionHeader';

interface AgentPickerProps {
  agents: PickerAgentSummary[];
}

const CREATE_AGENT_URL = 'https://www.zhive.ai/create';

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

function sortActive(
  agents: PickerAgentSummary[],
  key: SortKey,
  stats: PickerAgentsStats,
): PickerAgentSummary[] {
  const copy = [...agents];
  if (key === 'created') {
    // Newest first inside the active zone — matches the idle zone's order
    // so the sort feels consistent across the page.
    copy.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
    return copy;
  }
  const valueFor = (name: string): number => {
    const s = stats[name];
    return key === 'equity' ? STARTING_EQUITY_USD + (s?.total_pnl_usd ?? 0) : (s?.total_pnl_usd ?? 0);
  };
  copy.sort((a, b) => valueFor(b.name) - valueFor(a.name));
  return copy;
}

function sortIdleByNewest(agents: PickerAgentSummary[]): PickerAgentSummary[] {
  return [...agents].sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
}

function partitionAgents(
  agents: PickerAgentSummary[],
  stats: PickerAgentsStats | undefined,
  sortKey: SortKey,
): { active: PickerAgentSummary[]; idle: PickerAgentSummary[] } {
  // Stats haven't loaded yet — we don't know who has traded. Render
  // everything as a single block (idle) sorted by newest so the order is
  // stable, and don't show the zone divider until classification is real.
  if (stats === undefined) {
    return { active: [], idle: sortIdleByNewest(agents) };
  }
  const active: PickerAgentSummary[] = [];
  const idle: PickerAgentSummary[] = [];
  for (const a of agents) {
    const s = stats[a.name];
    if (s && s.total_trades > 0) active.push(a);
    else idle.push(a);
  }
  return { active: sortActive(active, sortKey, stats), idle: sortIdleByNewest(idle) };
}

function deriveEquity(stats: PickerAgentStats): number {
  // Mirror the backend's composition: equity = starting + realized.
  // Unrealized PnL isn't included here — the picker rows can't carry per-agent
  // live mids without N×WS subscriptions. The dashboard's equity strip folds
  // it back in for the active agent's headline number.
  return STARTING_EQUITY_USD + stats.total_pnl_usd;
}

function EmptyAgentsCta() {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
      <div className="flex flex-col gap-1.5">
        <p className="font-mono text-sm text-hive-text-primary">
          No agents found in <code className="text-hive-honey">~/.zhive/agents</code>
        </p>
        <p className="font-mono text-[11px] text-hive-text-secondary">
          Draft one for free on zhive.ai, download the bundle, then drop it in.
        </p>
      </div>
      <a
        href={CREATE_AGENT_URL}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex items-center gap-3 bg-white px-6 py-3 font-mono text-xs font-bold uppercase tracking-[0.3em] text-hive-black transition-colors hover:bg-hive-text-secondary"
      >
        <span>create agent</span>
        <span aria-hidden>→</span>
      </a>
      <p className="max-w-md font-mono text-[10px] uppercase tracking-[0.18em] text-hive-text-dim">
        After unzipping the bundle into ~/.zhive/agents, restart this CLI to pick it up.
      </p>
    </div>
  );
}

function NeedsKeyBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 border border-hive-bearish/60 bg-hive-bearish/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-hive-bearish"
      title="No LLM provider key in .env — agent can't run until you paste one"
    >
      <span aria-hidden className="inline-block h-1.5 w-1.5 bg-hive-bearish" />
      needs key
    </span>
  );
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
    size === 'md'
      ? 'font-mono text-sm font-bold tabular-nums'
      : 'font-mono text-xs font-semibold tabular-nums';
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

function StatsRow({ stats, loading }: { stats: PickerAgentStats | null; loading: boolean }) {
  const view = stats
    ? {
        pnl: stats.total_pnl_usd,
        roi: stats.roi_pct,
        trades: stats.total_trades,
        winRatePct: stats.win_rate_pct * 100,
        equity: deriveEquity(stats),
      }
    : defaultStats();

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

  const indicator = loading ? 'loading…' : stats === null ? 'no trades yet' : null;

  return (
    <div className="flex shrink-0 items-center gap-5">
      <StatCell label="equity" value={formatUsd(view.equity)} size="md" />
      <StatCell label="PnL" value={formatUsd(view.pnl, { signed: true })} color={pnlColor} />
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

interface AgentRowProps {
  agent: PickerAgentSummary;
  isPending: boolean;
  isFocused: boolean;
  isDimmed: boolean;
  loadingStats: boolean;
  stats: PickerAgentStats | null;
  disabled: boolean;
  onFocus: (name: string) => void;
  onSelect: (name: string) => void;
  rowRefs: MutableRefObject<Map<string, HTMLLIElement>>;
}

function renderAgentRow({
  agent,
  isPending,
  isFocused,
  isDimmed,
  loadingStats,
  stats,
  disabled,
  onFocus,
  onSelect,
  rowRefs,
}: AgentRowProps) {
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
        disabled={disabled}
        onMouseEnter={() => onFocus(agent.name)}
        onFocus={() => onFocus(agent.name)}
        onClick={() => onSelect(agent.name)}
        className={`group relative flex w-full items-center gap-4 px-4 py-3.5 text-left transition-all duration-150 disabled:cursor-not-allowed ${rowClass} ${dimClass}`}
      >
        <span
          aria-hidden
          className={`absolute inset-y-0 left-0 w-0.5 transition-colors ${
            isFocused || isPending ? 'bg-hive-honey' : 'bg-transparent group-hover:bg-hive-honey/40'
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
            {!agent.hasProviderKey && <NeedsKeyBadge />}
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

  const { active, idle } = useMemo(
    () => partitionAgents(agents, statsQuery.data, sortKey),
    [agents, sortKey, statsQuery.data],
  );
  const sorted = useMemo(() => [...active, ...idle], [active, idle]);
  const showZones = statsQuery.data !== undefined && active.length > 0 && idle.length > 0;

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
                <span className="flex items-center gap-4">
                  {agents.length > 0 && (
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
                  )}
                  <a
                    href={CREATE_AGENT_URL}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1.5 bg-white px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-hive-black transition-colors hover:bg-hive-text-secondary"
                  >
                    create agent →
                  </a>
                </span>
              }
            />

            {agents.length === 0 ? (
              <EmptyAgentsCta />
            ) : (
              <ul className="divide-y divide-hive-border">
                {active.map((agent) =>
                  renderAgentRow({
                    agent,
                    isPending: pendingName === agent.name,
                    isFocused: focusedName === agent.name,
                    isDimmed: mutation.isPending && pendingName !== agent.name,
                    loadingStats: statsQuery.data === undefined,
                    stats:
                      statsQuery.data === undefined
                        ? null
                        : (statsQuery.data?.[agent.name] ?? null),
                    disabled: mutation.isPending,
                    onFocus: setFocusedName,
                    onSelect: handleSelect,
                    rowRefs,
                  }),
                )}
                {showZones && (
                  <li
                    aria-hidden
                    className="border-t-2 border-hive-honey/40 px-4 pt-2 pb-1 font-mono text-[10px] uppercase tracking-[0.24em] text-hive-honey/80"
                  >
                    no trades yet · {idle.length}
                  </li>
                )}
                {idle.map((agent) =>
                  renderAgentRow({
                    agent,
                    isPending: pendingName === agent.name,
                    isFocused: focusedName === agent.name,
                    isDimmed: mutation.isPending && pendingName !== agent.name,
                    loadingStats: statsQuery.data === undefined,
                    stats:
                      statsQuery.data === undefined
                        ? null
                        : (statsQuery.data?.[agent.name] ?? null),
                    disabled: mutation.isPending,
                    onFocus: setFocusedName,
                    onSelect: handleSelect,
                    rowRefs,
                  }),
                )}
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
