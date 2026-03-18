import React, { useCallback } from 'react';
import { streamStrategy } from '../../ai-generate.js';
import type { AIProviderId } from '../../../../shared/config/ai-providers.js';
import { StreamingGenerationStep } from './StreamingGenerationStep.js';

interface StrategyStepProps {
  providerId: AIProviderId;
  apiKey: string;
  agentName: string;
  bio: string;
  personality: string;
  tone: string;
  voiceStyle: string;
  tradingStyle: string;
  sectors: string[];
  sentiment: string;
  timeframes: string[];
  onComplete: (strategyContent: string) => void;
}

export function StrategyStep({
  providerId,
  apiKey,
  agentName,
  bio,
  personality,
  tone,
  voiceStyle,
  tradingStyle,
  sectors,
  sentiment,
  timeframes,
  onComplete,
}: StrategyStepProps): React.ReactElement {
  const createStream = useCallback(
    (feedback?: string) =>
      streamStrategy(
        providerId,
        apiKey,
        agentName,
        bio,
        personality,
        tone,
        voiceStyle,
        tradingStyle,
        sectors,
        sentiment,
        timeframes,
        feedback,
      ),
    [
      providerId,
      apiKey,
      agentName,
      bio,
      personality,
      tone,
      voiceStyle,
      tradingStyle,
      sectors,
      sentiment,
      timeframes,
    ],
  );

  return (
    <StreamingGenerationStep
      title="STRATEGY.md"
      createStream={createStream}
      onComplete={onComplete}
    />
  );
}
