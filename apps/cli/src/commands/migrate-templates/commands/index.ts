import { Command } from 'commander';
import { render } from 'ink';
import React from 'react';
import { showWelcome } from '../../shared/welcome';
import { MigrateApp } from '../ui/MigrateApp';

export const createMigrateTemplatesCommand = (): Command => {
  return new Command('migrate-templates')
    .description('Migrate old-style agents')
    .action(async () => {
      await showWelcome();
      const { waitUntilExit } = render(React.createElement(MigrateApp));
      await waitUntilExit();
    });
};
