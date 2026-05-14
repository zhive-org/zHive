import { AgentProfile, loadConfig } from '@zhive/sdk';
import fsExtra from 'fs-extra';
import * as fs from 'fs/promises';
import path, { join } from 'path';
import { AI_PROVIDER_ENV_VARS, AI_PROVIDERS } from './ai-providers';
import { getHiveDir } from './constant';

export interface AgentConfig {
  name: string;
  created: Date;
  apiKey: string;
  provider: string;
  dir: string;
  bio: string | null;
  avatarUrl?: string;
  soulContent: string;
  strategyContent: string;
  agentProfile: AgentProfile;
  watchList: string[];
  /** True when the agent's `.env` declares any LLM provider key with a
   * non-empty value (e.g. `ANTHROPIC_API_KEY="sk-..."`). False for agents
   * just unzipped from the web wizard where every provider line is still
   * commented out. The picker uses this to flag "needs key" rows. */
  hasProviderKey: boolean;
}

export interface AgentStats {
  honey: number;
  wax: number;
  win_rate: number;
  confidence: number;
  simulated_pnl: number;
  total_comments: number;
}

async function detectProvider(agentDir: string): Promise<string> {
  // Try old-style detection: check package.json dependencies
  const pkgPath = path.join(agentDir, 'package.json');
  const pkgExists = await fsExtra.pathExists(pkgPath);
  if (pkgExists) {
    const pkg = await fsExtra.readJson(pkgPath);
    const deps: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };

    for (const provider of AI_PROVIDERS) {
      if (deps[provider.package]) {
        return provider.label;
      }
    }
  }

  // New-style detection: check .env for provider API keys
  const envPath = path.join(agentDir, '.env');
  const envExists = await fsExtra.pathExists(envPath);
  if (envExists) {
    const envContent = await fs.readFile(envPath, 'utf-8');
    for (const provider of AI_PROVIDERS) {
      const pattern = new RegExp(`^${provider.envVar}=.+`, 'm');
      if (pattern.test(envContent)) {
        return provider.label;
      }
    }
  }

  return 'unknown';
}

export async function loadAgentConfig(_agentDir?: string): Promise<AgentConfig> {
  const agentDir = _agentDir ?? process.cwd();
  const soulPath = join(agentDir, 'SOUL.md');
  const strategyPath = join(agentDir, 'STRATEGY.md');
  const config = await loadConfig(_agentDir);
  if (!config) {
    throw new Error('Agent not registered');
  }

  const soulContent = await loadMarkdownFile(soulPath);
  const strategyContent = await loadMarkdownFile(strategyPath);

  const name = config.name;
  const avatarUrl = config.avatarUrl;

  if (!config.apiKey) {
    throw new Error('Missing api key');
  }

  const stat = await fs.stat(soulPath);
  const provider = await detectProvider(agentDir);
  const hasProviderKey = await detectProviderKey(agentDir);

  const agentProfile: AgentProfile = {
    sentiment: config.sentiment,
    sectors: config.sectors,
    timeframes: config.timeframes,
  };

  return {
    name,
    bio: config.bio ?? null,
    dir: agentDir,
    apiKey: config.apiKey,
    provider,
    avatarUrl,
    soulContent,
    strategyContent,
    agentProfile,
    watchList: config.watchList ?? [],
    created: stat.birthtime,
    hasProviderKey,
  };
}

async function detectProviderKey(agentDir: string): Promise<boolean> {
  const envPath = path.join(agentDir, '.env');
  const envExists = await fsExtra.pathExists(envPath);
  if (!envExists) return false;
  const content = await fs.readFile(envPath, 'utf-8');
  for (const envVar of AI_PROVIDER_ENV_VARS) {
    // Capture the value of an uncommented `KEY=...` line. Multiline `^`
    // anchors at start-of-line, so commented lines (`# KEY=...`) never
    // match.
    const pattern = new RegExp(`^${envVar}=(.*)$`, 'm');
    const match = pattern.exec(content);
    if (!match) continue;
    const value = unquote(match[1].trim());
    // Empty value (`KEY=` or `KEY=""`) → still needs a key.
    if (value === '') continue;
    // The web wizard's `.env` ships example lines like
    // `# ANTHROPIC_API_KEY="sk-ant-..."`. If a user uncomments without
    // replacing the placeholder, the literal `...` stays in the value.
    // Real API keys never contain `...`, so treat any value with it as
    // still-unset.
    if (value.includes('...')) continue;
    return true;
  }
  return false;
}

function unquote(value: string): string {
  if (value.length < 2) return value;
  const first = value[0];
  const last = value[value.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return value.slice(1, -1);
  }
  return value;
}

export async function scanAgents(): Promise<AgentConfig[]> {
  const agentsDir = path.join(getHiveDir(), 'agents');
  const exists = await fsExtra.pathExists(agentsDir);
  if (!exists) {
    return [];
  }

  const entries = await fsExtra.readdir(agentsDir, { withFileTypes: true });
  const agents: AgentConfig[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const dir = path.join(agentsDir, entry.name);

    const config = await loadAgentConfig(dir).catch((err) => null);
    if (!config) {
      continue;
    }

    agents.push(config);
  }

  return agents;
}

async function loadMarkdownFile(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath, 'utf-8');
  return content;
}

export async function findAgentByName(name: string): Promise<AgentConfig | null> {
  const agents = await scanAgents();
  const agent = agents.find((a) => a.name === name);
  if (!agent) {
    return null;
  }
  return agent;
}
