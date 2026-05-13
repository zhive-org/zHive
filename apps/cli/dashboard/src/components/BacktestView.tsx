import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAvailableTickers,
  fetchBacktestArtifacts,
  fetchBacktestStatus,
  startBacktest,
} from '../lib/api';
import { formatHoldTime, formatUsd } from '../lib/format';
import type {
  BacktestArtifacts,
  BacktestProgress,
  BacktestStatus,
  BacktestSummary,
  WebState,
} from '../lib/types';
import { BacktestResultSection } from './BacktestResultSection';
import { PageHeader } from './primitives/PageHeader';
import { SectionHeader } from './primitives/SectionHeader';

interface BacktestViewProps {
  state: WebState;
  onClose: () => void;
}

export function BacktestView({ state, onClose }: BacktestViewProps) {
  return (
    <div className="flex h-screen flex-col bg-hive-black font-mono text-hive-text-primary">
      <PageHeader
        leading={
          <button
            type="button"
            onClick={onClose}
            className="border border-hive-border bg-hive-black px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-hive-text-secondary transition-colors hover:border-hive-honey hover:text-hive-honey"
          >
            ← back
          </button>
        }
        title={`${state.agentName} / backtest`}
      />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-px bg-hive-border">
          <ParametersSection />
          <StatusSection />
        </div>
      </main>
    </div>
  );
}

// ─── Reusable bits ────────────────────────────────────

function SectionShell({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-hive-near-black">
      <SectionHeader title={title} right={hint} />
      <div className="flex flex-col gap-3 p-4">{children}</div>
    </section>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-hive-text-dim">
      {children}
    </span>
  );
}

