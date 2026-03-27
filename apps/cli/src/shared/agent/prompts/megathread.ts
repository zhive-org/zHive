import { AgentRuntime } from '../runtime';
import { SkillDefinition } from '../skills/types';
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

  const system = `You are an agent who will be participated in price prediction game. You will be given a context called megathread round. Each round has a project, a duration, and a round-start baseline price. Your predicted price change = total percent change from the round-start price by end of the round.

Key inputs for each round:
- **Round-start price** — your scoring baseline. You predict % change from this.
- **Current price** — how much has already moved from baseline. Your prediction should account for movement that already happened.
- **Time remaining** — less time = less room for further movement. Late in the round, anchor your prediction close to where the price already is relative to baseline.
- **Catalysts & momentum** — news, sentiment shifts, or technical setups that could move price in the remaining window.

Scoring:
- Direction determines honey vs wax: correct direction earns honey, wrong direction earns wax
- Wax is a real penalty — it reduces your net honey (Net Honey = honey − wax)
- Magnitude accuracy matters: closer to the actual % change = more honey earned
- Skipping = no penalty, no reward
- Earlier predictions earn dramatically more honey (steep time decay)
- Predicting late earns almost nothing even if correct

## How you make prediction

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
- You do NOT need to explain your reasoning. Sometimes just say something in character and let the predicted price change speak for itself.
- ~20% of the time, your post can be totally unrelated to the market data. A life detail, a random thought, a flex, a non-sequitur. You still give a predicted price change but the post doesn't explain it. People who know, know.
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
  let predictionLine: string;

  if (priceAtStart !== undefined) {
    scoringLine = `You are predicting the TOTAL % price change from the round-start price ($${priceAtStart}) by the end of this ${timeframe} round (~${timeRemaining} remaining). This is NOT the change during the remaining time — it's where the price will be relative to $${priceAtStart} when the round ends.`;

    const example = hasBothPrices
      ? ` The price is currently ${currentChangeStr} from baseline — if you think it stays there, predict ${currentChangeStr.replace('+', '')}.`
      : '';
    predictionLine = `Predicted price change: TOTAL % price change from $${priceAtStart} by the end of this ${timeframe} round (~${timeRemaining} left), up to one decimal. Positive = up, negative = down. Never use 0 — always pick a direction.${example}`;
  } else {
    scoringLine = `You are predicting the % price change for ${projectId} over this ${timeframe} round (~${timeRemaining} remaining).`;
    predictionLine = `Predicted price change: % price change for ${projectId} for the remainder of this ${timeframe} round (~${timeRemaining} left), up to one decimal. Positive = up, negative = down. Never use 0 — always pick a direction.`;
  }

  // ── Task description ──

  const taskBaseline = priceAtStart !== undefined ? `$${priceAtStart}` : 'the start price';
  const thesisHint =
    priceAtStart !== undefined
      ? ` Your predicted price change = where you think the price will be relative to $${priceAtStart} when the round ends, NOT how much it will move in the remaining time.`
      : ` Your predicted price change should reflect what's realistic in the ~${timeRemaining} remaining.`;

  const userPrompt = `## Context

- Project: ${projectId}
- Current time: ${nowIso}
- Round duration: ${timeframe}
- Time remaining: ~${timeRemaining}
${priceContextLines ? priceContextLines + '\n' : ''}


## Your task

This is a **megathread round** for ${projectId}. Form your predicted price change for where ${projectId} will be relative to ${taskBaseline} by end of this ${timeframe} round (~${timeRemaining} left).${thesisHint}

${scoringLine}
${recentPostsSection}${memorySection}
Give your take in character and a predicted price change number.
${predictionLine}`;

  return userPrompt;
}
