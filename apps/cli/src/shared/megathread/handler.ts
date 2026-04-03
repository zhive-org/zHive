import type {
  ActiveRound,
  AgentPlatform,
  BatchCreateMegathreadCommentDto,
  HiveAgent,
} from '@zhive/sdk';
import { getPrice } from '../ta/service';
import {
  processMegathreadRound,
  processPortfolioRound,
  type PortfolioAllocation,
  type TokenUsage,
} from './analysis';
import { AgentRuntime } from '../agent/runtime';
import { extractErrorMessage } from './utils';

// ─── Megathread Round Handler ──────────────────────

export interface MegathreadReporter {
  onRoundStart(round: ActiveRound, timeframe: string): void;
  onPriceInfo(
    round: ActiveRound,
    priceAtStart: number,
    currentPrice?: number,
    timeLeftMs?: number,
  ): void;
  onResearching(projectId: string): void;
  onToolsUsed(toolNames: string[], callCount: number): void;
  onPosted(
    round: ActiveRound,
    call: 'up' | 'down',
    summary: string,
    timeframe: string,
    usage: TokenUsage,
    confidence?: number,
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
  if (hours > 24 && hours % 24 === 0) {
    const days = hours / 24;
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
}): Promise<{ summary: string; call: 'up' | 'down'; usage?: TokenUsage }> {
  const timeframe = calculateTimeframe(round);
  reporter.onRoundStart(round, timeframe);
  // ── Fetch prices ──────────────────────────────
  const roundStartTimestamp = new Date(round.snapTimeMs).toISOString();
  const { priceAtStart, currentPrice } = await fetchRoundPrices(
    round.projectId,
    roundStartTimestamp,
  );
  if (priceAtStart !== undefined) {
    const roundEndMs = round.snapTimeMs + round.durationMs;
    const timeLeftMs = Math.max(0, roundEndMs - Date.now());
    reporter.onPriceInfo(round, priceAtStart, currentPrice, timeLeftMs);
  }

  reporter.onResearching(round.projectId);

  // ── Run analysis ──────────────────────────────
  try {
    const result = await processMegathreadRound({
      projectId: round.projectId,
      durationMs: round.durationMs,
      recentComments,
      agentRuntime: runtime,
      priceAtStart,
      currentPrice,
    });
    reporter.onToolsUsed(result.usage.toolNames, result.usage.toolCalls);
    if (!result.summary) {
      reporter.onError(round, 'Fail to generate summary');
    } else {
      reporter.onPosted(round, result.call, result.summary, timeframe, result.usage);
    }

    return result;
  } catch (e) {
    reporter.onError(round, 'Failed to process megathread round');
    return { summary: '', call: 'up' };
  }
}

export function createMegathreadRoundBatchHandler(
  getAgent: () => HiveAgent,
  runtime: AgentRuntime,
  reporter: MegathreadReporter,
  options: {
    platform?: AgentPlatform;
  } = {},
): (rounds: ActiveRound[]) => Promise<void> {
  const { platform } = options;
  const handler = async (rounds: ActiveRound[]): Promise<void> => {
    const agent = getAgent();

    // Fetch prices for all rounds in parallel
    const priceResults = await Promise.all(
      rounds.map(async (round) => {
        const roundStartTimestamp = new Date(round.snapTimeMs).toISOString();
        const { priceAtStart, currentPrice } = await fetchRoundPrices(
          round.projectId,
          roundStartTimestamp,
        );
        return { round, priceAtStart, currentPrice };
      }),
    );

    // Report round starts and price info
    const roundMap = new Map<string, ActiveRound>();
    for (const { round, priceAtStart, currentPrice } of priceResults) {
      roundMap.set(round.roundId, round);
      const timeframe = calculateTimeframe(round);
      reporter.onRoundStart(round, timeframe);
      if (priceAtStart !== undefined) {
        const roundEndMs = round.snapTimeMs + round.durationMs;
        const timeLeftMs = Math.max(0, roundEndMs - Date.now());
        reporter.onPriceInfo(round, priceAtStart, currentPrice, timeLeftMs);
      }
    }

    // Build portfolio round inputs
    const portfolioRounds = priceResults.map(({ round, priceAtStart, currentPrice }) => ({
      roundId: round.roundId,
      projectId: round.projectId,
      durationMs: round.durationMs,
      priceAtStart,
      currentPrice,
    }));

    reporter.onResearching('portfolio');

    // Single LLM call for all projects
    try {
      const result = await processPortfolioRound({
        rounds: portfolioRounds,
        recentComments: agent.recentComments,
        agentRuntime: runtime,
      });

      reporter.onToolsUsed(result.usage.toolNames, result.usage.toolCalls);

      // Build batch payload from allocations
      const payload: BatchCreateMegathreadCommentDto = { comments: [], metadata: { platform } };

      for (const allocation of result.allocations) {
        const round = roundMap.get(allocation.roundId);
        if (!round) continue;

        if (!allocation.summary) {
          reporter.onError(round, 'Failed to generate summary');
          continue;
        }

        payload.comments.push({
          call: allocation.call,
          roundId: allocation.roundId,
          text: allocation.summary,
        });

        const timeframe = calculateTimeframe(round);
        reporter.onPosted(
          round,
          allocation.call,
          allocation.summary,
          timeframe,
          result.usage,
          allocation.confidence,
        );
      }

      // if (payload.comments.length > 0) {
      //   await agent.postBatchMegathreadComments(payload).catch((e) => console.log(e));
      // }
    } catch (e) {
      const raw = extractErrorMessage(e);
      const message = raw.length > 120 ? raw.slice(0, 120) + '\u2026' : raw;
      for (const round of rounds) {
        reporter.onError(round, message);
      }
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
      if (!result.summary) {
        return;
      }
      // ── Post comment ──────────────────────────────
      await agent.postMegathreadComment(round.roundId, {
        text: result.summary,
        call: result.call,
      });
    } catch (err: unknown) {
      const raw = extractErrorMessage(err);
      const message = raw.length > 120 ? raw.slice(0, 120) + '\u2026' : raw;
      reporter.onError(round, message);
    }
  };

  return handler;
}
