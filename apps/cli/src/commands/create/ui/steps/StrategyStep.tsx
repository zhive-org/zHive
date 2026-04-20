import { Box } from 'ink';
import React, { useCallback, useState } from 'react';
import { SelectPrompt } from '../../../../components/SelectPrompt';
import { generateStrategy } from '../../generate-strategy';
import { STRATEGY_PRESETS } from '../../presets/data';
import { useWizard } from '../wizard-context';
import { StreamingGenerationStep } from './StreamingGenerationStep';

export interface StrategyStepResult {
  strategyContent: string;
}

type SubStep = 'preset' | 'generate';

export function StrategyStep(): React.ReactElement {
  const { state, dispatch } = useWizard();
  const { apiConfig, identity, strategy } = state;

  const [subStep, setSubStep] = useState<SubStep>(
    strategy.content || strategy.draft ? 'generate' : 'preset',
  );
  const [autoGenerate, setAutoGenerate] = useState(false);

  const selectItems = [
    ...STRATEGY_PRESETS.map((p) => ({
      label: p.name,
      value: p.name,
      description: p.philosophy,
    })),
    { label: 'Custom', value: '__custom__', description: 'Write your own prompt from scratch' },
  ];

  const initialContent = strategy.content || strategy.draft || undefined;

  const handleSelect = useCallback(
    (item: { value: string }) => {
      if (item.value === '__custom__') {
        dispatch({ type: 'UPDATE_STRATEGY', payload: { prompt: '', draft: '' } });
        setAutoGenerate(false);
        setSubStep('generate');
        return;
      }
      const preset = STRATEGY_PRESETS.find((p) => p.name === item.value);
      if (!preset) return;
      const prompt = `${preset.philosophy} ${preset.decisionSteps.map((s, i) => `${i + 1}. ${s}`).join(' ')}`;
      dispatch({ type: 'UPDATE_STRATEGY', payload: { prompt, draft: '' } });
      setAutoGenerate(true);
      setSubStep('generate');
    },
    [dispatch],
  );

  const handleComplete = useCallback(
    (strategyContent: string) => {
      dispatch({
        type: 'SET_STRATEGY',
        payload: {
          content: strategyContent,
          draft: '',
          prompt: '',
        },
      });
    },
    [dispatch],
  );

  const handleGenerateBack = useCallback(
    (draft?: string, prompt?: string) => {
      if (draft) dispatch({ type: 'UPDATE_STRATEGY', payload: { draft } });
      if (prompt) dispatch({ type: 'UPDATE_STRATEGY', payload: { prompt } });
      dispatch({ type: 'GO_BACK' });
    },
    [dispatch],
  );

  const createStream = useCallback(
    (prompt: string, feedback?: string) =>
      generateStrategy({
        providerId: apiConfig.providerId!,
        agent: {
          agentName: identity.name,
          bio: identity.bio,
        },
        apiKey: apiConfig.apiKey,
        strategy: {
          decisionFramework: prompt,
        },
        feedback,
      }),
    [apiConfig.providerId, apiConfig.apiKey, identity.name, identity.bio],
  );

  return (
    <Box flexDirection="column">
      {/* once user generated first draft, user can edit the prompt though feedback so no need to comeback at this step */}
      {subStep === 'preset' && !initialContent && (
        <SelectPrompt
          label="Choose a strategy preset or write your own"
          items={selectItems}
          onSelect={handleSelect}
          onBack={() => setSubStep('generate')}
        />
      )}

      {subStep === 'generate' && (
        <StreamingGenerationStep
          title="STRATEGY.md"
          initialContent={initialContent}
          initialPrompt={strategy.prompt || undefined}
          autoGenerate={autoGenerate}
          promptLabel="Describe your agent's decision framework and trading approach"
          promptPlaceholder="e.g. technical analysis focused, uses RSI and MACD, conservative with short timeframes"
          createStream={createStream}
          onBack={handleGenerateBack}
          onComplete={handleComplete}
        />
      )}
    </Box>
  );
}
