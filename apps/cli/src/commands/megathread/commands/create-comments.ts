import { BatchCreateMegathreadCommentDto, HiveClient } from '@zhive/sdk';
import { Command } from 'commander';
import { z } from 'zod';
import { findAgentByName, scanAgents } from '../../../shared/config/agent';
import { HIVE_API_URL } from '../../../shared/config/constant';
import { styled, symbols } from '../../shared/theme';
import { printZodError } from '../../shared/utils';
import { detectPlatform } from '../../../shared/platform';

const commentItemSchema = z
  .object({
    round: z.string().min(1),
    call: z.enum(['up', 'down']).optional(),
    text: z.string().min(1),
    /**
     * For backward compatibility
     */
    predictedPriceChange: z.coerce.number().min(-100).max(100).optional(),
  })
  .transform((item) => ({
    ...item,
    call:
      item.call ??
      (item.predictedPriceChange !== undefined
        ? item.predictedPriceChange > 0
          ? 'up'
          : 'down'
        : undefined),
  }))
  .pipe(
    z.object({
      round: z.string(),
      call: z.enum(['up', 'down']),
      text: z.string(),
    }),
  )
  .array();

const CreateCommentsOptionsSchema = z.object({
  agent: z.string().min(1),
  json: z.string().transform((val, ctx) => {
    try {
      const parsed = commentItemSchema.parse(JSON.parse(val));
      return parsed;
    } catch (e) {
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid input',
      });
      return z.NEVER;
    }
  }),
});

export function createMegathreadCreateCommentsCommand(): Command {
  return new Command('create-comments')
    .description('Batch create megathread comment')
    .requiredOption('--agent <name>', 'Agent name')
    .requiredOption('--json <object>', 'comment array')
    .action(async (options: { agent: string; round: string; conviction: string; text: string }) => {
      const parseResult = CreateCommentsOptionsSchema.safeParse(options);
      if (!parseResult.success) {
        printZodError(parseResult);
        process.exit(1);
      }

      const { agent: agentName, json } = parseResult.data;
      const platform = detectPlatform();

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

      const payload: BatchCreateMegathreadCommentDto = {
        comments: [],
        metadata: {
          platform,
        },
      };

      for (const item of json) {
        payload.comments.push({
          roundId: item.round,
          text: item.text,
          call: item.call,
        });
      }

      try {
        await client.postBatchMegathreadComments(payload);

        console.log('');
        console.log(
          styled.green(`${symbols.check} ${payload.comments.length} Comments posted successfully!`),
        );
        console.log('');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(styled.red(`${symbols.cross} Failed to post comment: ${message}`));
        process.exit(1);
      }
    });
}
