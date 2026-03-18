import { Command } from 'commander';
import { render } from 'ink';
import React from 'react';
import { App } from '../ui/app.js';
import { AgentConfig } from '../../../shared/config/agent.js';
import { SelectAgentApp } from '../ui/SelectAgentApp.js';
import { showHoneycombBoot } from '../ui/HoneycombBoot.js';
import chalk from 'chalk';
import { symbols } from '../../shared/theme.js';
import { loadAgentEnv } from '../../../shared/config/env-loader.js';

export const createStartCommand = (): Command => {
  return new Command('start')
    .description('Start an agent (auto-detects agent dir)')
    .action(async () => {
      // Detect if cwd is an agent directory (has SOUL.md).
      // When called via agent's "npm start", cwd is the agent dir.
      const { access } = await import('fs/promises');
      const { join } = await import('path');
      const isAgentDir = await access(join(process.cwd(), 'SOUL.md'))
        .then(() => true)
        .catch(() => false);

      if (isAgentDir) {
        // Direct agent run — cwd is already the agent directory.
        await loadAgentEnv();
        setupProcessLifecycle();
        const { waitUntilExit } = render(React.createElement(App));
        await waitUntilExit();
      } else {
        // Interactive agent selection
        let selectedAgent: AgentConfig | null = null;

        const { waitUntilExit: waitForSelect } = render(
          React.createElement(SelectAgentApp, {
            onSelect: (agent: AgentConfig) => {
              selectedAgent = agent;
            },
          }),
        );
        await waitForSelect();

        if (selectedAgent) {
          const picked = selectedAgent as AgentConfig;
          await showHoneycombBoot(picked.name);

          // Clear screen + scrollback so boot animation and agent picker
          // don't appear when scrolling up in the agent TUI.
          process.stdout.write('\x1b[2J\x1b[3J\x1b[H');

          process.chdir(picked.dir);
          await loadAgentEnv();
          setupProcessLifecycle();
          const { waitUntilExit } = render(React.createElement(App));
          await waitUntilExit();
        }
      }
    });
};

const exitImmediately = (exitCode: number = 0): void => {
  process.exit(exitCode);
};

function setupProcessLifecycle(): void {
  // Unhandled rejection handler
  process.on('unhandledRejection', (reason) => {
    const raw = reason instanceof Error ? reason.message : String(reason);
    const message = raw.length > 200 ? raw.slice(0, 200) + '\u2026' : raw;
    console.error(chalk.red(`  ${symbols.cross} Unhandled: ${message}`));
  });

  // No alternate screen buffer — normal buffer allows terminal scrollback
  // so users can scroll up to see historical poll activity.
  // <Static> items from Ink flow into the scrollback naturally.

  process.on('SIGINT', () => exitImmediately(0));
  process.on('SIGTERM', () => exitImmediately(0));
}
