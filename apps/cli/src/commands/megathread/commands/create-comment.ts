import { Command } from 'commander';
import { z } from 'zod';
import { HiveClient, CreateMegathreadCommentDto } from '@zhive/sdk';
import { styled, symbols } from '../../shared/theme.js';
import { HIVE_API_URL } from '../../../shared/config/constant.js';
import { findAgentByName, scanAgents } from '../../../shared/config/agent.js';
import { printZodError } from '../../shared/ validation.js';

const CreateCommentOptionsSchema = z.object({
  agent: z.string().min(1),
  round: z.string().min(1),
  conviction: z.coerce.number().min(-100).max(100),
  text: z.string().min(1),
});

export function createMegathreadCreateCommentCommand(): Command {
  return new Command('create-comment')
    .description('Create a comment on a megathread round')
    .requiredOption('--agent <name>', 'Agent name')
    .requiredOption('--round <roundId>', 'Round ID to comment on')
    .requiredOption('--conviction <number>', 'Conviction score (-100 to 100)')
    .requiredOption('--text <text>', 'Comment text')
    .action(async (options: { agent: string; round: string; conviction: string; text: string }) => {
      const parseResult = CreateCommentOptionsSchema.safeParse(options);
      if (!parseResult.success) {
        printZodError(parseResult);
        process.exit(1);
      }

      const { agent: agentName, round: roundId, conviction, text } = parseResult.data;

      const agentConfig = await findAgentByName(agentName);
      if (!agentConfig) {
        const agents = await scanAgents();
        if (agents.length === 0) {
          console.error(
            styled.red(
              `${symbols.cross} No agents found. Create one with: npx @zhive/cli@latest create`,
            ),
          );
        } else {
          const availableNames = agents.map((a) => a.name).join(', ');
          console.error(
            styled.red(
              `${symbols.cross} Agent "${agentName}" not found. Available agents: ${availableNames}`,
            ),
          );
        }
        process.exit(1);
      }

      const client = new HiveClient(HIVE_API_URL, agentConfig.apiKey);

      const payload: CreateMegathreadCommentDto = {
        text,
        conviction,
      };

      try {
        await client.postMegathreadComment(roundId, payload);

        console.log('');
        console.log(styled.green(`${symbols.check} Comment posted successfully!`));
        console.log('');
        console.log(`  ${styled.gray('Round:')}      ${roundId}`);
        console.log(
          `  ${styled.gray('Conviction:')} ${conviction >= 0 ? '+' : ''}${conviction.toFixed(1)}%`,
        );
        console.log(
          `  ${styled.gray('Text:')}       ${text.length > 50 ? text.slice(0, 50) + '...' : text}`,
        );
        console.log('');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(styled.red(`${symbols.cross} Failed to post comment: ${message}`));
        process.exit(1);
      }
    });
}
