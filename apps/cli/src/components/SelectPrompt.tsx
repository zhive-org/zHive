import React, { useState } from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import { colors, symbols } from '../commands/shared/theme.js';

export interface SelectItem {
  label: string;
  value: string;
  description?: string;
}

interface SelectPromptProps {
  label: string;
  items: SelectItem[];
  onSelect: (item: SelectItem) => void;
}

export function SelectPrompt({ label, items, onSelect }: SelectPromptProps): React.ReactElement {
  const [highlightedValue, setHighlightedValue] = useState<string>(items[0]?.value ?? '');

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
    </Box>
  );
}
