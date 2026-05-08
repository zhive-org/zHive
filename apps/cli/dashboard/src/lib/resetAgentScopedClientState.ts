import type { QueryClient } from '@tanstack/react-query';
import { priceBufferStore } from './priceBufferStore';
import { resetHyperliquidClients } from './hyperliquid';

/**
 * Single agent-boundary reset entry point for the SPA. Folds in every piece
 * of module-level (or query-cached) state tied to the previous agent's
 * symbols, prices, and config.
 *
 * If a new piece of agent-scoped client state appears (e.g. another singleton
 * store, another long-lived query), wire its reset in here — not at the call
 * site. Forgetting one half is the original bug this function exists to
 * prevent.
 */
export function resetAgentScopedClientState(queryClient: QueryClient): void {
  priceBufferStore.clearAll();
  resetHyperliquidClients();
  queryClient.invalidateQueries({ queryKey: ['events'] });
  queryClient.invalidateQueries({ queryKey: ['agent-profile'] });
}
