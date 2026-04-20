import { AgentRuntime } from '../../../shared/agent';
import { SlashCommandCallbacks } from '../services/command-registry';

export const clearSlashCommand = (_: AgentRuntime, callbacks?: SlashCommandCallbacks) => {
  callbacks?.onClear?.();
};
