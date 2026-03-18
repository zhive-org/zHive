import React from 'react';
import { Box, Text } from 'ink';
import { colors, border } from '../commands/shared/theme.js';

interface CharacterSummaryCardProps {
  name: string;
  personality?: string;
  voice?: string;
  tradingStyle?: string;
  sectors?: string;
  sentiment?: string;
  timeframe?: string;
  bio?: string;
}

export function CharacterSummaryCard({
  name,
  personality,
  voice,
  tradingStyle,
  sectors,
  sentiment,
  timeframe,
  bio,
}: CharacterSummaryCardProps): React.ReactElement | null {
  if (!personality && !voice && !tradingStyle && !sectors && !sentiment && !timeframe && !bio) {
    return null;
  }

  const termWidth = process.stdout.columns || 60;
  const boxWidth = Math.min(termWidth - 4, 52);
  const title = `AGENT IDENTITY — ${name}`;
  const topBar = `${border.topLeft}${border.horizontal} ${title} ${border.horizontal.repeat(Math.max(0, boxWidth - title.length - 5))}${border.topRight}`;
  const bottomBar = `${border.bottomLeft}${border.horizontal.repeat(Math.max(0, boxWidth - 2))}${border.bottomRight}`;

  const rows: Array<{ label: string; value: string }> = [];

  const personalityDisplay = personality ?? '???';
  rows.push({ label: 'Personality', value: personalityDisplay });

  const voiceDisplay = voice ?? '???';
  rows.push({ label: 'Voice', value: voiceDisplay });

  const tradingStyleDisplay = tradingStyle ?? '???';
  rows.push({ label: 'Trading', value: tradingStyleDisplay });

  const sectorsDisplay = sectors ?? '???';
  rows.push({ label: 'Sectors', value: sectorsDisplay });

  const sentimentDisplay = sentiment ?? '???';
  rows.push({ label: 'Sentiment', value: sentimentDisplay });

  const timeframeDisplay = timeframe ?? '???';
  rows.push({ label: 'Timeframe', value: timeframeDisplay });

  const bioDisplay = bio ? (bio.length > 30 ? bio.slice(0, 30) + '...' : bio) : '???';
  rows.push({ label: 'Bio', value: bioDisplay });

  return (
    <Box flexDirection="column" marginLeft={2} marginBottom={1}>
      <Box>
        <Text color={colors.honey}>{topBar}</Text>
      </Box>
      {rows.map((row) => {
        const content = `  ${row.label}: ${row.value}`;
        const padding = Math.max(0, boxWidth - content.length - 3);
        return (
          <Box key={row.label}>
            <Text color={colors.honey}>{border.vertical}</Text>
            <Text color={colors.grayDim}> {row.label}: </Text>
            <Text color={colors.white}>{row.value}</Text>
            <Text>{' '.repeat(padding)}</Text>
            <Text color={colors.honey}>{border.vertical}</Text>
          </Box>
        );
      })}
      <Box>
        <Text color={colors.honey}>{bottomBar}</Text>
      </Box>
    </Box>
  );
}
