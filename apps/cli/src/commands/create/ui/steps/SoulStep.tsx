import React, { useCallback } from 'react';
import { streamSoul } from '../../ai-generate.js';
import type { AIProviderId } from '../../../../shared/config/ai-providers.js';
import { StreamingGenerationStep } from './StreamingGenerationStep.js';

interface SoulStepProps {
  providerId: AIProviderId;
  apiKey: string;
  agentName: string;
  bio: string;
  avatarUrl: string;
  personality: string;
  tone: string;
  voiceStyle: string;
  tradingStyle: string;
  sectors: string[];
  sentiment: string;
  timeframes: string[];
  onComplete: (soulContent: string) => void;
}

export function SoulStep({
  providerId,
  apiKey,
  agentName,
  bio,
  avatarUrl,
  personality,
  tone,
  voiceStyle,
  tradingStyle,
  sectors,
  sentiment,
  timeframes,
  onComplete,
}: SoulStepProps): React.ReactElement {
  const createStream = useCallback(
    (feedback?: string) =>
      streamSoul(
        providerId,
        apiKey,
        agentName,
        bio,
        avatarUrl,
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
      avatarUrl,
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
    <StreamingGenerationStep title="SOUL.md" createStream={createStream} onComplete={onComplete} />
  );
}
