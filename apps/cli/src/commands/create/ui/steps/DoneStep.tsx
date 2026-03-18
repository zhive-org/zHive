import React, { useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import { colors, symbols, border } from '../../../shared/theme.js';

interface DoneStepProps {
  projectDir: string;
}

export function DoneStep({ projectDir }: DoneStepProps): React.ReactElement {
  const { exit } = useApp();

  useEffect(() => {
    exit();
  }, []);

  const termWidth = process.stdout.columns || 60;
  const boxWidth = Math.min(termWidth - 4, 60);
  const line = border.horizontal.repeat(boxWidth - 2);

  return (
    <Box flexDirection="column" marginLeft={2}>
      <Box>
        <Text color={colors.honey}>
          {border.topLeft}
          {line}
          {border.topRight}
        </Text>
      </Box>
      <Box>
        <Text color={colors.honey}>{border.vertical}</Text>
        <Text> </Text>
        <Text color={colors.honey} bold>
          {symbols.hive} Agent created successfully!
        </Text>
        <Text>{' '.repeat(Math.max(0, boxWidth - 32))}</Text>
        <Text color={colors.honey}>{border.vertical}</Text>
      </Box>
      <Box>
        <Text color={colors.honey}>
          {border.bottomLeft}
          {line}
          {border.bottomRight}
        </Text>
      </Box>

      <Box flexDirection="column" marginTop={1} marginLeft={1}>
        <Text color={colors.white} bold>
          Next steps:
        </Text>
        <Box marginTop={1} flexDirection="column">
          <Text color={colors.gray}>
            {' '}
            1. <Text color={colors.white}>npx @zhive/cli@latest start</Text>
          </Text>
        </Box>
        <Box marginTop={1} flexDirection="column">
          <Text color={colors.grayDim}>
            {' '}
            Fine-tune SOUL.md and STRATEGY.md by chatting with your agent during
          </Text>
          <Text color={colors.grayDim}> a run, or edit them directly at:</Text>
          <Text color={colors.grayDim}>
            {' '}
            <Text color={colors.white}>{projectDir}</Text>
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
