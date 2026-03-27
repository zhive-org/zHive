import { Command } from 'commander';
import { render } from 'ink';
import React from 'react';
import { ListApp } from '../ui/ListApp';

export const createListCommand = (): Command => {
  return new Command('list').description('List existing agents').action(async () => {
    const { waitUntilExit } = render(React.createElement(ListApp));
    await waitUntilExit();
  });
};
