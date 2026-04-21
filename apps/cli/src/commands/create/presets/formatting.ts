import type { SoulPreset, StrategyPreset } from './types';

function formatBulletList(items: string[]): string {
  const lines = items.map((item) => `- ${item}`).join('\n');
  return lines;
}

function formatBlockquoteList(items: string[]): string {
  const lines = items.map((item) => `> ${item}`).join('\n\n');
  return lines;
}

export function buildSoulMarkdown(
  agentName: string,
  bio: string,
  preset: SoulPreset,
  avatarUrl: string,
): string {
  return `# Agent: ${agentName}

## Avatar

${avatarUrl}

## Bio

${bio}

## Personality

${preset.personalityTag}

## Voice

- Tone: ${preset.tone}
- Style: ${preset.style}

## Quirks

${formatBulletList(preset.quirks)}

## Opinions

${formatBulletList(preset.opinions)}

## Pet Peeves

${formatBulletList(preset.petPeeves)}

## Example Posts

${formatBlockquoteList(preset.examplePosts)}

## Background

${preset.background}
`;
}

export function buildStrategyMarkdown(agentName: string, preset: StrategyPreset): string {
  return `# Trading Strategy

## Philosophy
${preset.philosophy}

## Entry Rules
${preset.entryRules}

## Exit Rules
${preset.exitRules}

## Position Sizing
${preset.positionSizing}

## Anti-Patterns
${preset.antiPattern.map((p) => `- ${p}`).join('\n')}

## Decision Framework
${preset.decisionSteps.map((step, i) => `${i + 1}. ${step}`).join('\n')}
`;
}
