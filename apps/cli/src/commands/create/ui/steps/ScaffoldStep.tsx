import React, { useState, useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import { HoneycombLoader } from '../../../../components/HoneycombLoader.js';
import { colors, symbols, border } from '../../../shared/theme.js';
import { scaffoldProject } from '../../generate.js';
import type { AIProvider } from '../../../../shared/config/ai-providers.js';
import { extractErrorMessage } from '../../../../shared/agent/utils.js';

const DEFAULT_SENTIMENT = 'neutral';

interface ScaffoldStepProps {
  projectName: string;
  provider: AIProvider;
  apiKey: string;
  bio: string;
  avatarUrl: string;
  soulContent: string;
  strategyContent: string;
  sectors: string[];
  timeframes: string[];
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
  avatarUrl,
  bio,
  sectors,
  timeframes,
  onError,
}: ScaffoldStepProps): React.ReactElement {
  const { exit } = useApp();
  const [steps, setSteps] = useState<StepStatus[]>([]);
  const [currentLabel, setCurrentLabel] = useState('Starting...');
  const [projectDir, setProjectDir] = useState('');
  const [done, setDone] = useState(false);

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
        onDone: (dir: string) => {
          if (cancelled) return;
          setSteps((prev) => {
            if (prev.length > 0) {
              const updated = [...prev];
              updated[updated.length - 1] = { ...updated[updated.length - 1], done: true };
              return updated;
            }
            return prev;
          });
          setProjectDir(dir);
          setDone(true);
        },
        onError: (message: string) => {
          if (cancelled) return;
          onError(message);
        },
      };
      await scaffoldProject({
        agent: {
          name: projectName,
          avatarUrl,
          bio,
          sectors,
          sentiment: DEFAULT_SENTIMENT,
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
  }, [projectName, provider, apiKey, soulContent, strategyContent, avatarUrl, bio, sectors, timeframes, onError]);

  useEffect(() => {
    if (done) {
      exit();
    }
  }, [done, exit]);

  if (done) {
    const termWidth = process.stdout.columns || 60;
    const boxWidth = Math.min(termWidth - 4, 60);
    const line = border.horizontal.repeat(boxWidth - 2);

    return (
      <Box flexDirection="column">
        {steps.map((step, i) => (
          <Box key={i} marginLeft={2}>
            <Text color={colors.green}>
              {symbols.check} {step.label}
            </Text>
          </Box>
        ))}

        <Box flexDirection="column" marginLeft={2} marginTop={1}>
          <Box>
            <Text color={colors.honey}>
              {border.topLeft}
              {line}
              {border.topRight}
            </Text>
          </Box>
          <Box>
            <Text color={colors.honey}>{border.vertical}</Text>
            <Text> </Text>
            <Text color={colors.honey} bold>
              {symbols.hive} Agent created successfully!
            </Text>
            <Text>{' '.repeat(Math.max(0, boxWidth - 32))}</Text>
            <Text color={colors.honey}>{border.vertical}</Text>
          </Box>
          <Box>
            <Text color={colors.honey}>
              {border.bottomLeft}
              {line}
              {border.bottomRight}
            </Text>
          </Box>

          <Box flexDirection="column" marginTop={1} marginLeft={1}>
            <Text color={colors.white} bold>
              Next steps:
            </Text>
            <Box marginTop={1} flexDirection="column">
              <Text color={colors.gray}>
                {' '}
                1. <Text color={colors.white}>npx @zhive/cli@latest start</Text>
              </Text>
            </Box>
            <Box marginTop={1} flexDirection="column">
              <Text color={colors.grayDim}>
                {' '}
                Fine-tune SOUL.md and STRATEGY.md by chatting with your agent during
              </Text>
              <Text color={colors.grayDim}> a run, or edit them directly at:</Text>
              <Text color={colors.grayDim}>
                {' '}
                <Text color={colors.white}>{projectDir}</Text>
              </Text>
            </Box>
          </Box>
        </Box>
      </Box>
    );
  }

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
