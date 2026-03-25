import { AgentTimeframe, durationMsToTimeframe, HiveClient } from '@zhive/sdk';
import { Command } from 'commander';
import z from 'zod';
import { findAgentByName, scanAgents } from '../../../shared/config/agent.js';
import { HIVE_API_URL } from '../../../shared/config/constant.js';
import { border, styled, symbols } from '../../shared/theme.js';
import { humanDuration } from '../../../shared/agent/utils.js';
import { printZodError } from '../../shared/utils.js';

const VALID_TIMEFRAMES: AgentTimeframe[] = ['4h', '24h', '7d'];

const ListMegathreadOptionsSchema = z.object({
  agent: z.string(),
  timeframe: z
    .string()
    .optional()
    .transform((val, ctx): AgentTimeframe[] | undefined => {
      if (!val) return undefined;
      const parsed = val.split(',').map((t) => t.trim()) as AgentTimeframe[];

      const invalidParts = parsed.filter((t) => !VALID_TIMEFRAMES.includes(t));

      if (invalidParts.length > 0) {
        ctx.addIssue({
          code: 'custom',
          message: `Invalid. valid values are [${VALID_TIMEFRAMES.join(', ')}]`,
        });
        return z.NEVER;
      }

      return parsed;
    }),
});

export function createMegathreadListCommand(): Command {
  const program = new Command('list')
    .description('List unpredicted megathread rounds of an agent')
    .requiredOption('--agent <name>', 'Agent name')
    .option('--timeframe <timeframes>', 'Filter by timeframes (comma-separated: 4h,24h,7d)')
    .action(async (options: { agent: string; timeframe?: string }) => {
      const parseResult = ListMegathreadOptionsSchema.safeParse(options);
      if (!parseResult.success) {
        printZodError(parseResult);
        process.exit(1);
      }

      const { agent: agentName, timeframe: timeframes } = parseResult.data;

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

      try {
        const rounds = await client.getUnpredictedRounds(timeframes);

        console.log('');
        console.log(styled.honeyBold(`${symbols.hive} Unpredicted Rounds for ${agentName}`));
        console.log('');

        if (rounds.length === 0) {
          console.log(styled.gray('  No unpredicted rounds available.'));
          console.log('');
          return;
        }

        const headers = [
          'Round ID',
          'Token',
          'Timeframe',
          'PriceAtStart',
          'Current Price',
          'Remaining time',
        ];
        const now = new Date();
        const rows = rounds.map((r) => {
          const tf = durationMsToTimeframe(r.durationMs);
          const timeframeStr = tf ?? `${r.durationMs}ms`;
          const timeRemainingMs = Math.max(0, r.snapTimeMs + r.durationMs - now.getTime());
          const timeRemaining = humanDuration(timeRemainingMs);

          return [
            r.roundId,
            r.projectId,
            timeframeStr,
            r.priceAtStart,
            r.currentPrice,
            timeRemaining,
          ];
        });

        const colWidths = headers.map((h, i) => {
          const dataMax = Math.max(...rows.map((row) => String(row[i]).length));
          const width = Math.max(h.length, dataMax);
          return width;
        });

        const headerLine = headers.map((h, i) => h.padEnd(colWidths[i])).join('  ');
        console.log(`  ${styled.gray(headerLine)}`);
        console.log(`  ${styled.gray(border.horizontal.repeat(headerLine.length))}`);

        for (const row of rows) {
          const line = row.map((cell, i) => String(cell).padEnd(colWidths[i])).join('  ');
          console.log(`  ${line}`);
        }

        console.log('');
        console.log(styled.gray(`  Total: ${rounds.length} round(s)`));
        console.log('');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          styled.red(`${symbols.cross} Failed to fetch unpredicted rounds: ${message}`),
        );
        process.exit(1);
      }
    });

  return program;
}
