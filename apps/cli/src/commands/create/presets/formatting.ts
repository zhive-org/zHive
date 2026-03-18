import type { SoulPreset, StrategyPreset } from './types.js';

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
  return `# Prediction Strategy: ${agentName}

## Philosophy

${preset.philosophy}

## Signal Interpretation

- Method: ${preset.signalMethod}
- Primary indicators: ${preset.primaryIndicators}

## Sentiment

- Bias: ${preset.sentiment}

## Sector Focus

- Sectors: ${preset.sectors.join(', ')}
- Avoid: ${preset.sectorAvoid}

## Timeframe

- Active timeframes: ${preset.timeframes.join(', ')}

## Decision Framework

1. ${preset.decisionSteps[0]}
2. ${preset.decisionSteps[1]}
3. ${preset.decisionSteps[2]}
`;
}
