import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors, symbols, border } from '../commands/shared/theme';
import { Spinner } from './Spinner';
import { SelectPrompt } from './SelectPrompt';
import { TextPrompt } from './TextPrompt';
import { wrapText } from './wrap-text';
import type { ChatTurn, QuestionTurn } from '../commands/create/strategy-chat-agent';

interface AgenticChatProps {
  seed: string;
  transcript: ChatTurn[];
  pending: QuestionTurn | 'thinking' | { kind: 'error'; message: string };
  onAnswer: (value: string) => void;
  onUndo: () => void;
  onBack: () => void;
  onRetry?: () => void;
}

export function AgenticChat({
  seed,
  transcript,
  pending,
  onAnswer,
  onUndo,
  onBack,
  onRetry,
}: AgenticChatProps): React.ReactElement {
  const termRows = process.stdout.rows || 30;
  const termWidth = process.stdout.columns || 60;
  const innerWidth = Math.max(20, termWidth - 8);

  const transcriptLines: { kind: 'q' | 'a' | 'seed'; text: string }[] = [];
  if (seed) transcriptLines.push({ kind: 'seed', text: seed });
  for (const turn of transcript) {
    transcriptLines.push({ kind: 'q', text: turn.question });
    transcriptLines.push({ kind: 'a', text: turn.answer });
  }

  const renderedLines: { color: string; prefix: string; text: string }[] = [];
  for (const entry of transcriptLines) {
    if (entry.kind === 'seed') {
      const wrapped = wrapText(entry.text, innerWidth - 2);
      wrapped.forEach((line, i) =>
        renderedLines.push({
          color: colors.gray,
          prefix: i === 0 ? '« ' : '  ',
          text: line,
        }),
      );
    } else if (entry.kind === 'q') {
      const wrapped = wrapText(entry.text, innerWidth - 2);
      wrapped.forEach((line, i) =>
        renderedLines.push({
          color: colors.honey,
          prefix: i === 0 ? '? ' : '  ',
          text: line,
        }),
      );
    } else {
      const wrapped = wrapText(entry.text, innerWidth - 2);
      wrapped.forEach((line, i) =>
        renderedLines.push({
          color: colors.white,
          prefix: i === 0 ? '→ ' : '  ',
          text: line,
        }),
      );
    }
  }

  const reserveRows = 18;
  const maxLines = Math.max(4, termRows - reserveRows);
  const scrollable = renderedLines.length > maxLines;
  const maxScroll = Math.max(0, renderedLines.length - maxLines);
  const [scroll, setScroll] = useState(0);
  const clamped = Math.min(scroll, maxScroll);

  useInput((input, key) => {
    if (key.ctrl && (input === 'z' || input === 'Z')) {
      if (transcript.length > 0) onUndo();
      return;
    }
    if (!scrollable) return;
    if (key.pageUp) setScroll((s) => Math.max(0, Math.min(s, maxScroll) - maxLines));
    else if (key.pageDown) setScroll((s) => Math.min(maxScroll, s + maxLines));
  });

  const visible = scrollable
    ? renderedLines.slice(
        Math.max(0, renderedLines.length - maxLines - clamped),
        renderedLines.length - clamped,
      )
    : renderedLines;
  const hiddenAbove = Math.max(0, renderedLines.length - maxLines - clamped);
  const hiddenBelow = clamped;

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={colors.honey}>{symbols.hive} </Text>
        <Text color={colors.white} bold>
          Strategy interview
        </Text>
        {hiddenAbove > 0 && (
          <Text color={colors.grayDim}>
            {' '}
            {`(${hiddenAbove} earlier line${hiddenAbove === 1 ? '' : 's'} hidden — pgup)`}
          </Text>
        )}
      </Box>

      {visible.length === 0 ? (
        <Box marginLeft={2} marginBottom={1}>
          <Text color={colors.grayDim} italic>
            (no messages yet)
          </Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginLeft={2} marginBottom={1}>
          {visible.map((line, i) => (
            <Box key={i}>
              <Text color={line.color}>{line.prefix}</Text>
              <Text color={line.color === colors.honey ? colors.white : line.color}>
                {line.text}
              </Text>
            </Box>
          ))}
          {hiddenBelow > 0 && (
            <Text color={colors.grayDim}>{`  … ${hiddenBelow} more below (pgdn)`}</Text>
          )}
        </Box>
      )}

      <AgentBox>
        {pending === 'thinking' && <Spinner label="Agent is thinking..." />}
        {typeof pending === 'object' && pending.kind === 'error' && (
          <Box flexDirection="column">
            <Box>
              <Text color={colors.red}>{symbols.cross} </Text>
              <Text color={colors.white}>Agent error</Text>
            </Box>
            <Box marginTop={1}>
              <Text color={colors.red}>{pending.message}</Text>
            </Box>
          </Box>
        )}
        {typeof pending === 'object' && pending.kind === 'question' && (
          <Box flexDirection="column">
            <Box>
              <Text color={colors.honey}>{symbols.diamond} </Text>
              <Text color={colors.white} bold>
                {pending.prompt}
              </Text>
            </Box>
          </Box>
        )}
      </AgentBox>

      {typeof pending === 'object' && pending.kind === 'question' && (
        <Box marginTop={1}>
          {pending.input.type === 'choice' ? (
            <SelectPrompt
              label="Pick one"
              items={pending.input.choices.map((c) => ({
                label: c.label,
                value: c.value,
                description: c.description,
              }))}
              allowCustom={pending.input.allowCustom}
              customPlaceholder="Type your answer..."
              allowDefer={pending.input.allowDefer}
              onDefer={() => onAnswer('(let the agent pick a sensible default)')}
              onSelect={(item) => onAnswer(item.label)}
              onCustom={(val) => onAnswer(val)}
              onBack={onBack}
            />
          ) : (
            <TextPrompt
              label="Your answer"
              placeholder={pending.input.placeholder}
              onSubmit={(val) => onAnswer(val)}
              onBack={onBack}
            />
          )}
        </Box>
      )}

      {typeof pending === 'object' && pending.kind === 'error' && onRetry && (
        <Box marginTop={1}>
          <TextPrompt
            label=""
            placeholder="Enter to retry..."
            onSubmit={() => onRetry()}
            onBack={onBack}
          />
        </Box>
      )}

      <Box marginTop={1} marginLeft={2}>
        <Text color={colors.grayDim}>
          <Text color={colors.honey}>ctrl+z</Text> undo last {symbols.dot}{' '}
          <Text color={colors.honey}>esc</Text> back {symbols.dot}{' '}
          <Text color={colors.honey}>pgup/pgdn</Text> scroll
        </Text>
      </Box>
    </Box>
  );
}

function AgentBox({ children }: { children: React.ReactNode }): React.ReactElement {
  const termWidth = process.stdout.columns || 60;
  const boxWidth = Math.max(20, termWidth - 4);
  const fill = border.horizontal.repeat(Math.max(0, boxWidth - 8));
  return (
    <Box flexDirection="column" marginLeft={2}>
      <Text color={colors.grayDim}>
        {border.topLeft}
        {border.horizontal} Agent {fill}
        {border.topRight}
      </Text>
      <Box paddingX={1}>{children}</Box>
      <Text color={colors.grayDim}>
        {border.bottomLeft}
        {border.horizontal.repeat(Math.max(0, boxWidth - 2))}
        {border.bottomRight}
      </Text>
    </Box>
  );
}
