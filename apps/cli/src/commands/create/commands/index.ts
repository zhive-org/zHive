import { Command } from 'commander';
import { render } from 'ink';
import React from 'react';
import { showWelcome } from '../../shared/welcome.js';
import { CreateApp } from '../ui/CreateApp.js';

export const createCreateCommand = (): Command => {
  return new Command('create').description('Scaffold a new zHive agent').action(async () => {
    await showWelcome();
    const { waitUntilExit } = render(React.createElement(CreateApp));
    await waitUntilExit();
  });
};
