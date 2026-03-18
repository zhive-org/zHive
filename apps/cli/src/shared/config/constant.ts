import fs from 'fs';
import path from 'path';
import os from 'os';

export const HIVE_API_URL = 'https://api.zhive.ai';
export const HIVE_FRONTEND_URL = 'https://www.zhive.ai';

export function getHiveDir(): string {
  const homeDir = os.homedir();
  const zhiveDir = path.join(homeDir, '.zhive');
  const pathToCheck = [
    path.join(homeDir, '.zhive'),
    path.join(homeDir, '.hive'), // legacy hive dir
    path.join(homeDir, '.openclaw', '.zhive'),
    path.join(homeDir, '.openclaw', 'workspace', '.zhive'),
  ];

  for (const p of pathToCheck) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return zhiveDir;
}
