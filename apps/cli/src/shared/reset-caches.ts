import { resetModelCache } from './config/ai-providers';
import { resetHiveClient } from './config/hive-client';
import { resetBacktestState } from './backtest/state';
import { resetBacktestCache } from './backtest/web-cache';
import { clearSubagentUsage } from './tools/execute-skill';
import type { WebEventBus } from '../commands/start/web/events';

/**
 * Reset all process-wide module-level caches that are tied to a specific
 * agent's identity, credentials, or runtime. Called on agent-exit so the next
 * agent (selected from the picker) starts with a clean slate.
 *
 * Note: provider env-var purging is handled by `loadAgentEnv()` itself the
 * next time it runs, so we don't need to touch `_agentProviderKeys` here.
 */
export function resetSharedCaches(): void {
  resetModelCache();
  resetHiveClient();
  resetBacktestState();
  resetBacktestCache();
  clearSubagentUsage();
}

/**
 * Single agent-boundary reset entry point. Folds in the WebEventBus reset
 * alongside the shared module caches so callers can't forget one half.
 *
 * If a new piece of agent-scoped server state appears (e.g. another cache,
 * another bus), wire its reset in here — not at the call site.
 */
export function resetAgentScopedState(eventBus: WebEventBus): void {
  eventBus.reset();
  resetSharedCaches();
}
