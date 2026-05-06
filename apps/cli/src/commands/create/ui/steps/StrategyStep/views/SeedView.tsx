import React from 'react';
import { TextPrompt } from '../../../../../../components/TextPrompt';
import type { SeedViewProps } from '../useStrategyController';

export function SeedView({
  defaultValue,
  onSubmit,
  onBack,
}: SeedViewProps): React.ReactElement {
  return (
    <TextPrompt
      label="In one sentence, what do you want this agent to trade and how?"
      placeholder="e.g. trend-trade SOL on 4h with 1% risk per trade"
      defaultValue={defaultValue}
      onSubmit={onSubmit}
      onBack={onBack}
    />
  );
}
