import { Box } from 'ink';
import React from 'react';
import { useStrategyController } from './useStrategyController';
import { CustomView } from './views/CustomView';
import { ErrorView } from './views/ErrorView';
import { PresetView } from './views/PresetView';
import { ReviewView } from './views/ReviewView';
import { SeedView } from './views/SeedView';
import { StreamingView } from './views/StreamingView';

export function StrategyStep(): React.ReactElement {
  const view = useStrategyController();

  return (
    <Box flexDirection="column">
      {view.kind === 'preset' && <PresetView {...view.props} />}
      {view.kind === 'seed' && <SeedView {...view.props} />}
      {view.kind === 'custom' && <CustomView {...view.props} />}
      {view.kind === 'streaming' && <StreamingView {...view.props} />}
      {view.kind === 'review' && <ReviewView {...view.props} />}
      {view.kind === 'error' && <ErrorView {...view.props} />}
    </Box>
  );
}
