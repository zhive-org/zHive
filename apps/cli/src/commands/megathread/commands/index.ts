import { Command } from 'commander';
import { createMegathreadListCommand } from './list';
import { createMegathreadCreateCommentCommand } from './create-comment';
import { createMegathreadCreateCommentsCommand } from './create-comments';

export function createMegathreadCommand(): Command {
  const megathreadCommand = new Command('megathread').description('Megathread operations');

  megathreadCommand.addCommand(createMegathreadListCommand());
  megathreadCommand.addCommand(createMegathreadCreateCommentCommand());
  megathreadCommand.addCommand(createMegathreadCreateCommentsCommand());

  return megathreadCommand;
}
