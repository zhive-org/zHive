import {
  getMemoryLineCount,
  loadMemory,
  MEMORY_SOFT_LIMIT,
  saveMemory,
} from '@zhive/sdk';
import * as ai from 'ai';
import { wrapAISDK } from 'langsmith/experimental/vercel';
import { z } from 'zod';
import { getModel } from '../config/ai-providers';
import { cacheableSystem } from './cache';
import type { ChatMessage } from './prompts/chat-prompt';
import {
  buildMegathreadInputPrompt,
  BuildMegathreadPromptOptions,
  buildMegathreadSystemPrompt,
} from './prompts/megathread';
import { buildMemoryExtractionPrompt } from './prompts/memory-prompt';
import { AgentRuntime } from './runtime';
import { clearSubagentUsage, getSubagentUsage, type SubagentUsage } from './tools/index';
import { extractErrorMessage, stripCodeFences } from './utils';

const { ToolLoopAgent, generateText, Output } = wrapAISDK(ai);

export type { SubagentUsage };

// ─── Prediction Schema ──────────────────────────────

const megathreadPredictionSchema = z.object({
  summary: z
    .string()
    .nullable()
    .describe(
      'Your take on this project, written in first person AS your character. NEVER write in third person (e.g. "agent predicts X"). Write like a tweet: short, punchy, opinionated. Include your reasoning — why you are bullish or bearish. null if skipping. (Maximum 300 character)',
    ),
  call: z
    .enum(['up', 'down'])
    .nullable()
    .describe(
      'Your directional call: "up" if price will be above round-start price at round end, "down" if below. null if skipping.',
    ),
});

// ─── Token Usage ────────────────────────────────────

export interface ToolResult {
  toolName: string;
  result: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  toolCalls: number;
  toolNames: string[];
  toolResults: ToolResult[];
  /** Usage from subagent executions (skill subagents) */
  subagentUsage?: SubagentUsage[];
}

interface AgentResult {
  totalUsage: {
    inputTokens?: number;
    outputTokens?: number;
    inputTokenDetails?: {
      cacheReadTokens?: number;
      cacheWriteTokens?: number;
    };
  };
  steps: Array<{
    toolCalls: Array<{ toolName: string }>;
    toolResults: Array<{ toolName: string; output: unknown }>;
  }>;
}

function buildUsage(res: AgentResult): TokenUsage {
  const toolCalls = res.steps.flatMap((s) => s.toolCalls);
  const toolNames = toolCalls.map((tc) => tc.toolName);
  const toolResults = res.steps
    .flatMap((s) => s.toolResults)
    .map((tr) => ({
      toolName: tr.toolName,
      result: String(tr.output),
    }));
  const usage: TokenUsage = {
    inputTokens: res.totalUsage.inputTokens ?? 0,
    outputTokens: res.totalUsage.outputTokens ?? 0,
    cacheReadTokens: res.totalUsage.inputTokenDetails?.cacheReadTokens ?? 0,
    cacheWriteTokens: res.totalUsage.inputTokenDetails?.cacheWriteTokens ?? 0,
    toolCalls: toolCalls.length,
    toolNames,
    toolResults,
  };
  return usage;
}

type MegathreadPrediction = z.infer<typeof megathreadPredictionSchema>;

// ─── Megathread Round Analysis ──────────────────────

export async function processMegathreadRound({
  projectId,
  durationMs,
  recentComments,
  agentRuntime,
  priceAtStart,
  currentTime,
  currentPrice,
}: {
  projectId: string;
  durationMs: number;
  agentRuntime: AgentRuntime;
  recentComments: readonly string[];
  priceAtStart?: number;
  currentPrice?: number;
  currentTime?: Date;
}): Promise<{ summary: string; call: 'up' | 'down'; usage: TokenUsage }> {
  const promptOptions: BuildMegathreadPromptOptions = {
    projectId,
    durationMs,
    priceAtStart,
    currentPrice,
    recentPosts: recentComments,
    currentTime: currentTime ?? new Date(),
  };
  const systemPrompt = buildMegathreadSystemPrompt(agentRuntime);
  const prompt = buildMegathreadInputPrompt(agentRuntime, promptOptions);

  // ── Clear subagent usage tracking ──
  clearSubagentUsage();

  const agent = new ToolLoopAgent({
    model: agentRuntime.model,
    instructions: cacheableSystem(systemPrompt),
    output: Output.object({ schema: megathreadPredictionSchema }),
    tools: agentRuntime.tools,
  });

  const res = await agent.generate({ prompt });

  // ── Build usage with subagent tracking ──
  const usage = buildUsage(res);
  const subagentUsage = getSubagentUsage();

  if (subagentUsage.length > 0) {
    usage.subagentUsage = subagentUsage;

    // Aggregate subagent tokens into total
    for (const sub of subagentUsage) {
      usage.inputTokens += sub.inputTokens;
      usage.outputTokens += sub.outputTokens;
      usage.cacheReadTokens += sub.cacheReadTokens;
      usage.cacheWriteTokens += sub.cacheWriteTokens;
    }
  }

  const { output } = res;
  if (!output) {
    return { summary: '', call: 'up', usage };
  }

  const prediction = output as MegathreadPrediction;

  if (prediction.summary === null || prediction.call === null) {
    return { summary: '', call: 'up', usage };
  }

  return { summary: prediction.summary, call: prediction.call, usage };
}

// ─── Memory Extraction ──────────────────────────────

export async function extractAndSaveMemory(sessionMessages: ChatMessage[]): Promise<string | null> {
  const currentMemory = await loadMemory();
  const lineCount = getMemoryLineCount(currentMemory);

  if (sessionMessages.length === 0 && lineCount <= MEMORY_SOFT_LIMIT) {
    return null;
  }

  const prompt = buildMemoryExtractionPrompt({
    currentMemory,
    sessionMessages,
    lineCount,
  });

  try {
    const model = await getModel();
    const { text } = await generateText({
      model,
      messages: [cacheableSystem(prompt.system), { role: 'user' as const, content: prompt.prompt }],
    });
    const cleaned = stripCodeFences(text);
    await saveMemory(cleaned);
    return cleaned;
  } catch (err: unknown) {
    const raw = extractErrorMessage(err);
    console.error(`[Memory] Failed to extract memory: ${raw.slice(0, 200)}`);
    return null;
  }
}
