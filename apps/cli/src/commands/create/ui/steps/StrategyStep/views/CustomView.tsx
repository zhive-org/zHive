import React from 'react';
import { AgenticChat } from '../../../../../../components/AgenticChat';
import type { CustomViewProps } from '../useStrategyController';

export function CustomView({
  seed,
  transcript,
  pending,
  onAnswer,
  onUndo,
  onBack,
  onRetry,
}: CustomViewProps): React.ReactElement {
  return (
    <AgenticChat
      seed={seed}
      transcript={transcript}
      pending={pending}
      onAnswer={onAnswer}
      onUndo={onUndo}
      onBack={onBack}
      onRetry={onRetry}
    />
  );
}
