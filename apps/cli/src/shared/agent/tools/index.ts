import * as path from 'node:path';
import type { Tool, LanguageModel } from 'ai';
import type { SkillDefinition } from '../skills/types';
import { discoverSkills } from '../skills/skill-parser';
import { marketTools } from './market/index';
import { mindshareTools } from './mindshare/index';
import {
  createExecuteSkillTool,
  clearSubagentUsage,
  getSubagentUsage,
  type SubagentUsage,
  type SubagentConfig,
  type ExecuteSkillToolConfig,
} from './execute-skill-tool';
import { experimentalMarketTools } from './market/tools';

export type { SkillDefinition, SkillMetadata } from '../skills/types';
export type { SubagentUsage, SubagentConfig, ExecuteSkillToolConfig };
export { clearSubagentUsage, getSubagentUsage };

/**
 * Get all tools that are always available to agents.
 * Tools are bundled with the CLI and don't require skill installation.
 * Skills provide knowledge/guidance on when and how to use these tools.
 */
export function getAllTools(): Record<string, Tool> {
  const tools: Record<string, Tool> = {};

  const selectedMarketTool =
    process.env.EXPERIMENTAL_MARKET_TOOLS === 'true' ? experimentalMarketTools : marketTools;
  for (const [name, tool] of Object.entries(selectedMarketTool)) {
    const namespacedName = `market_${name}`;
    tools[namespacedName] = tool;
  }

  for (const [name, tool] of Object.entries(mindshareTools)) {
    const namespacedName = `mindshare_${name}`;
    tools[namespacedName] = tool;
  }

  return tools;
}

/**
 * Initialize skills from agent's skills/ directory.
 * Skills are knowledge-only documents that help agents understand
 * when and how to use the always-available tools.
 * Returns a registry map that should be passed to other skill functions.
 */
export async function initializeSkills(agentPath?: string): Promise<Map<string, SkillDefinition>> {
  const skillRegistry: Map<string, SkillDefinition> = new Map();

  const skillsPath = path.join(agentPath ?? process.cwd(), 'skills');
  const agentSkills = await discoverSkills(skillsPath);

  for (const skill of agentSkills) {
    skillRegistry.set(skill.id, skill);
  }

  return skillRegistry;
}

/**
 * Get a skill metadata list for prompt injection.
 * Shows skill ID, description, and compatibility to help the agent decide what to use.
 */
export function getSkillMetadataList(skillRegistry: Map<string, SkillDefinition>): string {
  if (skillRegistry.size === 0) {
    return '';
  }

  const entries = Array.from(skillRegistry.values()).map((s) => {
    const lines = [`### ${s.id}`, s.metadata.description];
    if (s.metadata.compatibility) {
      lines.push(`**Compatibility:** ${s.metadata.compatibility}`);
    }
    const entry = lines.join('\n');
    return entry;
  });

  const output = `Available skills:\n\n${entries.join('\n\n')}`;
  return output;
}

/**
 * Get the executeSkill tool for running skills as subagents.
 * The subagent uses the skill's body as instructions and has access to all tools.
 */
export function getExecuteSkillTool(
  skillRegistry: Map<string, SkillDefinition>,
  model: LanguageModel,
  subagentConfig?: Partial<SubagentConfig>,
): Tool {
  const config: ExecuteSkillToolConfig = {
    model,
    subagentConfig,
  };
  const executeSkillTool = createExecuteSkillTool(skillRegistry, config);
  return executeSkillTool;
}

/**
 * Get a skill definition by ID.
 */
export function getSkill(
  skillRegistry: Map<string, SkillDefinition>,
  id: string,
): SkillDefinition | undefined {
  return skillRegistry.get(id);
}

/**
 * Get all registered skills.
 */
export function getAllSkills(skillRegistry: Map<string, SkillDefinition>): SkillDefinition[] {
  return Array.from(skillRegistry.values());
}

/**
 * Check if any skills are registered.
 */
export function hasSkills(skillRegistry: Map<string, SkillDefinition>): boolean {
  return skillRegistry.size > 0;
}
