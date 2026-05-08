import { readFileSync, writeFileSync } from 'fs';
import * as path from 'path';
import { AI_PROVIDER_ENV_VARS } from './ai-providers';

let _agentProviderKeys: Set<string> = new Set();

/** Snapshot of provider keys inherited from the user's shell (not from any
 * agent's .env), captured the first time `loadAgentEnv()` runs. Lazy because
 * `ai-providers` and `env-loader` import each other; reading
 * `AI_PROVIDER_ENV_VARS` at module top-level would race the cycle. Once
 * captured, the set is preserved across agent switches so the user's
 * shell-set fallback keys survive the stale-key purge below. */
let _originalShellEnvKeys: Set<string> | null = null;

function getOriginalShellEnvKeys(): Set<string> {
  if (_originalShellEnvKeys) return _originalShellEnvKeys;
  _originalShellEnvKeys = new Set(
    AI_PROVIDER_ENV_VARS.filter((key) => {
      const v = process.env[key];
      return typeof v === 'string' && v.length > 0;
    }),
  );
  return _originalShellEnvKeys;
}

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
 * 2. Purge any AI provider keys from `process.env` that aren't in the new
 *    agent's `.env` AND weren't inherited from the shell at process start —
 *    prevents stale keys from a previously-loaded agent leaking into
 *    `getModel()` after an agent switch.
 * 3. Load .env with override so the agent's values win for the same key.
 * 4. getModel() uses getAgentProviderKeys() to check those providers first,
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

  // Purge stale provider keys: any AI provider key currently in process.env
  // that the new agent's .env doesn't declare AND that wasn't there at boot
  // must be a leftover from a previous agent's loadAgentEnv() — drop it so
  // getModel() picks the right provider for this agent.
  const original = getOriginalShellEnvKeys();
  for (const key of AI_PROVIDER_ENV_VARS) {
    if (!_agentProviderKeys.has(key) && !original.has(key)) {
      delete process.env[key];
    }
  }

  const { config } = await import('dotenv');
  config({ override: true });
}

/**
 * Set a single key in `<agentDir>/.env`, preserving every other line in the
 * file. Creates the file if it doesn't exist. Used by the dashboard's
 * credentials editor to rotate provider keys without clobbering whatever
 * else the user has in their .env.
 *
 * Lines are matched on their `KEY=` prefix; values are written verbatim
 * (no quoting). Values containing newlines are rejected — callers must
 * sanitize first.
 */
export function updateEnvVar(agentDir: string, key: string, value: string): void {
  if (!/^[A-Z_][A-Z0-9_]*$/i.test(key)) {
    throw new Error(`Invalid env var name: ${key}`);
  }
  if (value.includes('\n') || value.includes('\r')) {
    throw new Error('Env var value cannot contain newlines');
  }
  const filePath = path.join(agentDir, '.env');
  let existing = '';
  try {
    existing = readFileSync(filePath, 'utf-8');
  } catch {
    // file doesn't exist — fine, we'll create it
  }
  const lines = existing.length > 0 ? existing.split('\n') : [];
  const linePattern = new RegExp(`^${key}=`);
  let replaced = false;
  const next = lines.map((line) => {
    if (linePattern.test(line)) {
      replaced = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!replaced) {
    // Append. Trailing-blank-line normalization keeps the file tidy.
    if (next.length > 0 && next[next.length - 1] !== '') next.push('');
    next.push(`${key}=${value}`);
  }
  writeFileSync(filePath, next.join('\n'));
}
