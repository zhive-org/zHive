import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors, symbols } from '../commands/shared/theme.js';

export interface MultiSelectItem {
  label: string;
  value: string;
  description?: string;
}

interface MultiSelectPromptProps {
  label: string;
  items: MultiSelectItem[];
  defaultSelected?: Set<string>;
  hint?: string;
  onSubmit: (selected: MultiSelectItem[]) => void;
}

export function MultiSelectPrompt({
  label,
  items,
  defaultSelected,
  hint,
  onSubmit,
}: MultiSelectPromptProps): React.ReactElement {
  const allValues = new Set(items.map((i) => i.value));
  const [selected, setSelected] = useState<Set<string>>(defaultSelected ?? allValues);
  const [cursor, setCursor] = useState(0);

  useInput((_input, key) => {
    if (key.upArrow) {
      setCursor((prev) => (prev > 0 ? prev - 1 : items.length - 1));
    }
    if (key.downArrow) {
      setCursor((prev) => (prev < items.length - 1 ? prev + 1 : 0));
    }
    if (_input === ' ') {
      const item = items[cursor];
      if (!item) return;
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(item.value)) {
          next.delete(item.value);
        } else {
          next.add(item.value);
        }
        return next;
      });
    }
    if (key.return) {
      const selectedItems = items.filter((i) => selected.has(i.value));
      onSubmit(selectedItems);
    }
  });

  const highlightedItem = items[cursor];
  const highlightedDescription = highlightedItem?.description;

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={colors.honey}>{symbols.arrow} </Text>
        <Text color={colors.white} bold>
          {label}
        </Text>
      </Box>
      <Box marginLeft={2} marginBottom={1}>
        <Text color={colors.grayDim} italic>
          {hint ?? "All selected by default — deselect what you don't want"}
        </Text>
      </Box>
      <Box flexDirection="column" marginLeft={2}>
        {items.map((item, i) => {
          const isCursor = i === cursor;
          const isSelected = selected.has(item.value);
          const checkbox = isSelected ? '◆' : '◇';
          const itemColor = isCursor ? colors.honey : colors.white;

          return (
            <Box key={item.value}>
              <Text color={colors.honey}>{isCursor ? symbols.diamond : ' '} </Text>
              <Text color={isSelected ? colors.honey : colors.grayDim}>{checkbox} </Text>
              <Text color={itemColor}>{item.label}</Text>
            </Box>
          );
        })}
      </Box>
      {highlightedDescription && (
        <Box marginLeft={4} marginTop={1}>
          <Text color={colors.gray} italic>
            {symbols.arrow} {highlightedDescription}
          </Text>
        </Box>
      )}
      <Box marginLeft={2} marginTop={1}>
        <Text color={colors.grayDim}>
          <Text color={colors.honey}>spacebar</Text> press to toggle <Text color={colors.honey}>enter</Text>{' '}
          confirm
        </Text>
      </Box>
    </Box>
  );
}
