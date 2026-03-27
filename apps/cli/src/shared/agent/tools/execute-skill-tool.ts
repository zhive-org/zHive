import { tool, type Tool, LanguageModel } from 'ai';
import * as ai from 'ai';
import { z } from 'zod';
import { wrapAISDK } from 'langsmith/experimental/vercel';
import type { SkillDefinition } from '../skills/types';
import { getAllTools } from './index';
import { cacheableSystem } from '../cache';

const { ToolLoopAgent } = wrapAISDK(ai);

// ─── Subagent Usage Tracking ──────────────────────────

export interface SubagentUsage {
  skillId: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  toolCalls: number;
  toolNames: string[];
}

let _subagentUsageLog: SubagentUsage[] = [];

export function clearSubagentUsage(): void {
  _subagentUsageLog = [];
}

export function getSubagentUsage(): SubagentUsage[] {
  return [..._subagentUsageLog];
}

function logSubagentUsage(usage: SubagentUsage): void {
  _subagentUsageLog.push(usage);
}

// ─── Subagent Configuration ───────────────────────────

export interface SubagentConfig {
  maxOutputTokens: number;
  timeoutMs: number;
}

const DEFAULT_SUBAGENT_CONFIG: SubagentConfig = {
  maxOutputTokens: 2048,
  timeoutMs: 60_000, // 1 minute
};

// ─── Input Schema ─────────────────────────────────────

const skillExecutionInputSchema = z.object({
  skillId: z.string().describe('The skill ID to execute'),
  task: z.string().describe('The task/instructions for the subagent to perform'),
  context: z.string().optional().describe('Additional context (e.g., project ID, data)'),
});

// ─── System Prompt Template ───────────────────────────

function buildSubagentSystemPrompt(skill: SkillDefinition): string {
  const systemPrompt = `You are a specialized agent with the following expertise:

${skill.body}

Use your expertise and available tools to complete the task given to you.`;

  return systemPrompt;
}

// ─── Execute Skill Tool Factory ───────────────────────

export interface ExecuteSkillToolConfig {
  model: LanguageModel;
  subagentConfig?: Partial<SubagentConfig>;
}

/**
 * Create a tool that executes a skill as a subagent.
 * The subagent has access to all tools and uses the skill's body as instructions.
 * Returns the subagent's freeform text analysis.
 */
export function createExecuteSkillTool(
  skillRegistry: Map<string, SkillDefinition>,
  config: ExecuteSkillToolConfig,
): Tool {
  const subagentConfig: SubagentConfig = {
    ...DEFAULT_SUBAGENT_CONFIG,
    ...config.subagentConfig,
  };

  const executeSkillTool = tool({
    description:
      "Execute a skill as a specialized subagent to perform analysis. The subagent has access to tools and uses the skill's expertise to analyze the project. Returns the subagent's analysis as text.",
    inputSchema: skillExecutionInputSchema,
    execute: async ({ skillId, task, context }) => {
      const skill = skillRegistry.get(skillId);

      // ── Handle skill not found ──
      if (skill === undefined) {
        const availableIds = Array.from(skillRegistry.keys());
        if (availableIds.length === 0) {
          return `Error: Skill "${skillId}" not found. No skills are currently available.`;
        }
        const idList = availableIds.join(', ');
        return `Error: Skill "${skillId}" not found. Available skills: ${idList}`;
      }

      // ── Handle empty skill body ──
      if (!skill.body || skill.body.trim().length === 0) {
        return `Error: Skill "${skillId}" has no instructions. Cannot execute.`;
      }

      // ── Build subagent ──
      const systemPrompt = buildSubagentSystemPrompt(skill);
      const tools = getAllTools();

      const userPrompt = context
        ? `${task}\n\nContext: ${context}\n\nCurrent Time: ${new Date().toISOString()}`
        : task;

      try {
        // ── Run subagent with timeout ──
        const subagentPromise = runSubagent({
          model: config.model,
          systemPrompt,
          userPrompt,
          tools,
          maxOutputTokens: subagentConfig.maxOutputTokens,
        });

        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Subagent execution timed out after ${subagentConfig.timeoutMs}ms`));
          }, subagentConfig.timeoutMs);
        });

        const result = await Promise.race([subagentPromise, timeoutPromise]);

        // ── Log usage ──
        logSubagentUsage({
          skillId,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          cacheReadTokens: result.usage.cacheReadTokens,
          cacheWriteTokens: result.usage.cacheWriteTokens,
          toolCalls: result.usage.toolCalls,
          toolNames: result.usage.toolNames,
        });

        // ── Format output ──
        if (!result.text || result.text.trim().length === 0) {
          return `## ${skill.metadata.name} Analysis\n\nNo analysis produced by subagent.`;
        }

        const output = `## ${skill.metadata.name} Analysis\n\n${result.text}`;
        return output;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return `Error executing skill "${skillId}": ${message}`;
      }
    },
  });

  return executeSkillTool;
}

// ─── Subagent Runner ──────────────────────────────────

interface SubagentResult {
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    toolCalls: number;
    toolNames: string[];
  };
}

async function runSubagent({
  model,
  systemPrompt,
  userPrompt,
  tools,
  maxOutputTokens,
}: {
  model: LanguageModel;
  systemPrompt: string;
  userPrompt: string;
  tools: Record<string, Tool>;
  maxOutputTokens: number;
}): Promise<SubagentResult> {
  const agent = new ToolLoopAgent({
    model,
    instructions: cacheableSystem(systemPrompt),
    tools,
    maxOutputTokens,
  });

  const res = await agent.generate({ prompt: userPrompt });

  // ── Extract usage ──
  const toolCalls = res.steps.flatMap(
    (s: { toolCalls: Array<{ toolName: string }> }) => s.toolCalls,
  );
  const toolNames = toolCalls.map((tc: { toolName: string }) => tc.toolName);

  const usage = {
    inputTokens: res.totalUsage?.inputTokens ?? 0,
    outputTokens: res.totalUsage?.outputTokens ?? 0,
    cacheReadTokens: res.totalUsage?.inputTokenDetails?.cacheReadTokens ?? 0,
    cacheWriteTokens: res.totalUsage?.inputTokenDetails?.cacheWriteTokens ?? 0,
    toolCalls: toolCalls.length,
    toolNames,
  };

  const result: SubagentResult = {
    text: res.text ?? '',
    usage,
  };

  return result;
}
