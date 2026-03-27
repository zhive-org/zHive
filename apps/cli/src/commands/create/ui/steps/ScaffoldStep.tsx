import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { HoneycombLoader } from '../../../../components/HoneycombLoader';
import { colors, symbols } from '../../../shared/theme';
import { scaffoldProject } from '../../generate';
import type { AIProvider } from '../../../../shared/config/ai-providers';
import { extractErrorMessage } from '../../../../shared/agent/utils';

interface ScaffoldStepProps {
  projectName: string;
  provider: AIProvider;
  avatarUrl: string;
  sectors: string[];
  timeframes: string[];
  sentiment: string;
  apiKey: string;
  soulContent: string;
  bio: string;
  strategyContent: string;
  onComplete: (projectDir: string) => void;
  onError: (message: string) => void;
}

interface StepStatus {
  label: string;
  done: boolean;
}

export function ScaffoldStep({
  projectName,
  provider,
  apiKey,
  soulContent,
  strategyContent,
  onComplete,
  avatarUrl,
  sectors,
  sentiment,
  timeframes,
  bio,
  onError,
}: ScaffoldStepProps): React.ReactElement {
  const [steps, setSteps] = useState<StepStatus[]>([]);
  const [currentLabel, setCurrentLabel] = useState('Starting...');

  useEffect(() => {
    let cancelled = false;

    const run = async (): Promise<void> => {
      const callbacks = {
        onStep: (label: string) => {
          if (cancelled) return;
          setSteps((prev) => {
            if (prev.length > 0) {
              const updated = [...prev];
              updated[updated.length - 1] = { ...updated[updated.length - 1], done: true };
              return [...updated, { label, done: false }];
            }
            return [{ label, done: false }];
          });
          setCurrentLabel(label);
        },
        onDone: (projectDir: string) => {
          if (cancelled) return;
          setSteps((prev) => {
            if (prev.length > 0) {
              const updated = [...prev];
              updated[updated.length - 1] = { ...updated[updated.length - 1], done: true };
              return updated;
            }
            return prev;
          });
          onComplete(projectDir);
        },
        onError: (message: string) => {
          if (cancelled) return;
          onError(message);
        },
      };
      await scaffoldProject({
        agent: {
          name: projectName,
          avatarUrl: avatarUrl,
          bio,
          sectors,
          sentiment,
          timeframes,
        },
        callbacks,
        provider,
        apiKey,
        soulContent,
        strategyContent,
      });
    };

    run().catch((err: unknown) => {
      if (cancelled) return;
      const message = extractErrorMessage(err);
      onError(message);
    });

    return () => {
      cancelled = true;
    };
  }, [projectName, provider, apiKey, soulContent, strategyContent, onComplete, onError]);

  return (
    <Box flexDirection="column">
      {steps.map((step, i) => (
        <Box key={i} marginLeft={2}>
          {step.done ? (
            <Text color={colors.green}>
              {symbols.check} {step.label}
            </Text>
          ) : (
            <HoneycombLoader label={step.label} />
          )}
        </Box>
      ))}
      {steps.length === 0 && (
        <Box marginLeft={2}>
          <HoneycombLoader label={currentLabel} />
        </Box>
      )}
    </Box>
  );
}
