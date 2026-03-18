import {
  Conviction,
  getMemoryLineCount,
  loadMemory,
  MEMORY_SOFT_LIMIT,
  saveMemory,
} from '@zhive/sdk';
import * as ai from 'ai';
import { z } from 'zod';
import { getModel, getScreenModel } from '../config/ai-providers.js';
import { AgentRuntime } from './runtime.js';
import type { ChatMessage } from './prompts/chat-prompt.js';
import { buildMemoryExtractionPrompt } from './prompts/memory-prompt.js';
import { extractErrorMessage, stripCodeFences } from './utils.js';
import { wrapAISDK } from 'langsmith/experimental/vercel';
import { type SystemModelMessage } from 'ai';
import { buildScreenPrompt } from './prompts/prompt.js';
import {
  buildMegathreadInputPrompt,
  BuildMegathreadPromptOptions,
  buildMegathreadSystemPrompt,
} from './prompts/megathread.js';
import {
  getExecuteSkillTool,
  clearSubagentUsage,
  getSubagentUsage,
  type SubagentUsage,
} from './tools/index.js';
import { cacheableSystem } from './cache.js';

const { ToolLoopAgent, generateText, generateObject, Output } = wrapAISDK(ai);

export type { SubagentUsage };

// ─── Screen Schema (Quick Engage Check) ─────────────

const screenSchema = z.object({
  engage: z.boolean().describe('true to analyze, false to skip'),
});

export interface ScreenResult {
  engage: boolean;
  usage: TokenUsage;
}

// ─── Prediction Schema ──────────────────────────────

const megathreadPredictionSchema = z.object({
  summary: z
    .string()
    .min(1)
    .max(300)
    .nullable()
    .describe(
      'Your CT-style take on this project. Short, punchy, in character. Think tweet, not essay. null if skipping.',
    ),
  conviction: z
    .number()
    .nullable()
    .describe(
      'Predicted percent price change over the conviction window described in your instructions, up to two decimal places. Use the FULL range based on catalyst strength: routine ±0.1-1.0, moderate ±1.5-5.0, strong ±5.0-12.0, extreme ±12.0-25.0. Negative for bearish. NEVER use 0 — always commit to a directional lean, even if small (e.g. ±0.1). null if skipping. VARY your predictions — do NOT default to the same number repeatedly.',
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

// ─── Quick Screen (Cheap Engage Check) ──────────────

export async function screenMegathreadRound(
  projectId: string,
  strategyContent: string,
): Promise<ScreenResult> {
  try {
    const { system, prompt } = buildScreenPrompt(strategyContent, {
      projectId,
    });

    const model = await getScreenModel();
    const res = await generateObject({
      model,
      messages: [cacheableSystem(system), { role: 'user' as const, content: prompt }],
      schema: screenSchema,
    });

    const usage: TokenUsage = {
      inputTokens: res.usage?.inputTokens ?? 0,
      outputTokens: res.usage?.outputTokens ?? 0,
      cacheReadTokens: res.usage?.inputTokenDetails?.cacheReadTokens ?? 0,
      cacheWriteTokens: res.usage?.inputTokenDetails?.cacheWriteTokens ?? 0,
      toolCalls: 0,
      toolNames: [],
      toolResults: [],
    };

    return { engage: res.object.engage, usage };
  } catch (err: unknown) {
    const emptyUsage: TokenUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      toolCalls: 0,
      toolNames: [],
      toolResults: [],
    };
    return { engage: true, usage: emptyUsage };
  }
}

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
}): Promise<{ skip: boolean; summary: string; conviction: Conviction; usage: TokenUsage }> {
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
    return { skip: true, summary: '', conviction: 0, usage };
  }

  const prediction = output as MegathreadPrediction;

  if (prediction.summary === null || prediction.conviction === null) {
    return { skip: true, summary: '', conviction: 0, usage };
  }

  return { skip: false, summary: prediction.summary, conviction: prediction.conviction, usage };
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
