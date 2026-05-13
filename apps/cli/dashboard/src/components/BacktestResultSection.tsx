import { useMemo, useState } from 'react';
import type { BacktestArtifacts, BacktestSummary, FillRecord } from '../lib/types';
import { formatPercent, formatPrice, formatUsd } from '../lib/format';
import { SectionHeader } from './primitives/SectionHeader';
import { SymbolLink } from './primitives/SymbolLink';
import { BacktestEquityCurve } from './BacktestEquityCurve';

interface BacktestResultSectionProps {
  summary: BacktestSummary;
  artifacts?: BacktestArtifacts;
}

const DEFAULT_FILL_LIMIT = 100;

export function BacktestResultSection({ summary, artifacts }: BacktestResultSectionProps) {
  const returnPos = summary.totalReturnPct >= 0;
  const realizedPos = summary.realizedPnl >= 0;
  const perAssetEntries = Object.entries(summary.perAsset);

  return (
    <section className="bg-hive-near-black">
      <SectionHeader title="result" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-hive-border">
        <Stat label="FINAL EQUITY" value={formatUsd(summary.finalEquity)} />
        <Stat
          label="TOTAL RETURN"
          value={formatPercent(summary.totalReturnPct)}
          color={returnPos ? 'text-hive-bullish' : 'text-hive-bearish'}
        />
        <Stat
          label="REALIZED PNL"
          value={formatUsd(summary.realizedPnl, { signed: true })}
          color={realizedPos ? 'text-hive-bullish' : 'text-hive-bearish'}
        />
        <Stat label="WIN RATE" value={formatPercent(summary.winRatePct)} />
        <Stat label="WINS / LOSSES" value={`${summary.wins} / ${summary.losses}`} />
        <Stat
          label="MAX DRAWDOWN"
          value={formatPercent(-Math.abs(summary.maxDrawdownPct))}
          color="text-hive-bearish"
        />
        <Stat label="FILLS" value={String(summary.numFills)} />
        <Stat label="INITIAL CASH" value={formatUsd(summary.initialCashUsd)} />
      </div>

      {perAssetEntries.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 py-3 border-t border-hive-border">
          {perAssetEntries.map(([asset, { realizedPnl, numClosed }]) => (
            <span
              key={asset}
              className="inline-flex items-center gap-2 border border-hive-border px-2 py-1 font-mono text-[11px]"
            >
              <SymbolLink asset={asset} variant="inline" />
              <span className="text-hive-text-dim">{numClosed} closed</span>
              <span className={realizedPnl >= 0 ? 'text-hive-bullish' : 'text-hive-bearish'}>
                {formatUsd(realizedPnl, { signed: true })}
              </span>
            </span>
          ))}
        </div>
      )}

      <div className="border-t border-hive-border px-4 py-4">
        <SectionHeader title="equity curve" />
        <BacktestEquityCurve snapshots={artifacts?.snapshots ?? []} />
      </div>

      <FillsBlock fills={artifacts?.fills} />
    </section>
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
    <div className="bg-hive-near-black p-4">
      <div className="font-mono text-[10px] uppercase tracking-wider text-hive-text-dim">
        {label}
      </div>
      <div className={`mt-1 font-mono font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

interface FillsBlockProps {
  fills?: FillRecord[];
}

function FillsBlock({ fills }: FillsBlockProps) {
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo<FillRecord[]>(() => {
    if (!fills) return [];
    return [...fills].sort((a, b) => b.ts - a.ts);
  }, [fills]);

  const total = sorted.length;
  const visible = showAll ? sorted : sorted.slice(0, DEFAULT_FILL_LIMIT);
  const overflow = total > DEFAULT_FILL_LIMIT;

  return (
    <div className="border-t border-hive-border">
      <SectionHeader title="fills" right={`${total} fills`} />
      {total === 0 ? (
        <div className="px-4 py-10 text-center font-mono text-xs text-hive-text-dim">No fills</div>
      ) : (
        <>
          <div className="max-h-[480px] overflow-y-auto">
            <table className="w-full font-mono text-[11px]">
              <thead className="sticky top-0 z-10 bg-hive-black">
                <tr className="border-b border-hive-border">
                  <Th>Time</Th>
                  <Th>Symbol</Th>
                  <Th>Side</Th>
                  <Th>Action</Th>
                  <Th className="text-right">Size</Th>
                  <Th className="text-right">Price</Th>
                  <Th className="text-right">Notional</Th>
                  <Th className="text-right">Fee</Th>
                  <Th className="text-right">PnL</Th>
                  <Th>Reason</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((fill, idx) => (
                  <FillRow key={`${fill.ts}-${fill.asset}-${idx}`} fill={fill} />
                ))}
              </tbody>
            </table>
          </div>
          {overflow && (
            <div className="flex items-center justify-center border-t border-hive-border px-4 py-2.5">
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border border-hive-border text-hive-text-secondary transition-colors hover:border-hive-honey hover:text-hive-honey"
              >
                {showAll ? `Show first ${DEFAULT_FILL_LIMIT}` : `Show all (${total})`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-3 py-2 text-left text-[9px] font-normal uppercase tracking-[0.22em] text-hive-text-dim ${className}`}
    >
      {children}
    </th>
  );
}

