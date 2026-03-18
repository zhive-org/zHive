import type { ActiveRound, Conviction, HiveAgent } from '@zhive/sdk';
import {
  processMegathreadRound,
  screenMegathreadRound,
  type ScreenResult,
  type TokenUsage,
} from './analysis.js';
import { getMarketClient } from './tools/market/index.js';
import { extractErrorMessage } from './utils.js';
import { AgentRuntime } from './runtime.js';
import { getPrice } from '../ta/service.js';

// ─── Megathread Round Handler ──────────────────────

export interface MegathreadReporter {
  onRoundStart(round: ActiveRound, timeframe: string): void;
  onPriceInfo(priceAtStart: number, currentPrice?: number): void;
  onScreenResult?(round: ActiveRound, result: ScreenResult): void;
  onResearching(projectId: string): void;
  onToolsUsed(toolNames: string[], callCount: number): void;
  onSkipped(round: ActiveRound, usage: TokenUsage): void;
  onPosted(
    round: ActiveRound,
    conviction: number,
    summary: string,
    timeframe: string,
    usage: TokenUsage,
  ): void;
  onError(round: ActiveRound, message: string): void;
}

export async function fetchRoundPrices(
  projectId: string,
  roundTimestamp: string,
  currentTime?: string,
) {
  let priceAtStart: number | undefined;
  let currentPrice: number | undefined;
  try {
    [priceAtStart, currentPrice] = await Promise.all([
      getPrice({ project: projectId, at: roundTimestamp }),
      getPrice({ project: projectId, at: currentTime ?? new Date().toISOString() }),
    ]);
  } catch {
    // Price fetch failed — both stay undefined
  }

  return {
    priceAtStart,
    currentPrice,
  };
}

const calculateTimeframe = (round: ActiveRound) => {
  const hours = Math.round(round.durationMs / 3_600_000);
  if (hours >= 24) {
    const days = Math.round(hours / 24);
    return `${days}d`;
  }
  const timeframe = hours >= 1 ? `${hours}h` : `${Math.round(round.durationMs / 60_000)}m`;
  return timeframe;
};

async function run({
  round,
  runtime,
  reporter,
  recentComments,
}: {
  round: ActiveRound;
  runtime: AgentRuntime;
  reporter: MegathreadReporter;
  recentComments: readonly string[];
}): Promise<
  | { skip: false; summary: string; conviction: Conviction; usage: TokenUsage }
  | { skip: true; usage: TokenUsage; screenResult?: ScreenResult }
> {
  const timeframe = calculateTimeframe(round);
  reporter.onRoundStart(round, timeframe);
  // ── Fetch prices ──────────────────────────────
  const roundStartTimestamp = new Date(round.snapTimeMs).toISOString();
  const { priceAtStart, currentPrice } = await fetchRoundPrices(
    round.projectId,
    roundStartTimestamp,
  );
  if (priceAtStart !== undefined) {
    reporter.onPriceInfo(priceAtStart, currentPrice);
  }

  // ── Quick screen (cheap engage check) ───────
  const screenResult = await screenMegathreadRound(round.projectId, runtime.config.strategyContent);
  if (!screenResult.engage) {
    reporter.onScreenResult?.(round, screenResult);
    return { skip: true, usage: screenResult.usage, screenResult };
  }

  reporter.onResearching(round.projectId);

  // ── Run analysis ──────────────────────────────
  const result = await processMegathreadRound({
    projectId: round.projectId,
    durationMs: round.durationMs,
    recentComments,
    agentRuntime: runtime,
    priceAtStart,
    currentPrice,
  });

  reporter.onToolsUsed(result.usage.toolNames, result.usage.toolCalls);
  if (result.skip) {
    reporter.onSkipped(round, result.usage);
  }

  return result;
}

export function createMegathreadRoundBatchHandler(
  getAgent: () => HiveAgent,
  runtime: AgentRuntime,
  reporter: MegathreadReporter,
): (rounds: ActiveRound[]) => Promise<void> {
  const handler = async (rounds: ActiveRound[]): Promise<void> => {
    const agent = getAgent();
    const promises: ReturnType<typeof run>[] = [];

    // report item in order that it is polled to prevent out-of-order write to stdout
    for (const round of rounds) {
      promises.push(run({ round, runtime, reporter, recentComments: agent.recentComments }));
    }

    const results = await Promise.allSettled(promises);

    for (let i = 0; i < results.length; i++) {
      const round = rounds[i];
      const result = results[i];
      if (result.status === 'rejected') {
        const raw = extractErrorMessage(result.reason);
        const message = raw.length > 120 ? raw.slice(0, 120) + '\u2026' : raw;
        reporter.onError(round, message);
        continue;
      }

      const data = result.value;

      if (data.skip) {
        continue;
      }

      // TODO: we can optimized this by create method to commit this in batch in hive sdk.
      // postMegathreadComment cannot be run concurrently so we need to call it one by one.
      await agent.postMegathreadComment(round.roundId, {
        text: data.summary,
        conviction: data.conviction,
      });

      const timeframe = calculateTimeframe(round);
      reporter.onPosted(round, data.conviction, data.summary, timeframe, data.usage);
    }
  };

  return handler;
}

export function createMegathreadRoundHandler(
  getAgent: () => HiveAgent,
  runtime: AgentRuntime,
  reporter: MegathreadReporter,
): (round: ActiveRound) => Promise<void> {
  const handler = async (round: ActiveRound): Promise<void> => {
    const agent = getAgent();
    try {
      const result = await run({
        round,
        reporter,
        recentComments: agent.recentComments,
        runtime,
      });
      if (result.skip) {
        return;
      }
      // ── Post comment ──────────────────────────────
      await agent.postMegathreadComment(round.roundId, {
        text: result.summary,
        conviction: result.conviction,
      });

      const timeframe = calculateTimeframe(round);
      reporter.onPosted(round, result.conviction, result.summary, timeframe, result.usage);
    } catch (err: unknown) {
      const raw = extractErrorMessage(err);
      const message = raw.length > 120 ? raw.slice(0, 120) + '\u2026' : raw;
      reporter.onError(round, message);
    }
  };

  return handler;
}
