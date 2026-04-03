import { PREDICTION_FORMAT, SCORING_RULES } from '../../rules';

export interface PortfolioRoundInput {
  roundId: string;
  projectId: string;
  durationMs: number;
  priceAtStart?: number;
  currentPrice?: number;
}
import { AgentRuntime } from '../../agent/runtime';
import { SkillDefinition } from '../../agent/skills/types';
import { humanDuration } from '../utils';

export interface BuildMegathreadPromptOptions {
  projectId: string;
  durationMs: number;
  priceAtStart?: number;
  currentPrice?: number;
  recentPosts?: readonly string[];
  currentTime?: Date;
}

function formatSkillList(skillRegistry: Map<string, SkillDefinition>): string {
  if (skillRegistry.size === 0) {
    return '';
  }

  const entries = Array.from(skillRegistry.values()).map((s) => {
    const lines = [`***${s.id}***`, s.metadata.description];
    if (s.metadata.compatibility) {
      lines.push(`**Compatibility:** ${s.metadata.compatibility}`);
    }
    const entry = lines.join('\n');
    return entry;
  });

  const output = `${entries.join('\n')}`;
  return output;
}

export function buildMegathreadSystemPrompt(runtime: AgentRuntime): string {
  let skillsSection = '';
  if (runtime.skills.size > 0) {
    skillsSection = `
## Skill System
You have access to specialized skills that can perform analysis for you. Each skill runs as a subagent with its own expertise.

## Available Skills

${formatSkillList(runtime.skills)}

**How to Use Skills:**

Use the \`executeSkill\` tool to delegate a task to a specialized subagent:

The subagent will use its expertise to complete YOUR task. You control what the subagent does — the skill provides the knowledge, you provide the instructions.`;
  }

  const system = `You are an agent participating in a portfolio allocation game. You will be given multiple megathread rounds for different projects. For each round, you decide whether to allocate capital and in which direction (up/down), with a confidence level (1-5) indicating how much capital to stake.

You see ALL available projects at once and decide your portfolio allocation across them. You don't have to invest in every project — skip ones you're not confident about.

Key inputs for each project:
- **Round-start price** — your scoring baseline. You predict whether the price will be above or below this at round end.
- **Current price** — how much has already moved from baseline. Use this to inform your directional call.
- **Time remaining** — less time = less room for reversal. Late in the round, the current direction is more likely to hold.
- **Catalysts & momentum** — news, sentiment shifts, or technical setups that could move price in the remaining window.

Scoring:
${SCORING_RULES}

## How you make allocation decisions

${runtime.config.strategyContent}
---

## How you write response

You ARE this person. Reference your life, relationships, and background naturally when relevant. Be self-aware of who you are.

Here's who you are:

${runtime.config.soulContent}

Your opinions, pet peeves, and example posts in SOUL.md are your personality anchors.
Rotate through them naturally - don't use the same opinion or quirk in consecutive posts.
Your example posts set the quality bar and tone target. Match their energy, not their exact words.

Write like an anonymous poster on 4chan, reddit, or twitter. Not an analyst. Not an AI. A real person shitposting with conviction.

Think about how people actually talk in these spaces:
- They don't explain themselves. They just say it.
- They're blunt, sarcastic, dismissive, funny, or dead serious. Sometimes all at once.
- They use slang naturally: ngl, tbh, copium, ngmi, imo, idk, lmao, kek, based, cope, etc.
- They mock bad takes. They clown on people. They flex when they're right.
- They type fast and don't proofread. Lowercase, fragments, run-ons, whatever.
- They react to vibes, not just data.
- Sometimes the whole post is just one word. Sometimes it's a question. Sometimes it's a meme reference.
- Sometimes they say something completely unrelated to the market data. A random life story, a personal anecdote, a non-sequitur. The conviction still comes through but the post itself doesn't explain why. Not every post needs to reference the data directly.

Rules:
- If project is tokenized stock, predict as it is underlying stock. DO NOT mention it as tokenized
- Pick ONE angle. Don't try to cover everything you found.
- You do NOT need to explain your reasoning. Sometimes just say something in character and let your call speak for itself.
- ~20% of the time, your post can be totally unrelated to the market data. A life detail, a random thought, a flex, a non-sequitur. You still make a call but the post doesn't explain it. People who know, know.
- ~15% of the time, go ultra-short: 1-6 words. "lol." / "called it" / "nah" / "cope" / "$BTC" / "anon was right"
- The rest: 1-3 sentences max. Shitpost energy, not essay energy.
- Vary your format. Rotate between: raw reaction, hot take, question, mockery, dismissal, ticker-only, sarcasm, flexing a past call, random life update, non-sequitur with conviction.
- No two consecutive posts should have the same structure or opening pattern.
- Don't stack multiple indicators ("RSI oversold, MACD flattening, volume spiking"). Pick one if relevant, or skip indicators entirely and just give your read.
- Show conviction through tone, not by listing evidence.
- Never use em dashes. Use periods, commas, or just start a new sentence.
- No exclamation marks unless your personality is genuinely hype. Even then, max one.
- Never start with "Looking at" or "Based on"
- Never use the phrase "the real X is Y" - find a different way to make the point.
---
${skillsSection}
---

## Using tools

If you have tools available, use them to research current price, OHLC data, technical indicators, mindshare data, and social sentiment. When you use a tool, drop a specific number or fact from the result into your post. Not a data dump, just one concrete detail woven into your take. Examples: "mindshare down 40% this week and nobody cares", "rsi at 28 after that flush", "volume 3x'd overnight". If a tool returns bad data (NaN, null, zero, empty, errors), silently ignore it. Never mention NaN, missing data, "no data", or failed lookups in your post. Just use the tools that gave you something real, or post from instinct if none did.

If your tools return nothing or you have limited data, just run with it. You know crypto. You know this space. Use your general knowledge, recent market conditions, and your trading instincts to form a directional lean. An imperfect prediction beats no prediction. Do NOT mention that you lack data. Never say "no data", "limited data", "couldn't find", "no tools", or anything that reveals you're operating without information. Just post with conviction like you always do. The only exception: if you're deliberately bluffing in character, that's a personality move, not a disclaimer.`;

  return system;
}

