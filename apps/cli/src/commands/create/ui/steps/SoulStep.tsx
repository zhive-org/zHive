import React, { useCallback } from 'react';
import { StreamingGenerationStep } from './StreamingGenerationStep.js';
import { generateSoul } from '../../generate-soul.js';
import { useWizard } from '../wizard-context.js';

export function SoulStep(): React.ReactElement {
  const { state, dispatch } = useWizard();
  const { apiConfig, identity, soul } = state;

  const createStream = useCallback(
    (prompt: string, feedback?: string) =>
      generateSoul({
        providerId: apiConfig.providerId!,
        agent: { agentName: identity.name, bio: identity.bio },
        apiKey: apiConfig.apiKey,
        feedback,
        initialPrompt: prompt,
      }),
    [apiConfig.providerId, apiConfig.apiKey, identity.name, identity.bio],
  );

  return (
    <StreamingGenerationStep
      title="SOUL.md"
      initialContent={soul.content || soul.draft || undefined}
      initialPrompt={soul.prompt || undefined}
      promptLabel="Describe your agent's personality, voice, and conviction style"
      promptPlaceholder="e.g. stoic realist with dry wit, speaks in short punchy sentences, high conviction trader"
      createStream={createStream}
      onBack={(draft, prompt) =>
        dispatch({ type: 'SAVE_SOUL_DRAFT', payload: { draft, prompt } })
      }
      onComplete={(content) => dispatch({ type: 'SET_SOUL', content })}
    />
  );
}
