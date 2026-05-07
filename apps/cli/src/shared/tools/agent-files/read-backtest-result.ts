import { tool } from 'ai';
import * as fs from 'fs/promises';
import * as path from 'path';
import { z } from 'zod';
import { extractErrorMessage } from '../../utils';
import type { BacktestSummary } from '../../backtest/runner';
import type { FillRecord } from '../../backtest/types';
import type { TradeDecision } from '../../trading/types';

interface DecisionRecord extends TradeDecision {
  ts: number;
}

interface JoinedPrediction {
  ts: number;
  asset: string;
  action: TradeDecision['action'];
  sizeUsd: number;
  leverage: number;
  sl: number | null | undefined;
  tp: number | null | undefined;
  reasoning: string;
  fill: FillRecord | null;
  pnl: number;
}

async function readJsonl<T>(filePath: string): Promise<T[]> {
  const raw = await fs.readFile(filePath, 'utf-8');
  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

export function createReadBacktestResultTool(agentDir: string) {
  return tool({
    description:
      'Read the latest backtest result for this agent. Returns summary stats and a list of joined decision/fill/PnL entries. Use to suggest improvements to STRATEGY.md.',
    inputSchema: z.object({
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Number of predictions to return (max 100). Defaults to 20.'),
      order: z
        .enum(['recent', 'worst', 'best'])
        .optional()
        .describe(
          '"recent" = most recent first, "worst" = most-negative PnL first, "best" = most-positive PnL first. Defaults to "recent".',
        ),
    }),
    execute: async ({ limit, order }) => {
      const effectiveLimit = limit ?? 20;
      const effectiveOrder = order ?? 'recent';
      const dir = path.join(agentDir, 'backtest-results');
      const summaryPath = path.join(dir, 'summary.json');
      const decisionsPath = path.join(dir, 'decisions.jsonl');
      const fillsPath = path.join(dir, 'fills.jsonl');

      try {
        await fs.access(summaryPath);
      } catch {
        return {
          error: 'No backtest results found. Run /backtest --from <iso> --to <iso> first.',
        };
      }

      try {
        const [summaryRaw, decisions, fills] = await Promise.all([
          fs.readFile(summaryPath, 'utf-8'),
          readJsonl<DecisionRecord>(decisionsPath).catch(() => []),
          readJsonl<FillRecord>(fillsPath).catch(() => []),
        ]);
        const summary = JSON.parse(summaryRaw) as BacktestSummary;

        // Index fills by (ts, asset). A close-fill carries realizedPnlUsd; an
        // OPEN fill is the entry side. We prefer the closing fill since it
        // carries the realized PnL, but fall back to OPEN so the model can at
        // least see the entry context for trades still open at end of run.
        const fillByKey = new Map<string, FillRecord>();
        for (const f of fills) {
          const key = `${f.ts}:${f.asset}`;
          const existing = fillByKey.get(key);
          if (!existing || (existing.action === 'OPEN' && f.action !== 'OPEN')) {
            fillByKey.set(key, f);
          }
        }

        const joined: JoinedPrediction[] = decisions.map((d) => {
          const fill = fillByKey.get(`${d.ts}:${d.asset}`) ?? null;
          return {
            ts: d.ts,
            asset: d.asset,
            action: d.action,
            sizeUsd: d.sizeUsd,
            leverage: d.leverage,
            sl: d.sl,
            tp: d.tp,
            reasoning: d.reasoning,
            fill,
            pnl: fill?.realizedPnlUsd ?? 0,
          };
        });

        let ordered: JoinedPrediction[];
        if (effectiveOrder === 'recent') {
          ordered = [...joined].sort((a, b) => b.ts - a.ts);
        } else if (effectiveOrder === 'worst') {
          ordered = joined.filter((p) => p.fill !== null).sort((a, b) => a.pnl - b.pnl);
        } else {
          ordered = joined.filter((p) => p.fill !== null).sort((a, b) => b.pnl - a.pnl);
        }

        return {
          summary,
          predictions: ordered.slice(0, effectiveLimit),
          totalPredictions: joined.length,
          order: effectiveOrder,
        };
      } catch (err) {
        return { error: extractErrorMessage(err) };
      }
    },
  });
}