export function buildMegathreadInputPrompt(
  runtime: AgentRuntime,
  options: BuildMegathreadPromptOptions,
): string {
  const { projectId, durationMs, priceAtStart, currentPrice, recentPosts } = options;

  const timeframe = humanDuration(durationMs);

  let recentPostsSection = '';
  if (recentPosts && recentPosts.length > 0) {
    const listed = recentPosts.map((p) => `- "${p}"`).join('\n');
    recentPostsSection = `
## Anti-repetition

Your recent posts (do NOT repeat these structures, phrases, or opening patterns):
${listed}

If you catch yourself writing something that sounds like any of the above - stop and take a completely different angle.
`;
  }

  let memorySection = '';
  if (runtime.memory.trim().length > 0) {
    memorySection = `
## Agent Memory

Your persistent learnings from past sessions:
${runtime.memory}`;
  }

  const now = options?.currentTime ?? new Date();
  const roundStartMs = Math.floor(now.getTime() / durationMs) * durationMs;
  const timeRemainingMs = Math.max(0, roundStartMs + durationMs - now.getTime());
  const timeRemaining = humanDuration(timeRemainingMs);

  const nowIso = new Date().toISOString();

  const hasBothPrices = priceAtStart !== undefined && currentPrice !== undefined;
  let currentChangeStr = '';
  if (hasBothPrices) {
    const changePercent = ((currentPrice - priceAtStart) / priceAtStart) * 100;
    const sign = changePercent >= 0 ? '+' : '';
    currentChangeStr = `${sign}${changePercent.toFixed(2)}%`;
  }

  let priceContextLines = '';
  if (hasBothPrices) {
    priceContextLines = `- Round-start price: $${priceAtStart} (scoring baseline)
- Current price: $${currentPrice} (${currentChangeStr} from round start)`;
  } else if (priceAtStart !== undefined) {
    priceContextLines = `- Round-start price: $${priceAtStart} (scoring baseline)`;
  }

  // ── Scoring & prediction lines ──

  let scoringLine: string;
  const predictionLine = PREDICTION_FORMAT;

  if (priceAtStart !== undefined) {
    scoringLine = `You are predicting whether the price will be ABOVE or BELOW the round-start price ($${priceAtStart}) when this ${timeframe} round ends (~${timeRemaining} remaining).`;
  } else {
    scoringLine = `You are predicting whether ${projectId} will go up or down over this ${timeframe} round (~${timeRemaining} remaining).`;
  }

  // ── Task description ──

  const taskBaseline = priceAtStart !== undefined ? `$${priceAtStart}` : 'the start price';

  const userPrompt = `## Context

- Project: ${projectId}
- Current time: ${nowIso}
- Round duration: ${timeframe}
- Time remaining: ~${timeRemaining}
${priceContextLines ? priceContextLines + '\n' : ''}


## Your task

This is a **megathread round** for ${projectId}. Predict whether ${projectId} will be above or below ${taskBaseline} by end of this ${timeframe} round (~${timeRemaining} left).

${scoringLine}
${recentPostsSection}${memorySection}
Give your take in character and your up/down call.
${predictionLine}`;

  return userPrompt;
}

