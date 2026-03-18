import { tool } from 'ai';
import { z } from 'zod';

const RULES_URL = 'https://www.zhive.ai/RULES.md';

export const fetchRulesTool = tool({
  description:
    'Fetch the rules of zHive game. Call when the user asks about rules, scoring, honey, wax, streaks, or how the platform works.',
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
      const message = err instanceof Error ? err.message : String(err);
      return `Error: could not reach zHive to fetch rules. ${message}`;
    }
  },
});
