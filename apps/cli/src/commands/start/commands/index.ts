import { randomBytes } from 'node:crypto';
import { access } from 'fs/promises';
import { join } from 'path';
import { Command } from 'commander';
import { render } from 'ink';
import open from 'open';
import React from 'react';
import { App, type AppProps } from '../ui/app';
import { AgentConfig, findAgentByName, scanAgents } from '../../../shared/config/agent';
import { SelectAgentApp } from '../ui/SelectAgentApp';
import { showHoneycombBoot } from '../ui/HoneycombBoot';
import chalk from 'chalk';
import { styled, symbols } from '../../shared/theme';
import { loadAgentEnv } from '../../../shared/config/env-loader';
import { DEFAULT_WEB_PORT } from '../web/server';
import { startPickerServer, type PickerAgentSummary } from '../web/picker-server';

interface StartOptions {
  agent?: string;
  web: boolean;
  webPort?: string;
  open: boolean;
}

export const createStartCommand = (): Command => {
  return new Command('start')
    .description('Start an agent (auto-detects agent dir)')
    .option('--agent <agent>', 'Agent name')
    .option('--no-web', 'Run terminal-only without the localhost web dashboard')
    .option('--web-port <port>', `Port for the web dashboard (default ${DEFAULT_WEB_PORT})`)
    .option('--no-open', 'Do not auto-open the web dashboard in your browser')
    .action(async (options: StartOptions) => {
      const appProps = resolveAppProps(options);

      const isAgentDir = await access(join(process.cwd(), 'SOUL.md'))
        .then(() => true)
        .catch(() => false);

      if (isAgentDir) {
        // Direct agent run — cwd is already the agent directory.
        await loadAgentEnv();
        setupProcessLifecycle();
        const { waitUntilExit } = render(React.createElement(App, appProps));
        await waitUntilExit();
        return;
      }

      // Resolve agent: --agent flag → web picker → TUI fallback (--no-web).
      let selectedAgent: AgentConfig | null = null;

      if (options.agent) {
        const agentConfig = await findAgentByName(options.agent);
        if (agentConfig) {
          selectedAgent = agentConfig;
        } else {
          console.error(styled.red(`${symbols.cross} agent "${options.agent}" not found.`));
        }
      }

      let appPropsForRender: AppProps = appProps;

      if (!selectedAgent && options.web !== false) {
        const picked = await selectAgentInBrowser(appProps);
        if (picked) {
          selectedAgent = picked.agent;
          // Hand the picker's token off to the App's web server and skip the
          // second browser open — the tab is already pointed at us.
          appPropsForRender = {
            ...appProps,
            webAuthToken: picked.authToken,
            openInBrowser: false,
          };
        }
      }

      if (!selectedAgent) {
        // --no-web (or web picker failed) — fall back to the in-terminal picker.
        selectedAgent = await selectAgentInTerminal();
      }

      if (selectedAgent) {
        const picked = selectedAgent;
        await showHoneycombBoot(picked.name);

        // Clear screen + scrollback so boot animation and agent picker
        // don't appear when scrolling up in the agent TUI.
        process.stdout.write('\x1b[2J\x1b[3J\x1b[H');

        process.chdir(picked.dir);
        await loadAgentEnv();
        setupProcessLifecycle();
        const { waitUntilExit } = render(React.createElement(App, appPropsForRender));
        await waitUntilExit();
      }
    });
};

interface BrowserPickResult {
  agent: AgentConfig;
  authToken: string;
}

async function selectAgentInBrowser(appProps: AppProps): Promise<BrowserPickResult | null> {
  const agents = await scanAgents();
  if (agents.length === 0) {
    console.error(
      styled.red(`${symbols.cross} no agents found.`) +
        ' ' +
        styled.gray('create one with ') +
        styled.white('npx @zhive/cli@latest create'),
    );
    return null;
  }

  const port = appProps.webPort ?? DEFAULT_WEB_PORT;
  const authToken = randomBytes(24).toString('base64url');
  const summaries: PickerAgentSummary[] = agents.map((a) => ({
    name: a.name,
    created: a.created.toISOString(),
    bio: a.bio,
    avatarUrl: a.avatarUrl,
  }));

  let handle;
  try {
    handle = await startPickerServer({
      port,
      authToken,
      agents: summaries,
      onSelect: () => {},
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      styled.red(`${symbols.cross} could not start web picker on port ${port}: ${message}`),
    );
    return null;
  }

  console.log(
    `${styled.honey(symbols.hive)} ${styled.white('zhive')} ${styled.gray('—')} ${styled.gray('open the dashboard to pick an agent:')}`,
  );
  console.log(`  ${styled.cyan(handle.url)}`);
  console.log(styled.dim(`  waiting for agent selection in browser...`));

  if (appProps.openInBrowser !== false) {
    open(handle.url).catch(() => {});
  }

  let selectedName: string;
  try {
    selectedName = await handle.waitForSelection();
  } finally {
    await handle.stop().catch(() => {});
  }

  const picked = agents.find((a) => a.name === selectedName);
  if (!picked) {
    console.error(styled.red(`${symbols.cross} agent "${selectedName}" disappeared from disk.`));
    return null;
  }
  return { agent: picked, authToken };
}

async function selectAgentInTerminal(): Promise<AgentConfig | null> {
  let selectedAgent: AgentConfig | null = null;
  const { waitUntilExit: waitForSelect } = render(
    React.createElement(SelectAgentApp, {
      onSelect: (agent: AgentConfig) => {
        selectedAgent = agent;
      },
    }),
  );
  await waitForSelect();
  return selectedAgent;
}

function resolveAppProps(options: StartOptions): AppProps {
  if (options.web === false) return {};

  const port = parseWebPort(options.webPort);
  return { webPort: port, openInBrowser: options.open !== false };
}

function parseWebPort(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_WEB_PORT;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`Invalid --web-port "${raw}" (expected 1-65535)`);
  }
  return parsed;
}

const exitImmediately = (exitCode: number = 0): void => {
  process.exit(exitCode);
};

function setupProcessLifecycle(): void {
  // Unhandled rejection handler
  process.on('unhandledRejection', (reason) => {
    const raw = reason instanceof Error ? reason.message : String(reason);
    const message = raw.length > 200 ? raw.slice(0, 200) + '…' : raw;
    console.error(chalk.red(`  ${symbols.cross} Unhandled: ${message}`));
  });

  // No alternate screen buffer — normal buffer allows terminal scrollback
  // so users can scroll up to see historical poll activity.
  // <Static> items from Ink flow into the scrollback naturally.

  process.on('SIGINT', () => exitImmediately(0));
  process.on('SIGTERM', () => exitImmediately(0));
}
