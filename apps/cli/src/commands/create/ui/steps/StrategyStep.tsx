import React, { useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import type { MultiSelectItem } from '../../../../components/MultiSelectPrompt.js';
import { MultiSelectPrompt } from '../../../../components/MultiSelectPrompt.js';
import { StreamingGenerationStep } from './StreamingGenerationStep.js';
import { generateStrategy } from '../../generate-strategy.js';
import { SECTOR_OPTIONS, TIMEFRAME_OPTIONS, DEFAULT_SECTOR_VALUES } from '../../presets/options.js';
import { colors, symbols } from '../../../shared/theme.js';
import { useWizard } from '../wizard-context.js';
import { SelectPrompt } from '../../../../components/SelectPrompt.js';
import { STRATEGY_PRESETS } from '../../presets/data.js';

export interface StrategyStepResult {
  strategyContent: string;
  sectors: string[];
  timeframes: string[];
}

type SubStep = 'sectors' | 'timeframes' | 'select' | 'generate';

const ALL_TIMEFRAME_VALUES = new Set(TIMEFRAME_OPTIONS.map((t) => t.value));

export function StrategyStep(): React.ReactElement {
  const { state, dispatch } = useWizard();
  const { apiConfig, identity, strategy } = state;

  const hasSectors = strategy.sectors.length > 0;
  const hasTimeframes = strategy.timeframes.length > 0;

  const [subStep, setSubStep] = useState<SubStep>(
    hasSectors && hasTimeframes
      ? strategy.content || strategy.draft
        ? 'generate'
        : 'select'
      : hasSectors
        ? 'timeframes'
        : 'sectors',
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

  const handleSectorsSubmit = useCallback(
    (selected: MultiSelectItem[]) => {
      dispatch({ type: 'UPDATE_STRATEGY', payload: { sectors: selected.map((s) => s.value) } });
      setSubStep('timeframes');
    },
    [dispatch],
  );

  const handleTimeframesSubmit = useCallback(
    (selected: MultiSelectItem[]) => {
      dispatch({ type: 'UPDATE_STRATEGY', payload: { timeframes: selected.map((t) => t.value) } });
      setSubStep('select');
    },
    [dispatch],
  );

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
          sectors: strategy.sectors,
          timeframes: strategy.timeframes,
        },
      });
    },
    [dispatch, strategy.sectors, strategy.timeframes],
  );

  const handleGenerateBack = useCallback(
    (draft?: string, prompt?: string) => {
      if (draft) dispatch({ type: 'UPDATE_STRATEGY', payload: { draft } });
      if (prompt) dispatch({ type: 'UPDATE_STRATEGY', payload: { prompt } });
      setSubStep('timeframes');
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
          sectors: strategy.sectors,
          timeframes: strategy.timeframes,
          decisionFramework: prompt,
        },
        feedback,
      }),
    [
      apiConfig.providerId,
      apiConfig.apiKey,
      identity.name,
      identity.bio,
      strategy.sectors,
      strategy.timeframes,
    ],
  );

  const defaultSectors =
    strategy.sectors.length > 0 ? new Set(strategy.sectors) : DEFAULT_SECTOR_VALUES;
  const defaultTimeframes =
    strategy.timeframes.length > 0 ? new Set(strategy.timeframes) : ALL_TIMEFRAME_VALUES;
  const initialContent = strategy.content || strategy.draft || undefined;

  return (
    <Box flexDirection="column">
      {/* Summary card */}
      {(strategy.sectors.length > 0 || strategy.timeframes.length > 0) && (
        <Box flexDirection="column" marginLeft={2} marginBottom={1}>
          {strategy.sectors.length > 0 && (
            <Text color={colors.gray}>
              {symbols.check} Sectors:{' '}
              <Text color={colors.honey}>{strategy.sectors.join(', ')}</Text>
            </Text>
          )}
          {strategy.timeframes.length > 0 && (
            <Text color={colors.gray}>
              {symbols.check} Timeframes:{' '}
              <Text color={colors.honey}>{strategy.timeframes.join(', ')}</Text>
            </Text>
          )}
        </Box>
      )}

      {subStep === 'sectors' && (
        <MultiSelectPrompt
          label="Select sectors to cover"
          items={SECTOR_OPTIONS}
          defaultSelected={defaultSectors}
          onSubmit={handleSectorsSubmit}
          onBack={() => dispatch({ type: 'GO_BACK' })}
        />
      )}

      {subStep === 'timeframes' && (
        <MultiSelectPrompt
          label="Select prediction timeframes"
          items={TIMEFRAME_OPTIONS}
          defaultSelected={defaultTimeframes}
          onSubmit={handleTimeframesSubmit}
          onBack={() => setSubStep('sectors')}
        />
      )}

      {/* once user generated first draft, user can edit the prompt though feedback so no need to comeback at this step */}
      {subStep === 'select' && !initialContent && (
        <SelectPrompt
          label="Choose a strategy preset or write your own"
          items={selectItems}
          onSelect={handleSelect}
          onBack={() => setSubStep('timeframes')}
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
