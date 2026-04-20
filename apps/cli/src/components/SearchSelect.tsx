import React, { useState, useMemo, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { colors, symbols } from '../commands/shared/theme';

export interface SearchSelectItem {
  label: string;
  value: string;
}

interface SearchSelectProps {
  label: string;
  items: SearchSelectItem[];
  defaultSelected?: Set<string>;
  maxVisible?: number;
  onSubmit: (selected: SearchSelectItem[]) => void;
  onBack?: () => void;
}

export function SearchSelect({
  label,
  items,
  defaultSelected,
  maxVisible = 10,
  onSubmit,
  onBack,
}: SearchSelectProps): React.ReactElement {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(defaultSelected ?? new Set());
  const [cursor, setCursor] = useState(0);

  const filtered = useMemo(() => {
    if (!query) return items;
    const lower = query.toLowerCase();
    return items.filter((item) => item.label.toLowerCase().includes(lower));
  }, [items, query]);

  useEffect(() => {
    setCursor(0);
  }, []);

  useInput((_input, key) => {
    if (key.escape) {
      if (query) {
        setQuery('');
      } else if (onBack) {
        onBack();
      }
      return;
    }

    if (key.return) {
      const selectedItems = items.filter((i) => selected.has(i.value));
      onSubmit(selectedItems);
      return;
    }

    if (key.upArrow) {
      setCursor((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
      return;
    }
    if (key.downArrow) {
      setCursor((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
      return;
    }

    if (key.tab || _input === ' ') {
      const item = filtered[cursor];
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
      return;
    }

    if (key.backspace || key.delete) {
      setQuery((prev) => prev.slice(0, -1));
      return;
    }

    if (_input && !key.ctrl && !key.meta) {
      setQuery((prev) => prev + _input);
    }
  });

  const windowStart = Math.max(
    0,
    Math.min(cursor - Math.floor(maxVisible / 2), filtered.length - maxVisible),
  );
  const windowEnd = Math.min(windowStart + maxVisible, filtered.length);
  const visibleItems = filtered.slice(windowStart, windowEnd);

  const selectedItems = useMemo(
    () => items.filter((i) => selected.has(i.value)),
    [items, selected],
  );

  return (
    <Box flexDirection="row" columnGap={4}>
      <Box flexDirection="column">
        <Box>
          <Text color={colors.honey}>{symbols.arrow} </Text>
          <Text color={colors.white} bold>
            {label}
          </Text>
          <Text color={colors.grayDim}> ({selected.size} selected)</Text>
        </Box>

        <Box marginLeft={2} marginTop={1}>
          <Text color={colors.honey}>&gt; </Text>
          <Text color={colors.white}>{query}</Text>
          {!query && <Text color={colors.grayDim}>Type to search...</Text>}
        </Box>

        {filtered.length === 0 ? (
          <Box marginLeft={4} marginTop={1}>
            <Text color={colors.grayDim} italic>
              No matches found
            </Text>
          </Box>
        ) : (
          <Box flexDirection="column" marginLeft={2} marginTop={1}>
            {windowStart > 0 && <Text color={colors.grayDim}> ↑ {windowStart} more</Text>}
            {visibleItems.map((item, i) => {
              const actualIndex = windowStart + i;
              const isCursor = actualIndex === cursor;
              const isSelected = selected.has(item.value);
              const checkbox = isSelected ? '◆' : '◇';

              return (
                <Box key={item.value}>
                  <Text color={colors.honey}>{isCursor ? symbols.arrow : ' '} </Text>
                  <Text color={isSelected ? colors.honey : colors.grayDim}>{checkbox} </Text>
                  <Text color={isCursor ? colors.white : colors.gray} bold={isCursor}>
                    {item.label}
                  </Text>
                </Box>
              );
            })}
            {windowEnd < filtered.length && (
              <Text color={colors.grayDim}> ↓ {filtered.length - windowEnd} more</Text>
            )}
          </Box>
        )}

        <Box marginLeft={2} marginTop={1}>
          <Text color={colors.grayDim}>
            <Text color={colors.honey}>↑↓</Text> navigate{' '}
            <Text color={colors.honey}>space</Text> toggle{' '}
            <Text color={colors.honey}>enter</Text> confirm
            {onBack && (
              <Text>
                {' '}
                <Text color={colors.honey}>esc</Text> back
              </Text>
            )}
          </Text>
        </Box>
      </Box>

      {selectedItems.length > 0 && (
        <Box flexDirection="column">
          <Text color={colors.white} bold>
            Selected ({selectedItems.length})
          </Text>
          <Box flexDirection="column" marginTop={1}>
            {selectedItems.slice(0, maxVisible).map((item) => (
              <Box key={item.value}>
                <Text color={colors.honey}>◆ </Text>
                <Text color={colors.honey}>{item.label}</Text>
              </Box>
            ))}
            {selectedItems.length > maxVisible && (
              <Text color={colors.grayDim}>
                +{selectedItems.length - maxVisible} more
              </Text>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
