import { Box, Text } from 'ink';
import React from 'react';
import { CodeBlock } from '../../../../../../components/CodeBlock';
import { TextPrompt } from '../../../../../../components/TextPrompt';
import { colors, symbols } from '../../../../../shared/theme';
import type { ReviewViewProps } from '../useStrategyController';

const TITLE = 'STRATEGY.md';

export function ReviewView({
  draft,
  onAccept,
  onRegenerate,
  onBack,
}: ReviewViewProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={colors.green}>{symbols.check} </Text>
        <Text color={colors.white}>{TITLE} draft ready</Text>
      </Box>
      <CodeBlock title={TITLE}>{draft ?? ''}</CodeBlock>
      <Box marginTop={1}>
        <Text color={colors.gray}>
          Press{' '}
          <Text color={colors.honey} bold>
            Enter
          </Text>{' '}
          to accept {symbols.dot} Type feedback to regenerate {symbols.dot}{' '}
          <Text color={colors.honey} bold>
            ↑↓
          </Text>{' '}
          to scroll
        </Text>
      </Box>
      <Box marginTop={1}>
        <TextPrompt
          label=""
          placeholder="Enter to accept, or type feedback..."
          onBack={onBack}
          onSubmit={(val) => {
            if (!val) onAccept();
            else onRegenerate(val);
          }}
        />
      </Box>
    </Box>
  );
}
