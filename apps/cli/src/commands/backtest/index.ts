import { Command } from 'commander';
import { access } from 'fs/promises';
import { join } from 'path';
import { initializeAgentRuntime } from '../../shared/agent/runtime';
import { formatBacktestProgress, formatSummary } from '../../shared/backtest/format';
import { BacktestRunner } from '../../shared/backtest/runner';
import { tryStartBacktestSession } from '../../shared/backtest/state';
import { getHiveDir } from '../../shared/config/constant';
import { loadAgentEnv } from '../../shared/config/env-loader';

export const createBacktestCommand = (): Command => {
  return new Command('backtest')
    .description('Replay the trading agent against historical Hyperliquid candles')
    .option('--agent <name>', 'Agent name under ~/.zhive/agents/<name>; defaults to cwd')
    .requiredOption('--from <date>', 'Start date (ISO 8601, e.g. 2026-01-01)')
    .requiredOption('--to <date>', 'End date (ISO 8601, e.g. 2026-01-31)')
    .option('--cash <usd>', 'Initial USDC balance', '10000')
    .option('--interval <ms>', 'Decision tick in milliseconds', String(4 * 60 * 60 * 1000))
    .option('--coin <symbol>', 'Restrict the run to a single watchlist coin (e.g. xyz:GOLD)')
    .option('--out <dir>', 'Output directory for JSONL artifacts', './backtest-results')
    .option('--slippage <fraction>', 'Per-fill slippage as a fraction (e.g. 0.03)', '0.03')
    .option('--fee-bps <bps>', 'Taker fee in basis points', '2.5')
    .action(async (raw) => {
      let agentDir: string;
      if (raw.agent) {
        agentDir = join(getHiveDir(), 'agents', raw.agent);
      } else {
        agentDir = process.cwd();
      }

      const hasSoul = await access(join(agentDir, 'SOUL.md'))
        .then(() => true)
        .catch(() => false);
      if (!hasSoul) {
        const where = raw.agent ? `"${raw.agent}" (${agentDir})` : 'current directory';
        console.error(`Error: no SOUL.md found in ${where}`);
        process.exit(1);
      }

      // Agent runtime + env loaders expect to operate from the agent dir.
      process.chdir(agentDir);

      const fromMs = Date.parse(raw.from);
      const toMs = Date.parse(raw.to);
      if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
        console.error('Error: --from and --to must be ISO 8601 dates');
        process.exit(1);
      }
      if (toMs <= fromMs) {
        console.error('Error: --to must be after --from');
        process.exit(1);
      }

      await loadAgentEnv();
      const runtime = await initializeAgentRuntime(agentDir);

      const fullWatchList = runtime.config.watchList;
      let watchList: string[];
      if (raw.coin) {
        if (!fullWatchList.includes(raw.coin)) {
          console.error(
            `Error: --coin ${raw.coin} not in agent watchlist [${fullWatchList.join(', ')}]`,
          );
          process.exit(1);
        }
        watchList = [raw.coin];
      } else if (fullWatchList.length > 1) {
        watchList = [fullWatchList[0]];
        console.log(
          `Watchlist has ${fullWatchList.length} coins; restricting to "${fullWatchList[0]}". Pass --coin to override.`,
        );
      } else {
        watchList = fullWatchList;
      }

      const intervalMs = Number(raw.interval);
      const initialCashUsd = Number(raw.cash);

      const session = tryStartBacktestSession({
        from: fromMs,
        to: toMs,
        intervalMs,
        initialCashUsd,
        watchList,
        source: 'cli',
      });
      if ('running' in session) {
        console.log(formatBacktestProgress(session.running));
        return;
      }

      try {
        const summary = await BacktestRunner.run({
          from: fromMs,
          to: toMs,
          watchList,
          runtime,
          intervalMs,
          initialCashUsd,
          slippage: Number(raw.slippage),
          feeBps: Number(raw.feeBps),
          outDir: raw.out,
          onProgress: (p) => session.handle.tick(p),
        });
        session.handle.finish();
        console.log(formatSummary(summary));
      } catch (err) {
        session.handle.fail(err);
        throw err;
      }
    });
};
