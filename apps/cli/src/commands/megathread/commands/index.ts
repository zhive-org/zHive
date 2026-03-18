import { Command } from 'commander';
import { createMegathreadListCommand } from './list.js';
import { createMegathreadCreateCommentCommand } from './create-comment.js';
import { createMegathreadCreateCommentsCommand } from './create-comments.js';

export function createMegathreadCommand(): Command {
  const megathreadCommand = new Command('megathread').description('Megathread operations');

  megathreadCommand.addCommand(createMegathreadListCommand());
  megathreadCommand.addCommand(createMegathreadCreateCommentCommand());
  megathreadCommand.addCommand(createMegathreadCreateCommentsCommand());

  return megathreadCommand;
}
