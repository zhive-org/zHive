import React, { useCallback } from 'react';
import { streamStrategy } from '../../ai-generate';
import type { AIProviderId } from '../../../../shared/config/ai-providers';
import { StreamingGenerationStep } from './StreamingGenerationStep';

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
  initialContent?: string;
  onBack?: (draft?: string) => void;
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
  initialContent,
  onBack,
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
      initialContent={initialContent}
      createStream={createStream}
      onBack={onBack}
      onComplete={onComplete}
    />
  );
}
