import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { fetchAgentsStats, selectAgent } from '../lib/api';
import { formatPercent, formatUsd } from '../lib/format';
import type { PickerAgentStats, PickerAgentSummary } from '../lib/types';

interface AgentPickerProps {
  agents: PickerAgentSummary[];
}

function formatCreated(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const STARTING_EQUITY_USD = 10_000;

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
    // Loading — stats haven't been fetched yet. Render a neutral placeholder
    // line of the same height to avoid layout shift when the data lands.
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

  const sorted = [...agents].sort(
    (a, b) => new Date(a.created).getTime() - new Date(b.created).getTime(),
  );

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
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-mono text-xs font-medium uppercase tracking-wider text-hive-text-secondary">
              {agents.length} {agents.length === 1 ? 'agent' : 'agents'}
            </h2>
            <span className="font-mono text-xs text-hive-text-dim">click an agent to start</span>
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
                const isDisabled = mutation.isPending;
                // statsQuery.data is undefined until the first response lands.
                // After that, agents missing from the map mean "no leaderboard
                // entry yet" — surface as `null` so StatsRow shows the empty
                // state instead of the loading placeholder.
                const stats =
                  statsQuery.data === undefined
                    ? undefined
                    : (statsQuery.data[agent.name] ?? null);
                return (
                  <li key={agent.name}>
                    <button
                      type="button"
                      disabled={isDisabled}
                      onClick={() => mutation.mutate(agent.name)}
                      className="group flex w-full items-center gap-4 border border-hive-border bg-hive-near-black px-4 py-3 text-left transition-colors hover:border-hive-honey hover:bg-hive-honey-dim disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {agent.avatarUrl ? (
                        <img
                          src={agent.avatarUrl}
                          alt=""
                          className="h-12 w-12 shrink-0 border border-hive-border bg-hive-black object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center border border-hive-border bg-hive-black font-mono text-lg text-hive-honey">
                          {agent.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-mono text-sm font-medium text-hive-text-primary group-hover:text-hive-honey">
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
                        <span className="ml-3 shrink-0 font-mono text-xs text-hive-honey">
                          starting…
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
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
