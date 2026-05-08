import { loadMemory, MarketInterval } from '@zhive/sdk';
import { LanguageModel, Tool } from 'ai';
import { AgentConfig, loadAgentConfig } from '../config/agent';
import { getModel } from '../config/ai-providers';
import { SkillDefinition } from './skills/types';
import { createExecuteSkillTool } from '../tools/execute-skill';
import { loadSkill } from './skills';
import { loadSkills } from './skills/loader';
import { marketTools } from '../tools/market';
import { createPineScriptTool } from '../tools/pinescript';
import { getHiveClient } from '../config/hive-client';
import { mindshareTools } from '../tools/mindshare';
import { convertTimeframeToInterval, getOHLC } from '../ta/service';
import { HiveDataProvider } from '../tools/pinescript/providers/zhive/provider';

export interface AgentRuntime {
  config: AgentConfig;
  memory: string;
  /** Base tools (market_*, mindshare_*). executeSkill tool is added dynamically when model is available. */
  tools: Record<string, Tool>;
  skills: Map<string, SkillDefinition>;
  model: LanguageModel;
}

export async function initializeAgentRuntime(agentDir?: string): Promise<AgentRuntime> {
  // Parallelize independent I/O: config + memory don't depend on each other,
  // and once we have neither, model loading + skill discovery + tool building
  // all run in parallel too. Trims ~hundreds of ms off the boot path.
  const [config, memory] = await Promise.all([loadAgentConfig(agentDir), loadMemory(agentDir)]);
  const [model, skillRegistry] = await Promise.all([getModel(), loadSkills(agentDir)]);

  const tools = createBuiltinTools();
  const executeSkillTool = createExecuteSkillTool(skillRegistry, {
    model,
    tools,
  });
  const allTools = { ...tools, executeSkillTool };

  const runtime: AgentRuntime = { config, memory, tools: allTools, skills: skillRegistry, model };
  return runtime;
}

export function createBuiltinTools(): Record<string, Tool> {
  const tools: Record<string, Tool> = {};

  if (process.env.EXPERIMENTAL_FETCH_RULES_TOOL === 'true') {
    const provider = new HiveDataProvider(getHiveClient());
    const pinescriptTools = createPineScriptTool(provider, ['60', 'D']);
    tools['market_executePinescript'] = pinescriptTools;
  } else {
    for (const [name, tool] of Object.entries(marketTools)) {
      const namespacedName = `market_${name}`;
      tools[namespacedName] = tool;
    }
  }

  for (const [name, tool] of Object.entries(mindshareTools)) {
    const namespacedName = `mindshare_${name}`;
    tools[namespacedName] = tool;
  }

  return tools;
}
