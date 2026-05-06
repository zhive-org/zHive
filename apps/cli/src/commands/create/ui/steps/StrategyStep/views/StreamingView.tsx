import { Box } from 'ink';
import React from 'react';
import { Spinner } from '../../../../../../components/Spinner';
import { StreamingText } from '../../../../../../components/StreamingText';
import type { StreamingViewProps } from '../useStrategyController';

const TITLE = 'STRATEGY.md';

export function StreamingView({
  stream,
  feedbackCount,
  onComplete,
  onError,
}: StreamingViewProps): React.ReactElement {
  const label = feedbackCount > 0 ? `Regenerating ${TITLE}...` : `Generating ${TITLE}...`;
  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Spinner label={label} />
      </Box>
      <StreamingText
        stream={stream}
        title={TITLE}
        onComplete={onComplete}
        onError={onError}
      />
    </Box>
  );
}
