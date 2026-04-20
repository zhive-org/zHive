import type { SlashCommandCallbacks } from '../services/command-registry';
import type { AgentRuntime } from '../../../shared/agent';
import { loadConfig, loadMemory } from '@zhive/sdk';

export const memorySlashCommand = async (
  _runtime: AgentRuntime,
  callbacks?: SlashCommandCallbacks,
) => {
  const memory = await loadMemory();
  callbacks?.onMessage?.(memory || 'No memory stored yet.');
};
