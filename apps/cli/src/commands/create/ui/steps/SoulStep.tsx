import React, { useCallback } from 'react';
import type { AIProviderId } from '../../../../shared/config/ai-providers.js';
import { StreamingGenerationStep } from './StreamingGenerationStep.js';
import { streamSoul } from '../../generate-soul.js';

interface SoulStepProps {
  providerId: AIProviderId;
  apiKey: string;
  agentName: string;
  bio: string;
  initialContent?: string;
  initialPrompt?: string;
  onBack?: (draft?: string, prompt?: string) => void;
  onComplete: (soulContent: string) => void;
}

export function SoulStep({
  providerId,
  apiKey,
  agentName,
  bio,
  initialContent,
  initialPrompt,
  onBack,
  onComplete,
}: SoulStepProps): React.ReactElement {
  const createStream = useCallback(
    (prompt: string, feedback?: string) =>
      streamSoul(providerId, apiKey, agentName, bio, prompt, feedback),
    [providerId, apiKey, agentName, bio],
  );

  return (
    <StreamingGenerationStep
      title="SOUL.md"
      initialContent={initialContent}
      initialPrompt={initialPrompt}
      promptLabel="Describe your agent's personality, voice, and conviction style"
      promptPlaceholder="e.g. stoic realist with dry wit, speaks in short punchy sentences, high conviction trader"
      createStream={createStream}
      onBack={onBack}
      onComplete={onComplete}
    />
  );
}
