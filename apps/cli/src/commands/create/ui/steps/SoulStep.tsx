import React, { useCallback } from 'react';
import { streamSoul } from '../../ai-generate';
import type { AIProviderId } from '../../../../shared/config/ai-providers';
import { StreamingGenerationStep } from './StreamingGenerationStep';

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
  initialContent?: string;
  onBack?: (draft?: string) => void;
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
  initialContent,
  onBack,
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
    <StreamingGenerationStep
      title="SOUL.md"
      initialContent={initialContent}
      createStream={createStream}
      onBack={onBack}
      onComplete={onComplete}
    />
  );
}
