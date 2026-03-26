import React, { useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import type { AIProviderId } from '../../../../shared/config/ai-providers.js';
import type { MultiSelectItem } from '../../../../components/MultiSelectPrompt.js';
import { MultiSelectPrompt } from '../../../../components/MultiSelectPrompt.js';
import { StreamingGenerationStep } from './StreamingGenerationStep.js';
import { streamStrategy } from '../../generate-strategy.js';
import { SECTOR_OPTIONS, TIMEFRAME_OPTIONS, DEFAULT_SECTOR_VALUES } from '../../presets/options.js';
import { colors, symbols } from '../../../shared/theme.js';

export interface StrategyStepResult {
  strategyContent: string;
  sectors: string[];
  timeframes: string[];
}

interface StrategyStepProps {
  providerId: AIProviderId;
  apiKey: string;
  agentName: string;
  bio: string;
  initialContent?: string;
  initialPrompt?: string;
  initialSectors?: string[];
  initialTimeframes?: string[];
  onBack?: (draft?: string, prompt?: string) => void;
  onComplete: (result: StrategyStepResult) => void;
}

type SubStep = 'sectors' | 'timeframes' | 'generate';

const ALL_TIMEFRAME_VALUES = new Set(TIMEFRAME_OPTIONS.map((t) => t.value));

export function StrategyStep({
  providerId,
  apiKey,
  agentName,
  bio,
  initialContent,
  initialPrompt,
  initialSectors,
  initialTimeframes,
  onBack,
  onComplete,
}: StrategyStepProps): React.ReactElement {
  const [subStep, setSubStep] = useState<SubStep>('sectors');
  const [sectors, setSectors] = useState<string[]>(initialSectors ?? []);
  const [timeframes, setTimeframes] = useState<string[]>(initialTimeframes ?? []);

  const handleSectorsSubmit = useCallback((selected: MultiSelectItem[]) => {
    setSectors(selected.map((s) => s.value));
    setSubStep('timeframes');
  }, []);

  const handleTimeframesSubmit = useCallback((selected: MultiSelectItem[]) => {
    setTimeframes(selected.map((t) => t.value));
    setSubStep('generate');
  }, []);

  const handleGenerateBack = useCallback(
    (draft?: string, prompt?: string) => {
      if (draft && initialContent === undefined) {
        // preserve draft only if we didn't already have content
      }
      if (prompt && initialPrompt === undefined) {
        // same for prompt
      }
      setSubStep('timeframes');
    },
    [initialContent, initialPrompt],
  );

  const handleGenerateComplete = useCallback(
    (strategyContent: string) => {
      onComplete({ strategyContent, sectors, timeframes });
    },
    [onComplete, sectors, timeframes],
  );

  const createStream = useCallback(
    (prompt: string, feedback?: string) =>
      streamStrategy(providerId, apiKey, agentName, bio, prompt, sectors, timeframes, feedback),
    [providerId, apiKey, agentName, bio, sectors, timeframes],
  );

  const defaultSectors = initialSectors
    ? new Set(initialSectors)
    : DEFAULT_SECTOR_VALUES;

  const defaultTimeframes = initialTimeframes
    ? new Set(initialTimeframes)
    : ALL_TIMEFRAME_VALUES;

  return (
    <Box flexDirection="column">
      {/* Summary card */}
      {(sectors.length > 0 || timeframes.length > 0) && (
        <Box flexDirection="column" marginLeft={2} marginBottom={1}>
          {sectors.length > 0 && (
            <Text color={colors.gray}>
              {symbols.check} Sectors:{' '}
              <Text color={colors.honey}>{sectors.join(', ')}</Text>
            </Text>
          )}
          {timeframes.length > 0 && (
            <Text color={colors.gray}>
              {symbols.check} Timeframes:{' '}
              <Text color={colors.honey}>{timeframes.join(', ')}</Text>
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
          onBack={onBack ? () => onBack() : undefined}
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

      {subStep === 'generate' && (
        <StreamingGenerationStep
          title="STRATEGY.md"
          initialContent={initialContent}
          initialPrompt={initialPrompt}
          promptLabel="Describe your agent's decision framework and trading approach"
          promptPlaceholder="e.g. technical analysis focused, uses RSI and MACD, conservative with short timeframes"
          createStream={createStream}
          onBack={handleGenerateBack}
          onComplete={handleGenerateComplete}
        />
      )}
    </Box>
  );
}
