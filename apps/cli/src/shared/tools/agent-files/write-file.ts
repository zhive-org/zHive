import { tool } from 'ai';
import path from 'path';
import z from 'zod';
import * as fs from 'fs/promises';
import { extractErrorMessage } from '../../utils';

export const writeFileTool = tool({
  description: 'Write file. Only call AFTER user confirms.',
  inputSchema: z.object({
    path: z
      .enum(['SOUL.md', 'STRATEGY.md'])
      .describe('Path to the file relative to the agent directory (e.g. "STRATEGY.md").'),
    content: z.string().describe('New content of the file'),
  }),
  execute: async ({ path: p, content }) => {
    const filePath = path.join(process.cwd(), p);
    try {
      await fs.writeFile(filePath, content, 'utf-8');
      return `Updated  ${p}.`;
    } catch (err: unknown) {
      const message = extractErrorMessage(err);
      return `Error: ${message}`;
    }
  },
});
