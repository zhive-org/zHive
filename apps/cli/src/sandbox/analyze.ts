#!/usr/bin/env npx tsx
/**
 * Manual megathread analysis script.
 *
 * Usage (from an agent directory with SOUL.md):
 *   npx tsx scripts/analyze.ts --project bitcoin
 *
 * Or from the hive-cli package root:
 *   npx tsx scripts/analyze.ts --project bitcoin --agent ~/.zhive/agents/my-agent
 */

import { config as dotenvConfig } from 'dotenv';
import path, { join } from 'path';
import { getHiveDir } from '../shared/config/constant.js';
import {
  fetchPrice,
  fetchRoundPrices,
  initializeAgentRuntime,
} from '../shared/agent/agent-runtime.js';
import { processMegathreadRound } from '../shared/agent/analysis.js';
import { extractErrorMessage } from '../shared/agent/utils.js';

interface AnalyzeOptions {
  text: string;
  projectId: string;
  agentDir: string;
}

function timestamp(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

async function main(): Promise<void> {
  const agentName = 'a17z';
  const agentDir = path.join(getHiveDir(), 'agents', agentName);
  dotenvConfig({ override: true, path: agentDir ? join(agentDir, '.env') : undefined });
  const runtime = await initializeAgentRuntime(agentDir);
  console.log('LANGSMITH_TRACING=', process.env.LANGSMITH_TRACING);

  console.log(`[${timestamp()}] Agent: ${agentName}`);
  console.log(`[${timestamp()}] Directory: ${agentDir}`);
  console.log(`[${timestamp()}] Analyzing...`);
  console.log('');

  const projectId = 'ethereum';
  const HOUR = 60 * 60 * 1000;
  const durationMs = 4 * HOUR; // 3h round
  const roundStartTimestamp = new Date(new Date().getTime() - durationMs).toISOString();
  const executeTime = new Date(new Date().getTime() - HOUR).toISOString();
  const currentTime = new Date().toISOString();

  const { priceAtStart, currentPrice: executePrice } = await fetchRoundPrices(
    projectId,
    roundStartTimestamp,
    executeTime,
  );
  const currentPrice = await fetchPrice(projectId, currentTime);

  console.log(`[${timestamp()}] Price at round start: $${priceAtStart?.toFixed(2)}`);
  console.log(`[${timestamp()}] Execute price: $${executePrice?.toFixed(2)}`);
  console.log(`[${timestamp()}] Current price ${currentPrice?.toFixed(2)}`);

  try {
    const startTime = Date.now();
    const result = await processMegathreadRound({
      projectId,
      durationMs,
      recentComments: [],
      agentRuntime: runtime,
      priceAtStart,
      currentPrice: executePrice,
      currentTime: new Date(executeTime),
    });
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('─'.repeat(50));
    console.log(`Result (${elapsed}s):`);
    console.log('─'.repeat(50));

    if (result.skip) {
      console.log('  Skip: true (outside expertise)');
    } else {
      const sign = result.conviction >= 0 ? '+' : '';

      const actual =
        currentPrice !== undefined && priceAtStart !== undefined
          ? ((currentPrice - priceAtStart) / priceAtStart) * 100
          : undefined;
      const getSign = (num: number): string => (num > 0 ? '+' : '');
      console.log(`  Skip: false`);
      console.log(`  Conviction: ${sign}${result.conviction}%`);
      console.log(`  Actual move: ${getSign(actual ?? 0)}${actual?.toFixed(2) ?? 'N/A'}`);
      console.log(`  Summary: "${result.summary}"`);
    }

    console.log('─'.repeat(50));
  } catch (err: unknown) {
    const raw = extractErrorMessage(err);
    console.error(`[${timestamp()}] Error: ${raw}`);
    process.exit(1);
  }
}

main();
