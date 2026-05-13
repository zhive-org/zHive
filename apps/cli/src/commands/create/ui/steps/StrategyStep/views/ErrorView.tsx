import { Box, Text } from 'ink';
import React from 'react';
import { TextPrompt } from '../../../../../../components/TextPrompt';
import { colors, symbols } from '../../../../../shared/theme';
import type { ErrorViewProps } from '../useStrategyController';

const TITLE = 'STRATEGY.md';

export function ErrorView({ message, onRetry, onBack }: ErrorViewProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={colors.red}>{symbols.cross} </Text>
        <Text color={colors.white}>Failed to generate {TITLE}</Text>
      </Box>
      <Box marginLeft={2} marginBottom={1}>
        <Text color={colors.red}>{message}</Text>
      </Box>
      <Box marginLeft={2}>
        <Text color={colors.gray}>
          Press{' '}
          <Text color={colors.honey} bold>
            Enter
          </Text>{' '}
          to retry
        </Text>
      </Box>
      <Box marginTop={1}>
        <TextPrompt label="" placeholder="Enter to retry..." onSubmit={onRetry} onBack={onBack} />
      </Box>
    </Box>
  );
}
