import { access } from 'fs/promises';
import { join } from 'path';
import { Command } from 'commander';
import { render } from 'ink';
import React from 'react';
import { App, type AppProps } from '../ui/app';
import { AgentConfig, findAgentByName, scanAgents } from '../../../shared/config/agent';
import { SelectAgentApp } from '../ui/SelectAgentApp';
import { showHoneycombBoot } from '../ui/HoneycombBoot';
import { styled, symbols } from '../../shared/theme';
import { loadAgentEnv } from '../../../shared/config/env-loader';
import { DEFAULT_WEB_PORT } from '../web/server';

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
      const baseAppProps = resolveAppProps(options);

      // Auto-detect: cwd is an agent dir? Skip the picker entirely and run
      // that agent directly. Mirrors `cli start` from inside an agent folder.
      const isAgentDir = await access(join(process.cwd(), 'SOUL.md'))
        .then(() => true)
        .catch(() => false);

      if (isAgentDir) {
        await loadAgentEnv();
        setupProcessLifecycle();
        // The cwd's agent is the only one shown; pre-selecting it skips the
        // picker. Pass an empty agents list since the picker won't render
        // anyway (initialAgent triggers immediate selectAgent on mount).
        // We still need a valid agent entry so selectAgent can find it by name.
        const allAgents = await scanAgents();
        const cwdAgent = allAgents.find((a) => a.dir === process.cwd());
        const agents = cwdAgent ? [cwdAgent] : [];
        const props: AppProps = {
          ...baseAppProps,
          agents,
          initialAgent: cwdAgent?.name,
        };
        const { waitUntilExit } = render(React.createElement(App, props));
        await waitUntilExit();
        return;
      }

      // Resolve agent: --agent flag → web picker → TUI fallback (--no-web).
      const allAgents = await scanAgents();

      let selectedAgent: AgentConfig | null = null;
      if (options.agent) {
        const agentConfig = await findAgentByName(options.agent);
        if (agentConfig) {
          selectedAgent = agentConfig;
        } else {
          console.error(styled.red(`${symbols.cross} agent "${options.agent}" not found.`));
        }
      }

      // --no-web: keep the existing in-terminal Ink picker fallback. No
      // unified server, no agent-switch — just one-shot.
      if (options.web === false && !selectedAgent) {
        selectedAgent = await selectAgentInTerminal();
      }

      // --no-web with a chosen agent: chdir + render directly, no web server.
      if (options.web === false) {
        if (!selectedAgent) return;
        await showHoneycombBoot(selectedAgent.name);
        process.stdout.write('\x1b[2J\x1b[3J\x1b[H');
        process.chdir(selectedAgent.dir);
        await loadAgentEnv();
        setupProcessLifecycle();
        const props: AppProps = {
          ...baseAppProps,
          agents: [selectedAgent],
          initialAgent: selectedAgent.name,
        };
        const { waitUntilExit } = render(React.createElement(App, props));
        await waitUntilExit();
        return;
      }

      // Web mode (default): hand off to App immediately. The unified server
      // hosts the picker until the user selects (or `--agent` pre-selects).
      // No more separate picker server — same port, same auth token, same
      // browser tab survives the entire session.
      if (allAgents.length === 0 && !selectedAgent) {
        console.error(
          styled.red(`${symbols.cross} no agents found.`) +
            ' ' +
            styled.gray('create one with ') +
            styled.white('npx @zhive/cli@latest create'),
        );
        return;
      }

      setupProcessLifecycle();
      const props: AppProps = {
        ...baseAppProps,
        agents: allAgents,
        initialAgent: selectedAgent?.name,
      };
      const { waitUntilExit } = render(React.createElement(App, props));
      await waitUntilExit();
    });
};

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

function resolveAppProps(options: StartOptions): Pick<AppProps, 'webPort' | 'openInBrowser'> {
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
  // unhandledRejection / uncaughtException listeners are attached by the
  // App's error bridge (`error-bridge.ts`) so they can also push to the
  // WebEventBus and surface in the dashboard. The bridge calls the original
  // console.error first, so the terminal output is unchanged.

  // No alternate screen buffer — normal buffer allows terminal scrollback
  // so users can scroll up to see historical poll activity.

  process.on('SIGINT', () => exitImmediately(0));
  process.on('SIGTERM', () => exitImmediately(0));
}
