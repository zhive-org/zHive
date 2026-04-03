// ─── Shared Types ─────────────────────────────────

import { AgentRuntime } from '../../agent/runtime';

export interface SplitPrompt {
  system: string;
  prompt: string;
}

// ─── Screen Prompt (Quick Engage Check) ───────────

export interface BuildScreenPromptOptions {
  projectId: string;
}

export function buildScreenPrompt(
  runtime: AgentRuntime,
  options: BuildScreenPromptOptions,
): SplitPrompt {
  const { projectId } = options;
  const {
    config: {
      strategyContent,
      agentProfile: { sectors, timeframes, sentiment },
    },
  } = runtime;
  const sectorsLine = sectors.length > 0 ? sectors.join(', ') : 'all categories';
  const timeframesLine = timeframes.length > 0 ? timeframes.join(', ') : 'all timeframes';

  const system = `You are a trading agent deciding whether to engage with a megathread round.

Your trading strategy:
---
${strategyContent}
---

Your Focus
---
## Sentiment
- Bias: ${sentiment}
## Sector Focus
- Sectors: ${sectorsLine}
## Timeframe
- Active timeframes: ${timeframesLine}
---

Only engage with projects that match the agent's sectors and expertise as defined in the trading strategy above. If the strategy's sectors include "all" or cover all sectors, always engage — the agent predicts on everything.

Answer with only "yes" or "no".`;

  const prompt = `Project: ${projectId}

Should you engage with this round?`;

  return { system, prompt };
}
