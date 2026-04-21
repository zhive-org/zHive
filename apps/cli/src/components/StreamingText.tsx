import React, { useState, useEffect, useRef } from 'react';
import { Box, Text } from 'ink';
import { colors, border } from '../commands/shared/theme';
import { extractErrorMessage } from '../shared/megathread/utils';
import { wrapText } from './wrap-text';

interface StreamingTextProps {
  stream: AsyncIterable<string> | null;
  title?: string;
  onComplete?: (fullText: string) => void;
  onError?: (error: string) => void;
}

export function StreamingText({
  stream,
  title,
  onComplete,
  onError,
}: StreamingTextProps): React.ReactElement {
  const [text, setText] = useState('');
  const bufferRef = useRef('');
  const completedRef = useRef(false);

  useEffect(() => {
    if (!stream) {
      return;
    }

    bufferRef.current = '';
    completedRef.current = false;
    let cancelled = false;

    const flushInterval = setInterval(() => {
      if (!cancelled) {
        setText(bufferRef.current);
      }
    }, 80);

    const consume = async (): Promise<void> => {
      for await (const chunk of stream) {
        if (cancelled) {
          break;
        }
        bufferRef.current += chunk;
      }

      if (!cancelled && !completedRef.current) {
        completedRef.current = true;
        const finalText = bufferRef.current;
        setText(finalText);
        onComplete?.(finalText);
      }
    };

    consume().catch((err: unknown) => {
      if (cancelled) return;
      const message = extractErrorMessage(err);
      onError?.(message);
    });

    return () => {
      cancelled = true;
      clearInterval(flushInterval);
    };
  }, [stream]);

  const termWidth = process.stdout.columns || 60;
  const boxWidth = Math.max(20, termWidth - 4);
  const innerWidth = Math.max(10, boxWidth - 2);
  const termRows = process.stdout.rows || 30;
  const maxContentLines = Math.max(5, termRows - 10);
  const displayLines = wrapText(text, innerWidth);
  const visibleLines =
    displayLines.length > maxContentLines ? displayLines.slice(-maxContentLines) : displayLines;

  return (
    <Box flexDirection="column" marginLeft={2}>
      {title && (
        <Box>
          <Text color={colors.grayDim}>
            {border.topLeft}
            {border.horizontal} {title}{' '}
            {border.horizontal.repeat(Math.max(0, boxWidth - title.length - 5))}
            {border.topRight}
          </Text>
        </Box>
      )}
      <Box paddingLeft={1} paddingRight={1} width={boxWidth} flexDirection="column">
        {visibleLines.length === 0 ? (
          <Text color={colors.white}> </Text>
        ) : (
          visibleLines.map((line, i) => (
            <Text key={i} color={colors.white} wrap="truncate-end">
              {line || ' '}
            </Text>
          ))
        )}
      </Box>
      {title && (
        <Box>
          <Text color={colors.grayDim}>
            {border.bottomLeft}
            {border.horizontal.repeat(Math.max(0, boxWidth - 2))}
            {border.bottomRight}
          </Text>
        </Box>
      )}
    </Box>
  );
}
