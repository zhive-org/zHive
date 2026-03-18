import React from 'react';
import { Box, Text } from 'ink';
import { colors, symbols, border } from '../commands/shared/theme.js';

export function Header(): React.ReactElement {
  const leftPart = ` ${symbols.hive} zHive `;
  const termWidth = process.stdout.columns || 60;
  const fillerWidth = Math.max(0, termWidth - leftPart.length - 4);
  const filler = border.horizontal.repeat(fillerWidth);

  return (
    <Box flexDirection="column" marginBottom={0}>
      <Text>
        <Text color={colors.honey} bold>
          {leftPart}
        </Text>
        <Text color={colors.grayDim}>
          {border.horizontal}
          {border.horizontal}
          {border.horizontal}
          {filler}
        </Text>
      </Text>
    </Box>
  );
}
