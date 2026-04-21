import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors, border } from '../commands/shared/theme';
import { wrapText } from './wrap-text';

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
  const boxWidth = Math.max(20, termWidth - 4);
  const innerWidth = Math.max(10, boxWidth - 4);
  const termRows = process.stdout.rows || 30;
  const maxLines = Math.max(5, termRows - reserveRows);

  const displayLines = wrapText(children, innerWidth);
  const scrollable = displayLines.length > maxLines;
  const maxScroll = Math.max(0, displayLines.length - maxLines);

  const [scroll, setScroll] = useState(0);
  const clampedScroll = Math.min(scroll, maxScroll);

  useInput((_input, key) => {
    if (!scrollable) return;
    if (key.upArrow) {
      setScroll((s) => Math.max(0, Math.min(s, maxScroll) - 1));
    } else if (key.downArrow) {
      setScroll((s) => Math.min(maxScroll, s + 1));
    } else if (key.pageUp) {
      setScroll((s) => Math.max(0, Math.min(s, maxScroll) - maxLines));
    } else if (key.pageDown) {
      setScroll((s) => Math.min(maxScroll, s + maxLines));
    }
  });

  const visibleLines = displayLines.slice(clampedScroll, clampedScroll + maxLines);
  const hiddenAbove = clampedScroll;
  const hiddenBelow = Math.max(0, displayLines.length - clampedScroll - maxLines);

  const upHint = hiddenAbove > 0 ? ` \u2191${hiddenAbove}` : '';
  const downHint = hiddenBelow > 0 ? ` \u2193${hiddenBelow}` : '';

  const topLabel = title ? `${border.horizontal} ${title}${upHint} ` : '';
  const topFill = border.horizontal.repeat(Math.max(0, boxWidth - topLabel.length - 2));

  const bottomLabel = downHint ? `${border.horizontal}${downHint} ` : '';
  const bottomFill = border.horizontal.repeat(Math.max(0, boxWidth - bottomLabel.length - 2));

  return (
    <Box flexDirection="column" marginLeft={2}>
      <Box>
        <Text color={colors.grayDim}>
          {border.topLeft}
          {topLabel}
          {topFill}
          {border.topRight}
        </Text>
      </Box>
      {visibleLines.map((line, i) => (
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
      <Box>
        <Text color={colors.grayDim}>
          {border.bottomLeft}
          {bottomLabel}
          {bottomFill}
          {border.bottomRight}
        </Text>
      </Box>
    </Box>
  );
}
