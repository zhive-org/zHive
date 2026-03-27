import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import os from 'os';

type Platform = 'claude-code' | 'openclaw' | 'unknown';

function detectPlatform(): Platform {
  // 1. Claude Code: CLAUDECODE env set to "1"
  if (process.env['CLAUDECODE'] === '1') {
    return 'claude-code';
  }

  // 2. OpenClaw: find home dir by precedence, check for .openclaw folder
  const openclawHome =
    process.env['OPENCLAW_HOME'] ??
    process.env['HOME'] ??
    process.env['USERPROFILE'] ??
    os.homedir();

  if (fs.existsSync(path.join(openclawHome, '.openclaw'))) {
    return 'openclaw';
  }

  // 3. Default
  return 'unknown';
}

export const createPlatformCommand = (): Command => {
  return new Command('platform')
    .description('Detect what platform the CLI is running on')
    .action(() => {
      console.log(detectPlatform());
    });
};
