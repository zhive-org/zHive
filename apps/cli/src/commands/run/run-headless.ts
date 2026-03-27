import { HiveAgent } from '@zhive/sdk';
import type { ActiveRound } from '@zhive/sdk';
import type { TokenUsage } from '../../shared/agent/analysis';
import { HIVE_API_URL, HIVE_FRONTEND_URL } from '../../shared/config/constant';
import { resolveModelInfo } from '../../shared/config/ai-providers';
import { formatTimeLeft, formatTokenCount, formatTokenUsage } from '../../shared/agent/utils';
import { initializeAgentRuntime } from '../../shared/agent/runtime';
import { createMegathreadRoundHandler, MegathreadReporter } from '../../shared/agent/handler';

function formatUsageLine(usage: TokenUsage): string {
  const { input, output, tools } = formatTokenUsage(usage);
  const toolSuffix = tools !== null ? ` \u00b7 ${tools}` : '';
  const line = `  ${input} \u00b7 ${output}${toolSuffix}`;
  return line;
}

function timestamp(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ts = `${hours}:${minutes}:${seconds}`;
  return ts;
}

export async function runHeadless(): Promise<void> {
  const runtime = await initializeAgentRuntime();
  const { config } = runtime;

  let predictionCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalToolCalls = 0;

  const consoleReporter: MegathreadReporter = {
    onRoundStart(round: ActiveRound, timeframe: string): void {
      console.log(`[${timestamp()}] megathread c/${round.projectId} · ${timeframe} round`);
    },
    onPriceInfo(
      _round: ActiveRound,
      priceAtStart: number,
      currentPrice?: number,
      timeLeftMs?: number,
    ): void {
      const timeLeftStr = timeLeftMs !== undefined ? formatTimeLeft(timeLeftMs) : '';
      const timeSuffix = timeLeftStr ? ` · ${timeLeftStr} left` : '';
      if (currentPrice !== undefined) {
        const changePercent = ((currentPrice - priceAtStart) / priceAtStart) * 100;
        const sign = changePercent >= 0 ? '+' : '';
        console.log(
          `  start: $${priceAtStart} → current: $${currentPrice} (${sign}${changePercent.toFixed(2)}%)${timeSuffix}`,
        );
      } else {
        console.log(`  start: $${priceAtStart}${timeSuffix}`);
      }
    },
    onScreenResult(rounds, totalRounds): void {
      console.log(`[${timestamp()}] screen. process ${rounds.length} out of ${totalRounds}`);
    },
    onResearching(projectId: string): void {
      console.log(`[${timestamp()}] researching c/${projectId}...`);
    },
    onToolsUsed(toolNames: string[], callCount: number): void {
      if (callCount > 0) {
        console.log(`  tools: ${toolNames.join(', ')} (${callCount} calls)`);
      } else {
        console.log(`  tools: none`);
      }
    },
    onPosted(
      round: ActiveRound,
      conviction: number,
      summary: string,
      timeframe: string,
      usage: TokenUsage,
    ): void {
      predictionCount += 1;
      totalInputTokens += usage.inputTokens;
      totalOutputTokens += usage.outputTokens;
      totalToolCalls += usage.toolCalls;

      const sign = conviction >= 0 ? '+' : '';
      console.log(
        `[${timestamp()}] megathread c/${round.projectId} [${sign}${conviction}%] "${summary}" (${predictionCount} total)`,
      );
      console.log(formatUsageLine(usage));

      const url = `${HIVE_FRONTEND_URL}/c/${round.projectId}/megathread/${timeframe}`;
      console.log(`  ${url}`);
    },
    onError(round: ActiveRound, message: string): void {
      console.error(`[${timestamp()}] error c/${round.projectId}: ${message}`);
    },
  };

  // eslint-disable-next-line prefer-const
  let agent: HiveAgent;
  const roundHandler = createMegathreadRoundHandler(() => agent, runtime, consoleReporter);

  agent = new HiveAgent(HIVE_API_URL, {
    name: config.name,
    avatarUrl: config.avatarUrl,
    bio: config.bio ?? undefined,
    agentProfile: config.agentProfile,
    onPollEmpty: () => {
      console.log(`[${timestamp()}] idle — no new rounds`);
    },
    onNewMegathreadRound: roundHandler,
  });

  const shutdown = async (): Promise<void> => {
    console.log(`[${config.name}] shutting down...`);
    const sessionTotal = totalInputTokens + totalOutputTokens;
    const toolInfo = totalToolCalls > 0 ? ` \u00b7 ${totalToolCalls} tool calls` : '';
    console.log(
      `[${config.name}] session — input: ${formatTokenCount(totalInputTokens)} \u00b7 output: ${formatTokenCount(totalOutputTokens)} (${formatTokenCount(sessionTotal)} total)${toolInfo}`,
    );
    await agent.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  await agent.start();

  const modelInfoResult = resolveModelInfo();
  console.log(`[${config.name}] ${modelInfoResult.modelId} \u00d7 zData`);

  const { agentProfile } = config;
  const sectorsDisplay = agentProfile.sectors.length > 0 ? agentProfile.sectors.join(', ') : 'all';
  const timeframesDisplay = agentProfile.timeframes.join(', ');
  console.log(
    `[${config.name}] sectors: ${sectorsDisplay} \u00b7 timeframes: ${timeframesDisplay}`,
  );

  console.log(`[${config.name}] agent online \u2014 "${config.bio ?? ''}"`);
}
