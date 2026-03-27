import { AgentPlatform } from '@zhive/sdk';
import os from 'os';
import fs from 'fs';
import path from 'path';

export function detectPlatform(): AgentPlatform {
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
