import type { ChatMessage } from './chat-prompt';
import type { SplitPrompt } from './prompt';

export interface MemoryExtractionContext {
  currentMemory: string;
  sessionMessages: ChatMessage[];
  lineCount: number;
}

export function buildMemoryExtractionPrompt(context: MemoryExtractionContext): SplitPrompt {
  const { currentMemory, sessionMessages, lineCount } = context;

  // ── System (static — cached by providers) ──

  const system = `You are an AI trading agent's memory system. Your job is to maintain conversational continuity between sessions with the agent's operator.

Review the session data and update the agent's MEMORY.md file. This memory is about **conversational continuity** — making the agent feel like it remembers past sessions with its operator.

Focus on extracting:
1. **Topics discussed** — what subjects came up in conversation (e.g., "we talked about ETH gas fees", "operator asked about macro outlook")
2. **Operator interests and concerns** — what the operator cares about, recurring themes, questions they've raised
3. **Ongoing conversational threads** — topics that span multiple sessions or feel unresolved
4. **Operator preferences** — how they like to interact, what they find useful or annoying

Do NOT save:
- Market predictions, signal analysis, or trading insights — a separate results-based learning system will handle those in the future
- Raw price data or signal summaries
- Routine prediction outcomes

Follow these rules:
1. **Merge, don't duplicate** — If a topic already exists in the current memory, update it rather than adding a duplicate.
2. **Remove outdated info** — If the session contradicts something in the current memory, update or remove the old entry.
3. **Stay concise** — Each entry should be 1-2 lines. Use bullet points.
4. **Organize by topic** — Use markdown headers to group related context (e.g., "## Conversations", "## Operator Interests", "## Ongoing Threads").
5. **Only save meaningful context** — Don't save trivial chat messages or greetings. Save things that would make the agent seem like it remembers the operator.
6. **Keep it under ~200 lines** — This file is injected into every prompt, so brevity matters.

Output the complete updated MEMORY.md content. Start with \`# Memory\` as the top-level header. Output ONLY the markdown content, no code fences or explanation.`;

  // ── Prompt (dynamic — changes every call) ──

  let sessionSection = '';
  if (sessionMessages.length > 0) {
    const listed = sessionMessages
      .map((m) => `${m.role === 'user' ? 'Operator' : 'Agent'}: ${m.content}`)
      .join('\n');
    sessionSection = `\n## Session Chat Log\n\n${listed}\n`;
  }

  const currentMemorySection =
    currentMemory.trim().length > 0
      ? `\n## Current MEMORY.md\n\n\`\`\`markdown\n${currentMemory}\n\`\`\`\n`
      : '\n## Current MEMORY.md\n\n(empty - this is a fresh agent)\n';

  const consolidationNote =
    lineCount > 200
      ? `\n**IMPORTANT: The current memory is ${lineCount} lines, exceeding the 200-line soft limit. Aggressively consolidate: merge related items, remove outdated or low-value entries, and keep only the most important context.**\n`
      : '';

  const prompt = `${currentMemorySection}${consolidationNote}
## Session Activity
${sessionSection}
Update the MEMORY.md based on the session activity above.`;

  return { system, prompt };
}
