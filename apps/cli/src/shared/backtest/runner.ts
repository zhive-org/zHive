import { appendFile, mkdir, unlink, writeFile } from 'fs/promises';
import * as path from 'path';
import { AgentRuntime } from '../agent/runtime';
import { TradingAgent } from '../trading/agent';
import { ProviderFactory } from '../trading/analyzer';
import { TradeDecision } from '../trading/types';
import { CandleStore } from './candle-store';
import { BacktestClock } from './clock';
import { BacktestExchange } from './exchange';
import { BacktestProvider } from './provider';
import { FillRecord } from './types';

export interface BacktestRunOptions {
  from: number;
  to: number;
  watchList: string[];
  runtime: AgentRuntime;
  intervalMs?: number;
  initialCashUsd?: number;
  slippage?: number;
  feeBps?: number;
  outDir: string;
  onProgress?: (info: { currentTime: number; currentEquity: number }) => void;
}

export interface BacktestSummary {
  from: number;
  to: number;
  ticks: number;
  initialCashUsd: number;
  finalEquity: number;
  totalReturnPct: number;
  realizedPnl: number;
  numFills: number;
  numClosedTrades: number;
  wins: number;
  losses: number;
  winRatePct: number;
  maxDrawdownPct: number;
  perAsset: Record<string, { realizedPnl: number; numClosed: number }>;
}

const DEFAULT_TICK_MS = 60 * 60 * 1000; // 1h
const DEFAULT_CASH = 10_000;

export class BacktestRunner {
  static async run(opts: BacktestRunOptions): Promise<BacktestSummary> {
    const intervalMs = opts.intervalMs ?? DEFAULT_TICK_MS;
    const initialCash = opts.initialCashUsd ?? DEFAULT_CASH;

    await mkdir(opts.outDir, { recursive: true });

    const decisionsPath = path.join(opts.outDir, 'decisions.jsonl');
    const fillsPath = path.join(opts.outDir, 'fills.jsonl');
    const snapshotsPath = path.join(opts.outDir, 'snapshots.jsonl');
    const summaryPath = path.join(opts.outDir, 'summary.json');

    // Truncate any prior outputs (and remove stale summary.json so a failed
    // run doesn't leave the previous summary in place).
    await Promise.all([
      writeFile(decisionsPath, ''),
      writeFile(fillsPath, ''),
      writeFile(snapshotsPath, ''),
      unlink(summaryPath).catch(() => {}),
    ]);

    const clock = new BacktestClock(opts.from);
    const store = await CandleStore.create();

    const exchange = new BacktestExchange(clock, store, {
      initialCashUsd: initialCash,
      slippage: opts.slippage,
      feeBps: opts.feeBps,
    });

    const providerCache = new Map<string, BacktestProvider>();
    const providerFactory: ProviderFactory = async (coin) => {
      const dex = coin.includes(':') ? coin.split(':')[0] : '__nodex__';
      const cached = providerCache.get(dex);
      if (cached) return cached;
      const created = await BacktestProvider.create({
        store,
        clock,
        dex: dex === '__nodex__' ? undefined : dex,
      });
      providerCache.set(dex, created);
      return created;
    };

    const decisionLog: TradeDecision[] = [];
    const agent = await TradingAgent.create(
      opts.watchList,
      opts.runtime,
      {
        onEvalStarted: () => {},
        onEvalCompleted: (decision) => {
          decisionLog.push(decision);
        },
        onError: (msg) => {
          console.error(`[backtest tick error] ${msg}`);
        },
      },
      { exchange, providerFactory },
    );

    let priorFills = 0;
    const equityCurve: number[] = [];

    for (let t = opts.from; t <= opts.to; t += intervalMs) {
      await exchange.advanceTo(t);
      clock.set(t);

      try {
        await agent.runOnce();
      } catch (err) {
        console.error(`[backtest] tick ${new Date(t).toISOString()} failed: ${String(err)}`);
      }

      // Persist any new decisions emitted this tick.
      if (decisionLog.length > 0) {
        const lines = decisionLog.map((d) => JSON.stringify({ ts: t, ...d })).join('\n') + '\n';
        await appendFile(decisionsPath, lines);
        decisionLog.length = 0;
      }

      // Persist any new fills.
      const fills = exchange.fills_();
      if (fills.length > priorFills) {
        const newFills = fills.slice(priorFills);
        const lines = newFills.map((f) => JSON.stringify(f)).join('\n') + '\n';
        await appendFile(fillsPath, lines);
        priorFills = fills.length;
      }

      // Snapshot at end of tick.
      const snap = await exchange.snapshot();
      await appendFile(snapshotsPath, JSON.stringify(snap) + '\n');
      equityCurve.push(snap.equity);

      opts.onProgress?.({ currentTime: t, currentEquity: snap.equity });
    }

    // Final flush: close clock through `to` to resolve any leftover triggers.
    await exchange.advanceTo(opts.to);

    const summary = summarize(opts, exchange.fills_(), equityCurve, initialCash);
    await writeFile(summaryPath, JSON.stringify(summary, null, 2));
    return summary;
  }
}

function summarize(
  opts: BacktestRunOptions,
  fills: readonly FillRecord[],
  equityCurve: number[],
  initialCash: number,
): BacktestSummary {
  const closing = fills.filter((f) => f.action !== 'OPEN');
  let wins = 0;
  let losses = 0;
  let realized = 0;
  const perAsset: BacktestSummary['perAsset'] = {};

  for (const f of closing) {
    realized += f.realizedPnlUsd;
    if (f.realizedPnlUsd > 0) wins++;
    else if (f.realizedPnlUsd < 0) losses++;
    if (!perAsset[f.asset]) perAsset[f.asset] = { realizedPnl: 0, numClosed: 0 };
    perAsset[f.asset].realizedPnl += f.realizedPnlUsd;
    perAsset[f.asset].numClosed += 1;
  }

  const finalEquity = equityCurve.length > 0 ? equityCurve[equityCurve.length - 1] : initialCash;
  const totalReturnPct = ((finalEquity - initialCash) / initialCash) * 100;

  let peak = -Infinity;
  let maxDDPct = 0;
  for (const eq of equityCurve) {
    if (eq > peak) peak = eq;
    const dd = peak > 0 ? ((peak - eq) / peak) * 100 : 0;
    if (dd > maxDDPct) maxDDPct = dd;
  }

  const numClosedTrades = closing.length;
  const winRatePct = numClosedTrades > 0 ? (wins / numClosedTrades) * 100 : 0;

  return {
    from: opts.from,
    to: opts.to,
    ticks: equityCurve.length,
    initialCashUsd: initialCash,
    finalEquity,
    totalReturnPct,
    realizedPnl: realized,
    numFills: fills.length,
    numClosedTrades,
    wins,
    losses,
    winRatePct,
    maxDrawdownPct: maxDDPct,
    perAsset,
  };
}
