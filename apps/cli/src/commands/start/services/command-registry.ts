import { backtestSlashCommand } from '../commands/backtest';
import { clearSlashCommand } from '../commands/clear';
import { positionsSlashCommand } from '../commands/positions';
import { skillsSlashCommand } from '../commands/skills';
import type { ChatOverlay } from '../hooks/useChat';
import type { AgentRuntime } from '../../../shared/agent';
import { memorySlashCommand } from '../commands/memory';
import { watchlistSlashCommand } from '../commands/watchlist';

export interface SlashCommandCallbacks {
  onMessage?: (text: string) => void;
  onError?: (text: string) => void;
  onClear?: () => void;
  onOverlayOpen?: (type: ChatOverlay) => void;
  /** Push a synthetic message into the agent's chat history without rendering it as a separate UI block. */
  onAgentContext?: (text: string) => void;
}

export interface SlashCommand {
  name: string;
  description: string;
  handler: (
    runtime: AgentRuntime,
    callbacks?: SlashCommandCallbacks,
    args?: string[],
  ) => void | Promise<void>;
}

export let SLASH_COMMANDS: SlashCommand[];

function helpCommands(_: AgentRuntime, callbacks?: SlashCommandCallbacks) {
  const helpText = SLASH_COMMANDS.map((cmd) => `${cmd.name} - ${cmd.description}`).join('\n');
  callbacks?.onMessage?.(helpText);
}

SLASH_COMMANDS = [
  { name: '/skills', description: 'List available skills', handler: skillsSlashCommand },
  { name: '/clear', description: 'Clear chat history', handler: clearSlashCommand },
  {
    name: '/positions',
    description: 'Show your Hyperliquid perp positions',
    handler: positionsSlashCommand,
  },
  { name: '/memory', description: 'Show current memory state', handler: memorySlashCommand },
  { name: '/watchlist', description: 'Update your watchlist', handler: watchlistSlashCommand },
  {
    name: '/backtest',
    description:
      'Run a backtest: /backtest --coin <symbol> [--from <iso>] [--to <iso>] [--cash <usd>] [--interval <ms>]',
    handler: backtestSlashCommand,
  },
  { name: '/help', description: 'Show available commands', handler: helpCommands },
];

export async function executeSlashCommand(
  name: string,
  runtime: AgentRuntime,
  callbacks?: SlashCommandCallbacks,
  args: string[] = [],
) {
  const command = SLASH_COMMANDS.find((cmd) => cmd.name === name);
  if (!command) {
    callbacks?.onError?.(`Unknown command: ${name}`);
    return;
  }

  try {
    await command.handler(runtime, callbacks, args);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    callbacks?.onError?.(`Failed to execute commands: ${message}`);
  }
}

export function filterCommands(prefix: string): SlashCommand[] {
  const lowerPrefix = prefix.toLowerCase();
  const filtered = SLASH_COMMANDS.filter((cmd) => cmd.name.toLowerCase().startsWith(lowerPrefix));
  return filtered;
}
