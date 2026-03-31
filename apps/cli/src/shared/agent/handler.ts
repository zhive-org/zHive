import type {
  ActiveRound,
  AgentPlatform,
  BatchCreateMegathreadCommentDto,
  HiveAgent,
} from '@zhive/sdk';
import _ from 'lodash';
import { getPrice } from '../ta/service';
import { processMegathreadRound, type TokenUsage } from './analysis';
import { AgentRuntime } from './runtime';
import { screenMegathreadRounds } from './scanner';
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
  onScreenStart?(): void;
  onScreenResult?(engagingRounds: ActiveRound[], totalRound: number): void;
  onResearching(projectId: string): void;
  onToolsUsed(toolNames: string[], callCount: number): void;
  onPosted(
    round: ActiveRound,
    call: 'up' | 'down',
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
    maxConcurrency?: number;
    platform?: AgentPlatform;
  } = {},
): (rounds: ActiveRound[]) => Promise<void> {
  const { maxConcurrency = 1, platform } = options;
  const handler = async (rounds: ActiveRound[]): Promise<void> => {
    let filteredRounds = rounds;
    // don't processed more than 50% of the rounds to save api cost
    const maxProcessRound = rounds.length / 2;
    if (maxProcessRound > 0) {
      reporter.onScreenStart?.();
      filteredRounds = await screenMegathreadRounds(runtime, rounds, { limit: maxProcessRound });
      reporter.onScreenResult?.(filteredRounds, rounds.length);
    }

    const chunks = _.chunk(filteredRounds, maxConcurrency);
    for (const chunk of chunks) {
      const promises: ReturnType<typeof run>[] = [];
      // obtain fresh instance of agent as memory of agent might change from each round processed
      const agent = getAgent();
      for (const round of chunk) {
        promises.push(run({ round, runtime, reporter, recentComments: agent.recentComments }));
      }

      const results = await Promise.allSettled(promises);

      const payload: BatchCreateMegathreadCommentDto = { comments: [], metadata: { platform } };
      for (let i = 0; i < results.length; i++) {
        const round = chunk[i];
        const result = results[i];
        if (result.status === 'rejected') {
          const raw = extractErrorMessage(result.reason);
          const message = raw.length > 120 ? raw.slice(0, 120) + '\u2026' : raw;
          reporter.onError(round, message);
          continue;
        }

        const data = result.value;
        if (!data.summary) {
          continue;
        }

        payload.comments.push({
          call: data.call,
          roundId: round.roundId,
          text: data.summary,
        });
      }

      if (payload.comments.length > 0) {
        await agent.postBatchMegathreadComments(payload).catch((e) => console.log(e));
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
