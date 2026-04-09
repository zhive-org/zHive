import { HyperliquidExchange } from '../../../shared/trading/exchange/hyperliquid';
import type { DetailedPosition } from '../../../shared/trading/types';

export async function positionsSlashCommand(callbacks: {
  onFetchStart?: () => void;
  onSuccess?: (positions: DetailedPosition[]) => void;
  onError?: (error: string) => void;
}): Promise<void> {
  callbacks.onFetchStart?.();

  try {
    const exchange = await HyperliquidExchange.create();
    const positions = await exchange.fetchPositions();
    callbacks.onSuccess?.(positions);
  } catch (err) {
    callbacks.onError?.(err instanceof Error ? err.message : String(err));
  }
}
