import { HttpTransport, InfoClient } from '@nktkas/hyperliquid';
import { HyperliquidMarketService } from '../../../shared/trading/market';
import type { DetailedPosition } from '../../../shared/trading/types';

export async function positionsSlashCommand(callbacks: {
  onFetchStart?: () => void;
  onSuccess?: (positions: DetailedPosition[]) => void;
  onError?: (error: string) => void;
}): Promise<void> {
  const address = process.env.WALLET_ADDRESS as `0x${string}` | undefined;
  if (!address) {
    callbacks.onError?.('WALLET_ADDRESS env var not set');
    return;
  }

  callbacks.onFetchStart?.();

  try {
    const transport = new HttpTransport({ isTestnet: true });
    const info = new InfoClient({ transport });
    const market = new HyperliquidMarketService(info);
    const positions = await market.fetchPositions(address);
    callbacks.onSuccess?.(positions);
  } catch (err) {
    callbacks.onError?.(err instanceof Error ? err.message : String(err));
  }
}
