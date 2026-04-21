import React, { useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import { StreamingText } from '../../../../components/StreamingText';
import { TextPrompt } from '../../../../components/TextPrompt';
import { CodeBlock } from '../../../../components/CodeBlock';
import { Spinner } from '../../../../components/Spinner';
import { colors, symbols } from '../../../shared/theme';

interface StreamingGenerationStepProps {
  title: string;
  initialContent?: string;
  input: string;
  createStream: (initialPrompt: string, feedback?: string) => AsyncIterable<string>;
  onBack?: (draft?: string) => void;
  onComplete: (content: string) => void;
}

type Phase = 'streaming' | 'review' | 'error';

export function StreamingGenerationStep({
  title,
  createStream,
  input,
  onComplete,
  initialContent,
  onBack,
}: StreamingGenerationStepProps): React.ReactElement {
  const [phase, setPhase] = useState<Phase>(initialContent ? 'review' : 'streaming');
  const [draft, setDraft] = useState(initialContent);
  const [errorMessage, setErrorMessage] = useState('');
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [currentStream, setCurrentStream] = useState<AsyncIterable<string> | null>(() =>
    !draft ? createStream(input) : null,
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
    if (!draft) {
      return;
    }

    onComplete(draft);
  }, [draft, onComplete]);

  const handleRetry = useCallback(
    (feedback?: string) => {
      setFeedbackCount((prev) => prev + 1);
      setPhase('streaming');
      setDraft('');
      setErrorMessage('');
      const newStream = createStream(input, feedback);
      setCurrentStream(newStream);
    },
    [createStream, input],
  );

  return (
    <Box flexDirection="column">
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
              onBack={() => onBack?.(draft)}
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
          <CodeBlock title={title}>{draft ?? ''}</CodeBlock>
          <Box marginTop={1}>
            <Text color={colors.gray}>
              Press{' '}
              <Text color={colors.honey} bold>
                Enter
              </Text>{' '}
              to accept {symbols.dot} Type feedback to regenerate {symbols.dot}{' '}
              <Text color={colors.honey} bold>
                ↑↓
              </Text>{' '}
              to scroll
            </Text>
          </Box>
          <Box marginTop={1}>
            <TextPrompt
              label=""
              placeholder="Enter to accept, or type feedback..."
              onBack={() => onBack?.(draft)}
              onSubmit={(val) => {
                if (!val) {
                  handleAccept();
                } else {
                  handleRetry(val);
                }
              }}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
}