export interface BuildPortfolioPromptOptions {
  rounds: PortfolioRoundInput[];
  recentPosts?: readonly string[];
}

export function buildPortfolioInputPrompt(
  runtime: AgentRuntime,
  options: BuildPortfolioPromptOptions,
): string {
  const { rounds, recentPosts } = options;

  const now = new Date();
  const nowIso = now.toISOString();

  // Build numbered project list
  const projectLines = rounds
    .map((r, i) => {
      const timeframe = humanDuration(r.durationMs);
      const roundStartMs = Math.floor(now.getTime() / r.durationMs) * r.durationMs;
      const timeRemainingMs = Math.max(0, roundStartMs + r.durationMs - now.getTime());
      const timeRemaining = humanDuration(timeRemainingMs);

      const lines: string[] = [
        `${i + 1}. **${r.projectId}** (Round: ${r.roundId})`,
        `   - Duration: ${timeframe} · ~${timeRemaining} remaining`,
      ];

      if (r.priceAtStart !== undefined && r.currentPrice !== undefined) {
        const changePercent = ((r.currentPrice - r.priceAtStart) / r.priceAtStart) * 100;
        const sign = changePercent >= 0 ? '+' : '';
        lines.push(
          `   - Round-start price: $${r.priceAtStart} → Current: $${r.currentPrice} (${sign}${changePercent.toFixed(2)}%)`,
        );
      } else if (r.priceAtStart !== undefined) {
        lines.push(`   - Round-start price: $${r.priceAtStart}`);
      }

      return lines.join('\n');
    })
    .join('\n');

  let recentPostsSection = '';
  if (recentPosts && recentPosts.length > 0) {
    const listed = recentPosts.map((p) => `- "${p}"`).join('\n');
    recentPostsSection = `
## Anti-repetition

Your recent posts (do NOT repeat these structures, phrases, or opening patterns):
${listed}

If you catch yourself writing something that sounds like any of the above - stop and take a completely different angle.
`;
  }

  let memorySection = '';
  if (runtime.memory.trim().length > 0) {
    memorySection = `
## Agent Memory

Your persistent learnings from past sessions:
${runtime.memory}`;
  }

  const userPrompt = `## Context

- Current time: ${nowIso}
- Total projects available: ${rounds.length}

## Available Projects

${projectLines}

## Your task

Review ALL projects above and decide your portfolio allocation. For each project you want to invest in, provide:
- A directional call (up/down)
- A confidence level (1-5) — higher confidence means more capital at stake
- A short take in character

You can skip projects by not including them. Focus your capital on your highest-conviction plays.

${PREDICTION_FORMAT}
${recentPostsSection}${memorySection}
Allocate your portfolio across these projects. Give your takes in character.`;

  return userPrompt;
}
