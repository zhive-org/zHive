import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import { colors, symbols } from '../commands/shared/theme';

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
}

export function SelectPrompt({
  label,
  items,
  defaultValue,
  onSelect,
  onBack,
}: SelectPromptProps): React.ReactElement {
  const initialIndex = defaultValue
    ? Math.max(
        0,
        items.findIndex((i) => i.value === defaultValue),
      )
    : 0;
  const [highlightedValue, setHighlightedValue] = useState<string>(
    defaultValue ?? items[0]?.value ?? '',
  );

  useInput((_input, key) => {
    if (key.escape && onBack) {
      onBack();
    }
  });

  const handleSelect = (item: { label: string; value: string }): void => {
    const found = items.find((i) => i.value === item.value);
    if (found) {
      onSelect(found);
    }
  };

  const handleHighlight = (item: { label: string; value: string }): void => {
    setHighlightedValue(item.value);
  };

  const highlightedItem = items.find((i) => i.value === highlightedValue);
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
          items={items}
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
