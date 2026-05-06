import type { AgentRuntime } from '../../../shared/agent';
import {
  formatBacktestProgress,
  formatFillsForAgent,
  formatSummary,
} from '../../../shared/backtest/format';
import { BacktestRunner } from '../../../shared/backtest/runner';
import { tryStartBacktestSession } from '../../../shared/backtest/state';
import type { SlashCommandCallbacks } from '../services/command-registry';

const DAYS = 24 * 60 * 60 * 1000;
const DEFAULT_INTERVAL_MS = DAYS;
const DEFAULT_CASH = 10_000;
const OUT_DIR = './backtest-results';

interface ParsedArgs {
  from?: string;
  to?: string;
  coin?: string;
  cash?: string;
  interval?: string;
}

function parseArgs(args: string[]): ParsedArgs {
  const out: ParsedArgs = {};
  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    const next = args[i + 1];
    switch (token) {
      case '--from':
        out.from = next;
        i++;
        break;
      case '--to':
        out.to = next;
        i++;
        break;
      case '--coin':
        out.coin = next;
        i++;
        break;
      case '--cash':
        out.cash = next;
        i++;
        break;
      case '--interval':
        out.interval = next;
        i++;
        break;
    }
  }
  return out;
}

export async function backtestSlashCommand(
  runtime: AgentRuntime,
  callbacks?: SlashCommandCallbacks,
  args: string[] = [],
): Promise<void> {
  const parsed = parseArgs(args);

  const fromMs = parsed.from ? Date.parse(parsed.from) : Date.now() - 30 * DAYS;
  const toMs = parsed.to ? Date.parse(parsed.to) : Date.now();
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
    callbacks?.onError?.('--from and --to must be ISO 8601 dates (e.g. 2026-04-25)');
    return;
  }
  if (toMs <= fromMs) {
    callbacks?.onError?.('--to must be after --from');
    return;
  }

  const watchList = [parsed.coin ?? 'BTC'];
  const intervalMs = parsed.interval ? Number(parsed.interval) : DEFAULT_INTERVAL_MS;
  const initialCashUsd = parsed.cash ? Number(parsed.cash) : DEFAULT_CASH;
  const outDir = OUT_DIR;

  if (Number.isNaN(intervalMs) || intervalMs <= 0) {
    callbacks?.onError?.('--interval must be a positive number of milliseconds');
    return;
  }
  if (Number.isNaN(initialCashUsd) || initialCashUsd <= 0) {
    callbacks?.onError?.('--cash must be a positive number');
    return;
  }

  const fromIso = new Date(fromMs).toISOString();
  const toIso = new Date(toMs).toISOString();

  const session = tryStartBacktestSession({
    from: fromMs,
    to: toMs,
    intervalMs,
    initialCashUsd,
    watchList,
    source: 'chat',
  });
  if ('running' in session) {
    callbacks?.onMessage?.(
      'A backtest is already running — showing current progress instead of starting a new one.\n' +
        formatBacktestProgress(session.running),
    );
    return;
  }

  callbacks?.onMessage?.(
    `Running backtest: ${fromIso} → ${toIso} on ${watchList[0]} (interval ${intervalMs}ms, cash $${initialCashUsd}). This may take a few minutes…`,
  );

  try {
    const summary = await BacktestRunner.run({
      from: fromMs,
      to: toMs,
      watchList,
      runtime,
      intervalMs,
      initialCashUsd,
      outDir,
      onProgress: (p) => session.handle.tick(p),
    });

    const summaryText = formatSummary(summary);
    callbacks?.onMessage?.(summaryText);

    // Read fills from the output directory for an actionable per-trade list.
    let fillsText = '';
    try {
      const { readFile } = await import('node:fs/promises');
      const { join } = await import('node:path');
      const raw = await readFile(join(outDir, 'fills.jsonl'), 'utf-8');
      const fills = raw
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      fillsText = formatFillsForAgent(fills);
    } catch {
      fillsText = '(fills.jsonl unavailable)';
    }

    const agentContext = ['[Backtest Result]', summaryText.trim(), '', 'Fills:', fillsText].join(
      '\n',
    );
    callbacks?.onAgentContext?.(agentContext);
    session.handle.finish();
  } catch (err) {
    session.handle.fail(err);
    const message = err instanceof Error ? err.message : String(err);
    callbacks?.onError?.(`Backtest failed: ${message}`);
  }
}
