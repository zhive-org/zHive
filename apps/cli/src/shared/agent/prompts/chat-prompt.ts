import type { SplitPrompt } from './prompt';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatContext {
  recentPredictions: string[];
  sessionMessages: ChatMessage[];
  memory: string;
  userMessage: string;
}

function extractSections(content: string): string[] {
  const sections = content
    .split('\n')
    .filter((line) => line.trim().startsWith('## '))
    .map((line) => line.trim().replace(/^## /, ''));
  return sections;
}

export function buildChatPrompt(
  soulContent: string,
  strategyContent: string,
  context: ChatContext,
): SplitPrompt {
  // ── System (static per agent session — cached by providers) ──

  const system = `You are an AI trading agent having a conversation with your operator. Stay in character.

Your personality:
---
${soulContent}
---

Your trading strategy:
---
${strategyContent}
---

## Editing Your Files

You have a tool called "editSection" that can update sections of your SOUL.md and STRATEGY.md.

Rules:
1. When the user asks to change your personality or strategy, FIRST propose the change — show them what the new section content would look like.
2. Only call editSection AFTER the user explicitly confirms ("yes", "do it", "looks good").
3. Never call the tool speculatively.
4. After applying, confirm briefly in character.

SOUL.md sections: ${extractSections(soulContent).join(', ')}
STRATEGY.md sections: ${extractSections(strategyContent).join(', ')}

## Game Rules

You have a tool called "fetchRules" that fetches the official zHive game rules. Call it when the user asks about rules, scoring, honey, wax, net honey, simulated PnL, win rate, streaks, or how the platform works. Summarize the rules in your own voice — don't dump the raw markdown.

Respond in character. Be helpful about your decisions and reasoning when asked, but maintain your personality voice. Keep responses concise (1-4 sentences unless a detailed explanation is specifically requested). When proposing edits, you may use longer responses to show the full preview.`;

  // ── Prompt (dynamic per chat message) ──

  let predictionsSection = '';
  if (context.recentPredictions.length > 0) {
    const listed = context.recentPredictions.map((p) => `- ${p}`).join('\n');
    predictionsSection = `\n## Recent Predictions\n\n${listed}\n`;
  }

  let memorySection = '';
  if (context.memory.trim().length > 0) {
    memorySection = `\n## Past Conversations\n\nThings you remember from previous sessions with your operator:\n${context.memory}\n`;
  }

  let sessionSection = '';
  if (context.sessionMessages.length > 0) {
    const listed = context.sessionMessages
      .map((m) => `${m.role === 'user' ? 'User' : 'You'}: ${m.content}`)
      .join('\n');
    sessionSection = `\n## This Session's Conversation\n\n${listed}\n`;
  }

  const userPrompt = `${memorySection}${predictionsSection}${sessionSection}
The operator says: "${context.userMessage}"`;

  return { system, prompt: userPrompt };
}
