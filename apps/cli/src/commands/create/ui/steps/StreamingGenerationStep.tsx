import React, { useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import { StreamingText } from '../../../../components/StreamingText.js';
import { TextPrompt } from '../../../../components/TextPrompt.js';
import { CodeBlock } from '../../../../components/CodeBlock.js';
import { Spinner } from '../../../../components/Spinner.js';
import { colors, symbols } from '../../../shared/theme.js';
import { required } from '../../validation.js';

interface StreamingGenerationStepProps {
  title: string;
  initialContent?: string;
  initialPrompt?: string;
  promptLabel: string;
  promptPlaceholder: string;
  createStream: (initialPrompt: string, feedback?: string) => AsyncIterable<string>;
  onBack?: (draft?: string, prompt?: string) => void;
  onComplete: (content: string) => void;
}

type Phase = 'prompt-input' | 'streaming' | 'review' | 'error';

export function StreamingGenerationStep({
  title,
  initialContent,
  initialPrompt: savedPrompt,
  promptLabel,
  promptPlaceholder,
  createStream,
  onBack,
  onComplete,
}: StreamingGenerationStepProps): React.ReactElement {
  const [phase, setPhase] = useState<Phase>(initialContent ? 'review' : 'prompt-input');
  const [prompt, setPrompt] = useState(savedPrompt ?? '');
  const [draft, setDraft] = useState(initialContent ?? '');
  const [errorMessage, setErrorMessage] = useState('');
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [currentStream, setCurrentStream] = useState<AsyncIterable<string> | null>(null);

  const handlePromptSubmit = useCallback(
    (value: string) => {
      setPrompt(value);
      setPhase('streaming');
      setCurrentStream(createStream(value));
    },
    [createStream],
  );

  const handleStreamComplete = useCallback((fullText: string) => {
    const trimmed = fullText.trim();
    if (trimmed.length === 0) {
      setErrorMessage('LLM returned empty content. Try regenerating.');
      setPhase('error');
      return;
    }
    setDraft(trimmed);
    setPhase('review');
  }, []);

  const handleStreamError = useCallback((error: string) => {
    setErrorMessage(error);
    setPhase('error');
  }, []);

  const handleAccept = useCallback(() => {
    onComplete(draft);
  }, [draft, onComplete]);

  const handleRetry = useCallback(() => {
    setFeedbackCount((prev) => prev + 1);
    setPhase('streaming');
    setDraft('');
    setErrorMessage('');
    const newStream = createStream(prompt);
    setCurrentStream(newStream);
  }, [createStream, prompt]);

  const handleFeedback = useCallback(
    (feedback: string) => {
      setFeedbackCount((prev) => prev + 1);
      setPhase('streaming');
      setDraft('');
      setErrorMessage('');
      const newStream = createStream(prompt, feedback);
      setCurrentStream(newStream);
    },
    [createStream, prompt],
  );

  return (
    <Box flexDirection="column">
      {phase === 'prompt-input' && (
        <Box flexDirection="column">
          <TextPrompt
            label={promptLabel}
            placeholder={promptPlaceholder}
            defaultValue={prompt || undefined}
            onBack={() => onBack?.(draft, prompt)}
            onSubmit={handlePromptSubmit}
            validate={required(title)}
          />
        </Box>
      )}

      {phase === 'streaming' && currentStream && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Spinner
              label={feedbackCount > 0 ? `Regenerating ${title}...` : `Generating ${title}...`}
            />
          </Box>
          <StreamingText
            stream={currentStream}
            title={title}
            onComplete={handleStreamComplete}
            onError={handleStreamError}
          />
        </Box>
      )}

      {phase === 'error' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color={colors.red}>{symbols.cross} </Text>
            <Text color={colors.white}>Failed to generate {title}</Text>
          </Box>
          <Box marginLeft={2} marginBottom={1}>
            <Text color={colors.red}>{errorMessage}</Text>
          </Box>
          <Box marginLeft={2}>
            <Text color={colors.gray}>
              Press{' '}
              <Text color={colors.honey} bold>
                Enter
              </Text>{' '}
              to retry
            </Text>
          </Box>
          <Box marginTop={1}>
            <TextPrompt
              label=""
              placeholder="Enter to retry..."
              onSubmit={() => handleRetry()}
              onBack={() => onBack?.(draft, prompt)}
            />
          </Box>
        </Box>
      )}

      {phase === 'review' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text color={colors.green}>{symbols.check} </Text>
            <Text color={colors.white}>{title} draft ready</Text>
          </Box>
          <CodeBlock title={title}>{draft}</CodeBlock>
          <Box marginTop={1}>
            <Text color={colors.gray}>
              Press{' '}
              <Text color={colors.honey} bold>
                Enter
              </Text>{' '}
              to accept {symbols.dot} Type feedback to regenerate
            </Text>
          </Box>
          <Box marginTop={1}>
            <TextPrompt
              label=""
              placeholder="Enter to accept, or type feedback..."
              onBack={() => onBack?.(draft, prompt)}
              onSubmit={(val) => {
                if (!val) {
                  handleAccept();
                } else {
                  handleFeedback(val);
                }
              }}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
}
