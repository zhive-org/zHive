export interface SlashCommand {
  name: string;
  description: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { name: '/skills', description: 'List available skills' },
  { name: '/help', description: 'Show available commands' },
  { name: '/clear', description: 'Clear chat history' },
  { name: '/memory', description: 'Show current memory state' },
  // { name: '/backtest', description: 'Run agent against test set (/backtest <num> fetches from API)' },
  { name: '/prediction', description: 'Show your last 10 resolved predictions' },
  { name: '/positions', description: 'Show your Hyperliquid perp positions' },
];

export function filterCommands(prefix: string): SlashCommand[] {
  const lowerPrefix = prefix.toLowerCase();
  const filtered = SLASH_COMMANDS.filter((cmd) => cmd.name.toLowerCase().startsWith(lowerPrefix));
  return filtered;
}
