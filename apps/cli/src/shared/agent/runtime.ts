import { loadMemory } from '@zhive/sdk';
import { LanguageModel, Tool } from 'ai';
import { AgentConfig, loadAgentConfig } from '../config/agent';
import { getModel } from '../config/ai-providers';
import { SkillDefinition } from './skills/types';
import { getAllTools, getExecuteSkillTool, initializeSkills } from './tools/index';

export interface AgentRuntime {
  config: AgentConfig;
  memory: string;
  /** Base tools (market_*, mindshare_*). executeSkill tool is added dynamically when model is available. */
  tools: Record<string, Tool>;
  skills: Map<string, SkillDefinition>;
  model: LanguageModel;
}

export async function initializeAgentRuntime(agentDir?: string): Promise<AgentRuntime> {
  const config = await loadAgentConfig(agentDir);
  const memory = await loadMemory(agentDir);
  const model = await getModel();

  const skillRegistry = await initializeSkills(agentDir);
  const tools = getAllTools();
  const executeSkillTool = getExecuteSkillTool(skillRegistry, model);
  const allTools = { ...tools, executeSkillTool };

  const runtime: AgentRuntime = { config, memory, tools: allTools, skills: skillRegistry, model };
  return runtime;
}
