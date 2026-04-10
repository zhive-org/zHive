import { initializeAgentRuntime } from '../../../shared/agent';
import { loadAgentConfig } from '../../../shared/config/agent';
import { ZhiveExchange } from '../../../shared/trading/exchange/zhive';
import type { DetailedPosition } from '../../../shared/trading/types';

export async function positionsSlashCommand(callbacks: {
  onFetchStart?: () => void;
  onSuccess?: (positions: DetailedPosition[]) => void;
  onError?: (error: string) => void;
}): Promise<void> {
  callbacks.onFetchStart?.();

  try {
    const config = await loadAgentConfig();
    const exchange = await ZhiveExchange.create({
      apiKey: config.apiKey,
    });
    const positions = await exchange.fetchPositions();
    callbacks.onSuccess?.(positions);
  } catch (err) {
    callbacks.onError?.(err instanceof Error ? err.message : String(err));
  }
}
