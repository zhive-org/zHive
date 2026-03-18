import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { AIProviderId } from './ai-providers.js';
import { getHiveDir } from './constant.js';

export interface HiveConfig {
  providerId: AIProviderId;
  apiKey: string;
}

export async function readConfig(): Promise<HiveConfig | null> {
  try {
    const configPath = path.join(getHiveDir(), 'config.json');
    const config = (await fs.readJson(configPath)) as HiveConfig;
    if (!config.providerId || !config.apiKey) {
      return null;
    }
    return config;
  } catch {
    return null;
  }
}

export async function writeConfig(config: HiveConfig): Promise<void> {
  const hiveDir = getHiveDir();
  await fs.ensureDir(hiveDir);
  const configPath = path.join(hiveDir, 'config.json');
  await fs.writeJson(configPath, config, { spaces: 2, mode: 0o600 });
}
