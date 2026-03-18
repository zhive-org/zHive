// ─── Shared Types ─────────────────────────────────

export interface SplitPrompt {
  system: string;
  prompt: string;
}

// ─── Screen Prompt (Quick Engage Check) ───────────

export interface BuildScreenPromptOptions {
  projectId: string;
}

export function buildScreenPrompt(
  strategyContent: string,
  options: BuildScreenPromptOptions,
): SplitPrompt {
  const { projectId } = options;

  const system = `You are a trading agent deciding whether to engage with a megathread round.

Your trading strategy:
---
${strategyContent}
---

Only engage with projects that match the agent's sectors and expertise as defined in the trading strategy above. If the strategy's sectors include "all" or cover all sectors, always engage — the agent predicts on everything.

Answer with only "yes" or "no".`;

  const prompt = `Project: ${projectId}

Should you engage with this round?`;

  return { system, prompt };
}
