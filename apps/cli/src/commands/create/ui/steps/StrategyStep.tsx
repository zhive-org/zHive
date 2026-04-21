import { Box } from 'ink';
import React, { useCallback, useState } from 'react';
import { SelectPrompt } from '../../../../components/SelectPrompt';
import { generateStrategy } from '../../generate-strategy';
import { STRATEGY_PRESETS } from '../../presets/data';
import { GenerationState, useWizard } from '../wizard-context';
import { StreamingGenerationStep } from './StreamingGenerationStep';
import { TextPrompt } from '../../../../components/TextPrompt';

export interface StrategyStepResult {
  strategyContent: string;
}

type SubStep = 'preset' | 'custom' | 'generate';

const selectItems = [
  ...STRATEGY_PRESETS.map((p) => ({
    label: p.name,
    value: p.name,
    description: p.philosophy,
  })),
  { label: 'Custom', value: '__custom__', description: 'Write your own prompt from scratch' },
];

export function StrategyStep(): React.ReactElement {
  const { state, dispatch } = useWizard();
  const { apiConfig, identity, strategy } = state;
  const [subStep, setSubStep] = useState<SubStep>('preset');

  const defaultPreset = selectItems.find((item) => item.value === strategy.input);

  const handlePreset = useCallback(
    (item: { value: string }) => {
      if (item.value === '__custom__') {
        setSubStep('custom');
        return;
      }
      const preset = STRATEGY_PRESETS.find((p) => p.name === item.value);
      if (!preset) return;

      const input = preset.name;

      const payload: Partial<GenerationState> = { input: preset.name };
      if (input !== strategy.input) {
        payload.draft = '';
        payload.content = '';
      }

      dispatch({ type: 'UPDATE_STRATEGY', payload });
      setSubStep('generate');
    },
    [dispatch, strategy.input],
  );

  const handleCustom = useCallback(
    (value: string) => {
      const payload: Partial<GenerationState> = { input: value };
      if (value !== strategy.input) {
        payload.draft = '';
        payload.content = '';
      }
      dispatch({ type: 'UPDATE_STRATEGY', payload });
      setSubStep('generate');
    },
    [dispatch, strategy.input],
  );

  const handleComplete = useCallback(
    (strategyContent: string) => {
      dispatch({
        type: 'SET_STRATEGY',
        payload: {
          content: strategyContent,
          draft: '',
          input: '',
        },
      });
    },
    [dispatch],
  );

  const handleGenerateBack = useCallback(
    (draft?: string) => {
      if (draft) dispatch({ type: 'UPDATE_STRATEGY', payload: { draft } });
      setSubStep('preset');
    },
    [dispatch],
  );

  const createStream = useCallback(
    (prompt: string, feedback?: string) =>
      generateStrategy({
        providerId: apiConfig.providerId!,
        agentName: identity.name,
        apiKey: apiConfig.apiKey,
        strategy: prompt,
        feedback,
      }),
    [apiConfig.providerId, apiConfig.apiKey, identity.name],
  );

  return (
    <Box flexDirection="column">
      {subStep === 'preset' && (
        <SelectPrompt
          label="Choose a strategy preset or write your own"
          items={selectItems}
          defaultValue={defaultPreset?.value}
          onSelect={handlePreset}
          onBack={() => dispatch({ type: 'GO_BACK' })}
        />
      )}
      {subStep === 'custom' && (
        <TextPrompt
          label="Describe your agent's decision framework and trading approach"
          placeholder="e.g. technical analysis focused, uses RSI and MACD, conservative with short timeframes"
          defaultValue={strategy.input || undefined}
          onSubmit={handleCustom}
          onBack={() => setSubStep('preset')}
        />
      )}

      {subStep === 'generate' && (
        <StreamingGenerationStep
          title="STRATEGY.md"
          input={strategy.input}
          initialContent={strategy.draft || strategy.content}
          createStream={createStream}
          onBack={handleGenerateBack}
          onComplete={handleComplete}
        />
      )}
    </Box>
  );
}
