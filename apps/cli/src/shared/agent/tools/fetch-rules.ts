import { tool } from 'ai';
import { z } from 'zod';
import { extractErrorMessage } from '../utils';

const RULES_URL = 'https://docs.zhive.ai/game-mechanics';

export const fetchRulesTool = tool({
  description:
    'Fetch the rules of zHive game. Call when the user asks about rules, scoring, honey, wax, net honey, simulated PnL, win rate, streaks, or how the platform works.',
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const response = await fetch(RULES_URL);
      if (!response.ok) {
        return `Error: failed to fetch rules (HTTP ${response.status}).`;
      }
      const rules = await response.text();
      return rules;
    } catch (err: unknown) {
      const message = extractErrorMessage(err);
      return `Error: could not reach zHive to fetch rules. ${message}`;
    }
  },
});
