import { loadAgentConfig } from '../../../shared/config/agent';
import { ZhiveExchange } from '../../../shared/trading/exchange/zhive';
import type { SlashCommandCallbacks } from '../services/command-registry';
import type { AgentRuntime } from '../../../shared/agent';

export async function positionsSlashCommand(
  _: AgentRuntime,
  callbacks?: SlashCommandCallbacks,
): Promise<void> {
  callbacks?.onMessage?.('Fetching positions...');

  const config = await loadAgentConfig();
  const exchange = await ZhiveExchange.create({
    apiKey: config.apiKey,
  });
  const positions = await exchange.fetchPositions();
  callbacks?.onOverlayOpen?.({ type: 'positions', positions });
}
