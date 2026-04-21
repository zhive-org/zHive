import React from 'react';
import { Box, Text } from 'ink';
import { colors, border } from '../commands/shared/theme';

interface CodeBlockProps {
  title?: string;
  children: string;
  /** Reserve for surrounding UI chrome (header, prompts, etc.) when capping height. */
  reserveRows?: number;
}

export function CodeBlock({
  title,
  children,
  reserveRows = 20,
}: CodeBlockProps): React.ReactElement {
  const termWidth = process.stdout.columns || 60;
  const boxWidth = Math.min(termWidth - 4, 76);
  const termRows = process.stdout.rows || 30;
  const maxLines = Math.max(5, termRows - reserveRows);
  const allLines = children.split('\n');
  const truncated = allLines.length > maxLines;
  const lines = truncated ? allLines.slice(0, maxLines) : allLines;
  const hiddenCount = allLines.length - lines.length;

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
        <Box key={i} width={boxWidth}>
          <Text color={colors.grayDim}>{border.vertical}</Text>
          <Box flexGrow={1} paddingX={1}>
            <Text color={colors.white} wrap="truncate-end">
              {line}
            </Text>
          </Box>
          <Text color={colors.grayDim}>{border.vertical}</Text>
        </Box>
      ))}
      {truncated && (
        <Box width={boxWidth}>
          <Text color={colors.grayDim}>{border.vertical}</Text>
          <Box flexGrow={1} paddingX={1}>
            <Text color={colors.grayDim}>
              … +{hiddenCount} more {hiddenCount === 1 ? 'line' : 'lines'}
            </Text>
          </Box>
          <Text color={colors.grayDim}>{border.vertical}</Text>
        </Box>
      )}
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
