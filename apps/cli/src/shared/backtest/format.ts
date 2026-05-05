import { BacktestSummary } from './runner';
import { FillRecord } from './types';

const fmtMoney = (v: number): string =>
  `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtPct = (v: number): string => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

export function formatSummary(s: BacktestSummary): string {
  const lines: string[] = [];
  lines.push('');
  lines.push('Backtest Summary');
  lines.push('----------------');
  lines.push(
    `Window:          ${new Date(s.from).toISOString()} → ${new Date(s.to).toISOString()}`,
  );
  lines.push(`Ticks:           ${s.ticks}`);
  lines.push(`Initial cash:    ${fmtMoney(s.initialCashUsd)}`);
  lines.push(`Final equity:    ${fmtMoney(s.finalEquity)}`);
  lines.push(`Total return:    ${fmtPct(s.totalReturnPct)}`);
  lines.push(`Realized PnL:    ${fmtMoney(s.realizedPnl)}`);
  lines.push(`Max drawdown:    ${s.maxDrawdownPct.toFixed(2)}%`);
  lines.push(
    `Trades closed:   ${s.numClosedTrades} (W ${s.wins} / L ${s.losses}, ${s.winRatePct.toFixed(1)}%)`,
  );
  lines.push(`Total fills:     ${s.numFills}`);
  if (Object.keys(s.perAsset).length > 0) {
    lines.push('');
    lines.push('Per-asset:');
    for (const [asset, info] of Object.entries(s.perAsset)) {
      lines.push(
        `  ${asset.padEnd(12)} ${info.numClosed.toString().padStart(3)} closes  ${fmtMoney(info.realizedPnl)}`,
      );
    }
  }
  return lines.join('\n');
}

/** Compact per-fill list intended for the agent's chat context. */
export function formatFillsForAgent(fills: readonly FillRecord[]): string {
  if (fills.length === 0) return 'No fills.';

  const opens = new Map<string, FillRecord>();
  const lines: string[] = [];

  for (const f of fills) {
    if (f.action === 'OPEN') {
      opens.set(f.asset, f);
      continue;
    }
    const open = opens.get(f.asset);
    opens.delete(f.asset);
    const entry = open ? open.price : null;
    const side = f.side.toUpperCase();
    const why = f.action === 'CLOSE_MANUAL' ? 'manual' : f.action.replace('CLOSE_', '').toLowerCase();
    const pnl = `${f.realizedPnlUsd >= 0 ? '+' : ''}$${f.realizedPnlUsd.toFixed(2)}`;
    if (entry !== null) {
      lines.push(
        `  - ${side} ${f.asset} @${entry.toFixed(2)} → ${f.price.toFixed(2)} (${pnl}) — ${why}`,
      );
    } else {
      lines.push(`  - ${side} ${f.asset} close @${f.price.toFixed(2)} (${pnl}) — ${why}`);
    }
  }

  return lines.length > 0 ? lines.join('\n') : 'No closed trades.';
}
