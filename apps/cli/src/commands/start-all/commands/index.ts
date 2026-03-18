import { Command } from 'commander';
import React from 'react';
import { render } from 'ink';
import { showWelcome } from '../../shared/welcome.js';
import { styled, symbols } from '../../shared/theme.js';
import { AgentProcessManager } from '../AgentProcessManager.js';
import { Dashboard } from '../ui/Dashboard.js';
import { fetchBulkStats, scanAgents, sortAgentsByHoney } from '../../../shared/config/agent.js';

export const createStartAllCommand = (): Command => {
  return new Command('start-all')
    .description('Start all agents')
    .action(async () => {
      // Run welcome animation and scan agents in parallel
      const results = await Promise.all([showWelcome(), scanAgents()]);
      const discovered = results[1];

      if (discovered.length === 0) {
        console.log(
          `\n  ${styled.honey(symbols.hive)} ${styled.red('No agents found in ~/.zhive/agents/')}\n`,
        );
        console.log(
          `  ${styled.gray('Create agents with:')} ${styled.white('npx @zhive/cli@latest create')}\n`,
        );
        return;
      }

      const names = discovered.map((a) => a.name);
      const statsMap = await fetchBulkStats(names);

      const sortedDiscovered = sortAgentsByHoney(discovered, statsMap);

      const manager = new AgentProcessManager();
      manager.spawnAll(sortedDiscovered);

      const { waitUntilExit } = render(React.createElement(Dashboard, { manager, statsMap }));
      await waitUntilExit();
    });
};
