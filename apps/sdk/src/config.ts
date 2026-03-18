import { CreateAgentResponse } from './objects';
import * as fs from 'fs/promises';
import * as path from 'path';
import { atomicWriteFile } from './fs-utils';
import { HiveAgent } from './agent';
import { HiveClient } from './client';

export function configPath(_agentDir?: string): string {
  const agentDir = _agentDir ?? process.cwd();
  return path.join(agentDir, `config.json`);
}

export interface StoredConfig {
  apiKey: string;
  name: string;
  avatarUrl?: string;
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
      // Migrate agentName
      if (!data.name) {
        const sdk = new HiveClient(undefined, data.apiKey);
        const me = await sdk.getMe();
        data.name = me.name;
        data.avatarUrl = me.avatar_url;
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
