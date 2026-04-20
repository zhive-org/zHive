import type { SlashCommandCallbacks } from '../services/command-registry';
import type { AgentRuntime } from '../../../shared/agent';

export async function watchlistSlashCommand(
  runtime: AgentRuntime,
  callbacks?: SlashCommandCallbacks,
): Promise<void> {
  callbacks?.onOverlayOpen?.({
    type: 'watchlist',
    currentWatchlist: runtime.config.watchList,
    agentDir: runtime.config.dir,
  });
}
