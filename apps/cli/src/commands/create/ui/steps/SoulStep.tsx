import React, { useState, useCallback } from 'react';
import { StreamingGenerationStep } from './StreamingGenerationStep.js';
import { generateSoul } from '../../generate-soul.js';
import { useWizard } from '../wizard-context.js';
import { SelectPrompt } from '../../../../components/SelectPrompt.js';
import { SOUL_PRESETS } from '../../presets/data.js';

type SubStep = 'select' | 'generate';

export function SoulStep(): React.ReactElement {
  const { state, dispatch } = useWizard();
  const { apiConfig, identity, soul } = state;

  const hasContent = !!(soul.content || soul.draft);

  const [subStep, setSubStep] = useState<SubStep>(hasContent ? 'generate' : 'select');
  const [autoGenerate, setAutoGenerate] = useState(false);

  const selectItems = [
    ...SOUL_PRESETS.map((p) => ({
      label: p.name,
      value: p.name,
      description: p.personalityTag,
    })),
    { label: 'Custom', value: '__custom__', description: 'Write your own prompt from scratch' },
  ];

  const handleSelect = useCallback(
    (item: { value: string }) => {
      if (item.value === '__custom__') {
        setAutoGenerate(false);
        setSubStep('generate');
        return;
      }
      const preset = SOUL_PRESETS.find((p) => p.name === item.value);
      if (!preset) return;
      const prompt = `${preset.personalityTag} Tone: ${preset.tone}. Style: ${preset.style}.`;
      dispatch({
        type: 'UPDATE_SOUL',
        payload: { prompt, draft: '' },
      });
      setAutoGenerate(true);
      setSubStep('generate');
    },
    [dispatch],
  );

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

  const initialContent = soul.content || soul.draft || undefined;

  return (
    <>
      {/* once user generated first draft, user can edit the prompt though feedback so no need to comeback at this step */}
      {subStep === 'select' && !initialContent && (
        <SelectPrompt
          label="Choose a personality preset or write your own"
          items={selectItems}
          onSelect={handleSelect}
          onBack={() => dispatch({ type: 'GO_BACK' })}
        />
      )}

      {subStep === 'generate' && (
        <StreamingGenerationStep
          title="SOUL.md"
          initialContent={initialContent}
          initialPrompt={soul.prompt}
          autoGenerate={autoGenerate}
          promptLabel="Describe your agent's personality, voice, and conviction style"
          promptPlaceholder="e.g. stoic realist with dry wit, speaks in short punchy sentences, high conviction trader"
          createStream={createStream}
          onBack={(draft, prompt) => {
            dispatch({ type: 'UPDATE_SOUL', payload: { draft, prompt } });
            dispatch({ type: 'GO_BACK' });
          }}
          onComplete={(content) => dispatch({ type: 'SET_SOUL', content })}
        />
      )}
    </>
  );
}
