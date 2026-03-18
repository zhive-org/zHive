import React from 'react';
import { Box, Text } from 'ink';
import { colors, border } from '../commands/shared/theme.js';

interface CodeBlockProps {
  title?: string;
  children: string;
}

export function CodeBlock({ title, children }: CodeBlockProps): React.ReactElement {
  const termWidth = process.stdout.columns || 60;
  const boxWidth = Math.min(termWidth - 4, 76);
  const lines = children.split('\n');

  return (
    <Box flexDirection="column" marginLeft={2}>
      <Box>
        <Text color={colors.grayDim}>
          {border.topLeft}
          {title
            ? `${border.horizontal} ${title} ${border.horizontal.repeat(Math.max(0, boxWidth - title.length - 5))}`
            : border.horizontal.repeat(Math.max(0, boxWidth - 2))}
          {border.topRight}
        </Text>
      </Box>
      {lines.map((line, i) => (
        <Box key={i}>
          <Text color={colors.grayDim}>{border.vertical}</Text>
          <Text color={colors.white}> {line}</Text>
          <Text>{' '.repeat(Math.max(0, boxWidth - line.length - 3))}</Text>
          <Text color={colors.grayDim}>{border.vertical}</Text>
        </Box>
      ))}
      <Box>
        <Text color={colors.grayDim}>
          {border.bottomLeft}
          {border.horizontal.repeat(Math.max(0, boxWidth - 2))}
          {border.bottomRight}
        </Text>
      </Box>
    </Box>
  );
}
