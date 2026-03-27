import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { filterCommands, type SlashCommand } from '../services/command-registry';
import { colors, symbols } from '../../shared/theme';

interface CommandInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
}

export function CommandInput({
  value,
  onChange,
  onSubmit,
  placeholder,
}: CommandInputProps): React.ReactElement {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Determine if autocomplete should be active
  const isAutocompleteActive = value.startsWith('/') && !value.includes(' ');

  // Get filtered commands
  const filteredCommands = useMemo(() => {
    if (!isAutocompleteActive) {
      return [];
    }
    const commands = filterCommands(value);
    return commands;
  }, [value, isAutocompleteActive]);

  // Reset selection when filtered commands change
  const commandCount = filteredCommands.length;
  const safeSelectedIndex = commandCount > 0 ? Math.min(selectedIndex, commandCount - 1) : 0;

  const handleChange = useCallback(
    (newValue: string) => {
      onChange(newValue);
      setSelectedIndex(0);
    },
    [onChange],
  );

  const handleSubmit = useCallback(
    (submittedValue: string) => {
      // If autocomplete is active and there are matches, complete first
      if (isAutocompleteActive && filteredCommands.length > 0) {
        const selected = filteredCommands[safeSelectedIndex];
        if (selected && submittedValue !== selected.name) {
          onChange(selected.name);
          onSubmit(selected.name);
          return;
        }
      }
      onSubmit(submittedValue);
    },
    [isAutocompleteActive, filteredCommands, safeSelectedIndex, onChange, onSubmit],
  );

  useInput(
    (input, key) => {
      if (!isAutocompleteActive || filteredCommands.length === 0) {
        return;
      }

      if (key.upArrow) {
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : commandCount - 1));
      } else if (key.downArrow) {
        setSelectedIndex((prev) => (prev < commandCount - 1 ? prev + 1 : 0));
      } else if (key.tab) {
        // Tab to complete without submitting
        const selected = filteredCommands[safeSelectedIndex];
        if (selected) {
          onChange(selected.name);
        }
      } else if (key.escape) {
        // Escape to clear input
        onChange('');
        setSelectedIndex(0);
      }
    },
    { isActive: isAutocompleteActive && filteredCommands.length > 0 },
  );

  return (
    <Box flexDirection="column">
      {/* Autocomplete dropdown - renders above input */}
      {isAutocompleteActive && filteredCommands.length > 0 && (
        <Box flexDirection="column" marginBottom={0} marginLeft={2}>
          {filteredCommands.map((cmd: SlashCommand, index: number) => {
            const isSelected = index === safeSelectedIndex;
            return (
              <Box key={cmd.name}>
                <Text color={isSelected ? colors.honey : colors.gray}>
                  {isSelected ? symbols.diamond : ' '}{' '}
                </Text>
                <Text color={isSelected ? colors.honey : colors.white}>{cmd.name}</Text>
                <Text color={colors.gray}> - {cmd.description}</Text>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Input line */}
      <Box>
        <Text color={colors.honey}>{symbols.arrow} </Text>
        <TextInput
          value={value}
          onChange={handleChange}
          onSubmit={handleSubmit}
          placeholder={placeholder}
        />
      </Box>
    </Box>
  );
}