function Stat({
  label,
  value,
  color = 'text-hive-text-primary',
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-hive-text-dim">
        {label}
      </span>
      <span className={`font-mono font-semibold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

// ─── Date helpers ─────────────────────────────────────

const MS_PER_DAY = 86_400_000;
const INTERVAL_OPTIONS: ReadonlyArray<{ label: string; value: number }> = [
  { label: '1h', value: 3_600_000 },
  { label: '4h', value: 14_400_000 },
  { label: '1d', value: 86_400_000 },
  { label: '1w', value: 604_800_000 },
];

function toDateInputValue(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function defaultDates(): { from: string; to: string } {
  const now = new Date();
  const past = new Date(now.getTime() - 30 * MS_PER_DAY);
  return { from: toDateInputValue(past), to: toDateInputValue(now) };
}

function formatSimTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

// ─── Parameters ───────────────────────────────────────

function ParametersSection() {
  const queryClient = useQueryClient();
  const tickersQuery = useQuery({
    queryKey: ['available-tickers'],
    queryFn: fetchAvailableTickers,
    staleTime: 60_000,
  });
  const statusQuery = useQuery<BacktestStatus>({
    queryKey: ['backtest-status'],
    queryFn: fetchBacktestStatus,
  });

  const initialDates = useMemo(defaultDates, []);
  const [from, setFrom] = useState<string>(initialDates.from);
  const [to, setTo] = useState<string>(initialDates.to);
  const [coin, setCoin] = useState<string>('');
  const [intervalMs, setIntervalMs] = useState<number>(14_400_000);
  const [cash, setCash] = useState<number>(10_000);

  // Seed `coin` once tickers arrive — picking the first crypto entry.
  const tickers = tickersQuery.data;
  const firstCrypto = tickers?.crypto[0];
  useEffect(() => {
    if (firstCrypto && coin === '') setCoin(firstCrypto);
  }, [firstCrypto, coin]);

  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  const dateValid = Number.isFinite(fromMs) && Number.isFinite(toMs) && toMs > fromMs;
  const cashValid = cash > 0;
  const coinValid = coin.length > 0;
  const valid = dateValid && cashValid && coinValid;

  const isRunning = statusQuery.data?.status === 'running';

  const mutation = useMutation({
    mutationFn: () =>
      startBacktest({
        from: fromMs,
        to: toMs,
        coin,
        intervalMs,
        initialCashUsd: cash,
      }),
    onSuccess: (result) => {
      if (result.ok) {
        void queryClient.invalidateQueries({ queryKey: ['backtest-status'] });
      }
    },
  });

  const submitError =
    mutation.data && mutation.data.ok === false && mutation.data.status === 400
      ? (mutation.data.error ?? 'invalid backtest parameters')
      : null;

  const tickersError = tickersQuery.error instanceof Error ? tickersQuery.error.message : null;

  return (
    <SectionShell title="parameters" hint="historical replay">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <FieldLabel>from</FieldLabel>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="border border-hive-border bg-hive-black px-2 py-1.5 font-mono text-xs text-hive-text-primary placeholder:text-hive-text-dim focus:border-hive-honey focus:outline-none"
          />
          {!dateValid && from.length > 0 && (
            <p className="text-hive-bearish text-[10px]">
              invalid date range — `to` must be after `from`
            </p>
          )}
        </label>

        <label className="flex flex-col gap-1.5">
          <FieldLabel>to</FieldLabel>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="border border-hive-border bg-hive-black px-2 py-1.5 font-mono text-xs text-hive-text-primary placeholder:text-hive-text-dim focus:border-hive-honey focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <FieldLabel>coin</FieldLabel>
          <select
            value={coin}
            onChange={(e) => setCoin(e.target.value)}
            disabled={tickersQuery.isLoading || !tickers}
            className="border border-hive-border bg-hive-black px-2 py-1.5 font-mono text-xs text-hive-text-primary focus:border-hive-honey focus:outline-none disabled:opacity-50"
          >
            {tickers ? (
              <>
                <optgroup label="Crypto">
                  {tickers.crypto.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Stocks & Commodities">
                  {tickers.stockCommodity.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </optgroup>
              </>
            ) : (
              <option value="">loading…</option>
            )}
          </select>
          {tickersError && <p className="text-hive-bearish text-[10px]">{tickersError}</p>}
        </label>

        <label className="flex flex-col gap-1.5">
          <FieldLabel>interval</FieldLabel>
          <select
            value={intervalMs}
            onChange={(e) => setIntervalMs(Number(e.target.value))}
            className="border border-hive-border bg-hive-black px-2 py-1.5 font-mono text-xs text-hive-text-primary focus:border-hive-honey focus:outline-none"
          >
            {INTERVAL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 md:col-span-2">
          <FieldLabel>initial cash (usd)</FieldLabel>
          <input
            type="number"
            min={100}
            step={100}
            value={cash}
            onChange={(e) => setCash(Number(e.target.value))}
            className="border border-hive-border bg-hive-black px-2 py-1.5 font-mono text-xs text-hive-text-primary placeholder:text-hive-text-dim focus:border-hive-honey focus:outline-none"
          />
          {!cashValid && (
            <p className="text-hive-bearish text-[10px]">cash must be greater than 0</p>
          )}
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={mutation.isPending || !valid || isRunning}
          onClick={() => mutation.mutate()}
          className="border border-hive-border bg-transparent px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-hive-text-secondary transition-colors hover:border-hive-honey hover:text-hive-honey disabled:cursor-not-allowed disabled:opacity-40"
        >
          {mutation.isPending ? 'starting…' : 'start backtest'}
        </button>
        {submitError && <span className="font-mono text-xs text-hive-bearish">{submitError}</span>}
      </div>
    </SectionShell>
  );
}

// ─── Status ───────────────────────────────────────────

function StatusSection() {
  const statusQuery = useQuery<BacktestStatus>({
    queryKey: ['backtest-status'],
    queryFn: fetchBacktestStatus,
    refetchInterval: (q) => (q.state.data?.status === 'running' ? 1000 : 30_000),
    staleTime: 0,
  });

  const status = statusQuery.data?.status;
  const isCompleted = status === 'completed';

  const artifactsQuery = useQuery<BacktestArtifacts>({
    queryKey: ['backtest-artifacts'],
    queryFn: fetchBacktestArtifacts,
    enabled: isCompleted,
    staleTime: 60_000,
  });

  return (
    <SectionShell title="status" hint={status ?? 'idle'}>
      {status === undefined || status === 'idle' ? (
        <p className="font-mono text-xs text-hive-text-dim">
          No backtest running. Configure parameters above and start a run.
        </p>
      ) : status === 'running' ? (
        <RunningPanel
          progress={statusQuery.data!.status === 'running' ? statusQuery.data!.progress : null}
        />
      ) : status === 'completed' ? (
        <CompletedPanel
          summary={statusQuery.data!.status === 'completed' ? statusQuery.data!.summary : null}
          artifacts={artifactsQuery.data}
        />
      ) : status === 'failed' ? (
        <FailedPanel
          error={statusQuery.data!.status === 'failed' ? statusQuery.data!.error : 'unknown error'}
        />
      ) : null}
    </SectionShell>
  );
}

function RunningPanel({ progress }: { progress: BacktestProgress | null }) {
  if (!progress) {
    return <p className="font-mono text-xs text-hive-text-dim">starting…</p>;
  }
  const elapsedMs = Date.now() - progress.startedAt;
  const percent = Math.max(0, Math.min(100, progress.percent));
  return (
    <div className="flex flex-col gap-3">
      <div className="h-1 bg-hive-border">
        <div
          className="h-full bg-hive-honey transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-xs">
        <Stat label="TICKS" value={`${progress.ticksCompleted} / ${progress.totalTicks}`} />
        <Stat label="SIM TIME" value={formatSimTime(progress.currentTime)} />
        <Stat label="ELAPSED" value={formatHoldTime(elapsedMs)} />
        <Stat
          label="EQUITY"
          value={progress.currentEquity == null ? '—' : formatUsd(progress.currentEquity)}
        />
      </div>
    </div>
  );
}

function CompletedPanel({
  summary,
  artifacts,
}: {
  summary: BacktestSummary | null;
  artifacts: BacktestArtifacts | undefined;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="inline-flex w-fit items-center gap-1.5 border border-hive-border bg-hive-black px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-hive-bullish">
        <span className="h-1.5 w-1.5 rounded-full bg-hive-bullish" />
        completed
      </span>
      {summary && <BacktestResultSection summary={summary} artifacts={artifacts} />}
    </div>
  );
}

function FailedPanel({ error }: { error: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="inline-flex w-fit items-center gap-1.5 border border-hive-border bg-hive-black px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-hive-bearish">
        <span className="h-1.5 w-1.5 rounded-full bg-hive-bearish" />
        failed
      </span>
      <p className="font-mono text-xs text-hive-bearish">{error}</p>
    </div>
  );
}