function formatFillTime(ts: number): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (sameDay) {
    const ss = String(d.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${mo}/${day} ${hh}:${mm}`;
}

function quantityPrecision(value: number): number {
  const abs = Math.abs(value);
  if (abs >= 1) return 4;
  if (abs >= 0.01) return 6;
  return 8;
}

function truncateReason(reason: string, max = 80): string {
  if (reason.length <= max) return reason;
  return `${reason.slice(0, max - 1)}…`;
}

interface FillRowProps {
  fill: FillRecord;
}

function FillRow({ fill }: FillRowProps) {
  const isLong = fill.side === 'long';
  const pnlPos = fill.realizedPnlUsd >= 0;
  const isOpen = fill.action === 'OPEN';
  const actionLabel = fill.action.replace('CLOSE_', 'CLOSE ');

  return (
    <tr className="border-b border-hive-border/40 hover:bg-hive-border/10 transition-colors">
      <td className="px-3 py-2 text-[10px] text-hive-text-dim tabular-nums">
        {formatFillTime(fill.ts)}
      </td>
      <td className="px-3 py-2">
        <SymbolLink asset={fill.asset} variant="badge" />
      </td>
      <td className="px-3 py-2">
        <span
          className={`inline-flex items-center font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 ${
            isLong ? 'text-hive-bullish bg-hive-bullish/10' : 'text-hive-bearish bg-hive-bearish/10'
          }`}
        >
          {fill.side}
        </span>
      </td>
      <td className="px-3 py-2 text-[10px] uppercase tracking-wider text-hive-text-dim">
        {actionLabel}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-hive-text-secondary">
        {fill.size.toFixed(quantityPrecision(fill.size))}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-hive-text-secondary">
        {formatPrice(fill.price)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-hive-text-secondary">
        {formatUsd(fill.notionalUsd)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-hive-text-dim">
        {formatUsd(fill.feeUsd)}
      </td>
      <td
        className={`px-3 py-2 text-right font-bold tabular-nums ${
          isOpen ? 'text-hive-text-dim' : pnlPos ? 'text-hive-bullish' : 'text-hive-bearish'
        }`}
      >
        {isOpen || fill.realizedPnlUsd === 0
          ? '—'
          : formatUsd(fill.realizedPnlUsd, { signed: true })}
      </td>
      <td
        className="px-3 py-2 text-[10px] text-hive-text-dim max-w-[320px] truncate"
        title={fill.reasoning}
      >
        {truncateReason(fill.reasoning)}
      </td>
    </tr>
  );
}
