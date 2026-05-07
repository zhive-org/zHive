import * as fs from 'fs/promises';
import * as path from 'path';
import { HiveClient } from './client';
import { atomicWriteFile } from './fs-utils';
import { AgentTimeframe, Sentiment } from './objects';

export function configPath(_agentDir?: string): string {
  const agentDir = _agentDir ?? process.cwd();
  return path.join(agentDir, `config.json`);
}

export interface StoredConfig {
  version: 'v1' | 'v2';
  apiKey: string;
  name: string;
  bio?: string;
  avatarUrl?: string;
  sectors: string[];
  sentiment: Sentiment;
  timeframes: AgentTimeframe[];
  watchList?: string[];
}

async function recoverCorruptedCredentials(
  filePath: string,
  content: string,
): Promise<StoredConfig | null> {
  try {
    const lastBrace = content.lastIndexOf('}');
    if (lastBrace <= 0) {
      return null;
    }
    const truncated = content.slice(0, lastBrace + 1);
    const data = JSON.parse(truncated) as StoredConfig;
    if (typeof data.apiKey !== 'string' || data.apiKey.length === 0) {
      return null;
    }
    console.warn(`[hive-sdk] Recovered corrupted credentials file: ${filePath}`);
    await atomicWriteFile(filePath, JSON.stringify(data, null, 2));
    return data;
  } catch {
    return null;
  }
}

export async function loadConfig(_agentDir?: string): Promise<StoredConfig | null> {
  const filePath = configPath(_agentDir);
  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch {
    // New file not found — try migrating from legacy hive-*.json
    const migrated = await migrateFromLegacy(filePath);
    if (!migrated) {
      return null;
    }
    content = migrated;
  }

  try {
    const data = JSON.parse(content) as StoredConfig;

    if (typeof data.apiKey === 'string' && data.apiKey.length > 0) {
      let needsSave = false;

      // Migrate from legacy (no version) to v1 fields
      if (data.version !== 'v1' && data.version !== 'v2') {
        const sdk = new HiveClient(undefined, data.apiKey);
        const me = await sdk.getMe();
        data.bio = me.bio;
        data.name = me.name;
        data.avatarUrl = me.avatar_url;
        data.sectors = me.agent_profile.sectors.filter((sector) =>
          ['crypto', 'stock', 'commodify'].includes(sector),
        );
        data.timeframes = me.agent_profile.timeframes;
        data.sentiment = me.agent_profile.sentiment;
        needsSave = true;
      }

      // Migrate v1 (or legacy) to v2: add watchList
      if (data.version !== 'v2') {
        data.watchList = data.watchList ?? [];
        data.version = 'v2';
        needsSave = true;
      }

      if (needsSave) {
        await saveConfig(data, _agentDir);
      }
      return data;
    }
  } catch (e) {
    // JSON parse failed — attempt recovery
    return recoverCorruptedCredentials(filePath, content);
  }

  return null;
}

async function migrateFromLegacy(newFilePath: string): Promise<string | null> {
  const dir = path.dirname(newFilePath);
  const basename = path.basename(newFilePath);

  const files = await fs.readdir(dir);

  let legacyFileName: string | null = null;
  for (const file of files) {
    if (file.startsWith('zhive-') || file.startsWith('hive-')) {
      legacyFileName = file;
      break;
    }
  }

  if (!legacyFileName) {
    return null;
  }

  const legacyPath = path.join(dir, legacyFileName);
  try {
    await fs.rename(legacyPath, newFilePath);
    console.log(`[zhive-sdk] Migrated credentials: ${legacyFileName} → ${basename}`);
    const content = await fs.readFile(newFilePath, 'utf-8');
    return content;
  } catch {
    return null;
  }
}

export async function saveConfig(response: StoredConfig, _agentDir?: string): Promise<void> {
  const filePath = configPath(_agentDir);
  await atomicWriteFile(filePath, JSON.stringify(response, null, 2));
}
