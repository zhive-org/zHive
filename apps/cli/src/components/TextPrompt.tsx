import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { colors, symbols } from '../commands/shared/theme.js';

interface TextPromptProps {
  label: string;
  placeholder?: string;
  onSubmit: (value: string) => void;
  validate?: (value: string) => string | true;
  maxLength?: number;
}

export function TextPrompt({
  label,
  placeholder,
  onSubmit,
  validate,
  maxLength,
}: TextPromptProps): React.ReactElement {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  useInput((_input, key) => {
    if (key.tab && value === '' && placeholder) {
      setValue(placeholder);
    }
  });

  const handleSubmit = (input: string): void => {
    const trimmed = input.trim();
    if (validate) {
      const result = validate(trimmed);
      if (result !== true) {
        setError(result);
        return;
      }
    }
    setError('');
    onSubmit(trimmed);
  };

  const charCounter = maxLength ? ` ${value.length}/${maxLength}` : '';

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={colors.honey}>{symbols.arrow} </Text>
        <Text color={colors.white} bold>
          {label}
        </Text>
        {maxLength && (
          <Text color={value.length > maxLength ? colors.red : colors.grayDim}>{charCounter}</Text>
        )}
      </Box>
      <Box marginLeft={2}>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          placeholder={placeholder}
        />
      </Box>
      {error !== '' && (
        <Box marginLeft={2}>
          <Text color={colors.red}>
            {symbols.cross} {error}
          </Text>
        </Box>
      )}
    </Box>
  );
}
