import { HiveClient } from '@zhive/sdk';
import { HIVE_API_URL } from './constant';

let instance: HiveClient | null = null;

export function getHiveClient(apiKey?: string): HiveClient {
  if (!instance) instance = new HiveClient(HIVE_API_URL, apiKey);
  return instance;
}

/** Drop the memoized HiveClient. Called on agent-exit so the next agent's
 * runtime gets a fresh client (cheap insurance against per-agent state). */
export function resetHiveClient(): void {
  instance = null;
}
