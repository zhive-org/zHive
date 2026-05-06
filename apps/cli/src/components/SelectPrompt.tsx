import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { colors, symbols } from '../commands/shared/theme';
import { TextPrompt } from './TextPrompt';

export interface SelectItem {
  label: string;
  value: string;
  description?: string;
}

interface SelectPromptProps {
  label: string;
  items: SelectItem[];
  defaultValue?: string;
  onSelect: (item: SelectItem) => void;
  onBack?: () => void;
  /** When true, appends a "Type my own answer" item that swaps to a TextPrompt. */
  allowCustom?: boolean;
  /** Placeholder for the custom text input. */
  customPlaceholder?: string;
  /** Called when the user submits a custom typed answer. */
  onCustom?: (value: string) => void;
  /** When true, appends a "Pick a sensible default for me" item. */
  allowDefer?: boolean;
  /** Called when the user picks the defer item. */
  onDefer?: () => void;
}

const CUSTOM_VALUE = '__custom_answer__';
const DEFER_VALUE = '__defer_answer__';

export function SelectPrompt({
  label,
  items,
  defaultValue,
  onSelect,
  onBack,
  allowCustom = false,
  customPlaceholder,
  onCustom,
  allowDefer = false,
  onDefer,
}: SelectPromptProps): React.ReactElement {
  const effectiveItems: SelectItem[] = [
    ...items,
    ...(allowDefer
      ? [
          {
            label: '🎲 Pick a sensible default for me',
            value: DEFER_VALUE,
            description: 'Let the agent choose a reasonable default and continue.',
          },
        ]
      : []),
    ...(allowCustom
      ? [
          {
            label: '✎ Type my own answer',
            value: CUSTOM_VALUE,
            description: 'Provide a free-form response instead.',
          },
        ]
      : []),
  ];

  const initialIndex = defaultValue
    ? Math.max(
        0,
        effectiveItems.findIndex((i) => i.value === defaultValue),
      )
    : 0;
  const [highlightedValue, setHighlightedValue] = useState<string>(
    defaultValue ?? effectiveItems[0]?.value ?? '',
  );
  const [mode, setMode] = useState<'select' | 'custom'>('select');

  useInput((_input, key) => {
    if (mode === 'select' && key.escape && onBack) {
      onBack();
    }
  });

  const handleSelect = (item: { label: string; value: string }): void => {
    if (item.value === CUSTOM_VALUE) {
      setMode('custom');
      return;
    }
    if (item.value === DEFER_VALUE) {
      if (onDefer) onDefer();
      return;
    }
    const found = effectiveItems.find((i) => i.value === item.value);
    if (found) {
      onSelect(found);
    }
  };

  const handleHighlight = (item: { label: string; value: string }): void => {
    setHighlightedValue(item.value);
  };

  if (mode === 'custom') {
    return (
      <TextPrompt
        label={label}
        placeholder={customPlaceholder}
        onSubmit={(value) => {
          if (onCustom) onCustom(value);
          else onSelect({ label: value, value });
        }}
        onBack={() => setMode('select')}
      />
    );
  }

  const highlightedItem = effectiveItems.find((i) => i.value === highlightedValue);
  const highlightedDescription = highlightedItem?.description;

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color={colors.honey}>{symbols.arrow} </Text>
        <Text color={colors.white} bold>
          {label}
        </Text>
      </Box>
      <Box marginLeft={2}>
        <SelectInput
          items={effectiveItems}
          initialIndex={initialIndex}
          onSelect={handleSelect}
          onHighlight={handleHighlight}
          indicatorComponent={({ isSelected }) => (
            <Text color={colors.honey}>{isSelected ? symbols.diamond : ' '} </Text>
          )}
          itemComponent={({ isSelected, label: itemLabel }) => (
            <Text color={isSelected ? colors.honey : colors.white}>{itemLabel}</Text>
          )}
        />
      </Box>
      {highlightedDescription && (
        <Box marginLeft={4} marginTop={1}>
          <Text color={colors.gray} italic>
            {symbols.arrow} {highlightedDescription}
          </Text>
        </Box>
      )}
      {onBack && (
        <Box marginLeft={2} marginTop={1}>
          <Text color={colors.grayDim}>
            <Text color={colors.honey}>esc</Text> back
          </Text>
        </Box>
      )}
    </Box>
  );
}
