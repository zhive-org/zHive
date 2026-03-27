import { readFileSync } from 'fs';
import { AI_PROVIDER_ENV_VARS } from './ai-providers';

let _agentProviderKeys: Set<string> = new Set();

/**
 * Provider env-var names declared in the agent's .env file.
 * Used by getModel() to prioritize the agent's chosen provider
 * over keys inherited from the shell.
 */
export function getAgentProviderKeys(): ReadonlySet<string> {
  return _agentProviderKeys;
}

/**
 * Load the agent's .env with provider-key priority.
 *
 * 1. Parse .env to discover which provider keys the agent declared.
 * 2. Load .env with override so the agent's values win for the same key.
 * 3. getModel() uses getAgentProviderKeys() to check those providers first,
 *    falling back to shell-inherited keys if the agent has none.
 */
export async function loadAgentEnv(): Promise<void> {
  try {
    const content = readFileSync('.env', 'utf-8');
    _agentProviderKeys = new Set(
      AI_PROVIDER_ENV_VARS.filter((key) => new RegExp(`^${key}=`, 'm').test(content)),
    );
  } catch {
    _agentProviderKeys = new Set();
  }

  const { config } = await import('dotenv');
  config({ override: true });
}
