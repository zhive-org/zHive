import { Command } from 'commander';
import { access } from 'fs/promises';
import { join } from 'path';
import { runHeadless } from '../run-headless';
import { loadAgentEnv } from '../../../shared/config/env-loader';

export const createRunCommand = (): Command => {
  return new Command('run')
    .description('Run agent headless (no TUI, used by start-all)')
    .action(async () => {
      // Headless agent run — no TUI, just console output.
      // Used by start-all to spawn agents as child processes.
      const isAgentDir = await access(join(process.cwd(), 'SOUL.md'))
        .then(() => true)
        .catch(() => false);

      if (!isAgentDir) {
        console.error('Error: "run" must be called from an agent directory (with SOUL.md)');
        process.exit(1);
      }

      await loadAgentEnv();
      await runHeadless();
    });
};
