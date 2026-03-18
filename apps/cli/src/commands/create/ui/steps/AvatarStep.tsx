import React from 'react';
import { Box, Text } from 'ink';
import { TextPrompt } from '../../../../components/TextPrompt.js';
import { colors, symbols } from '../../../shared/theme.js';

interface AvatarStepProps {
  agentName: string;
  onComplete: (avatarUrl: string) => void;
}

export function AvatarStep({ agentName, onComplete }: AvatarStepProps): React.ReactElement {
  const defaultUrl = `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(agentName)}`;

  return (
    <Box flexDirection="column">
      <Box marginBottom={1} marginLeft={2}>
        <Text color={colors.gray}>
          {symbols.diamond} Default: <Text color={colors.honey}>{defaultUrl}</Text>
        </Text>
      </Box>
      <TextPrompt
        label="Avatar image URL (press Enter for default)"
        placeholder={defaultUrl}
        onSubmit={(val) => onComplete(val || defaultUrl)}
        validate={(val) => {
          if (!val) {
            return true;
          }
          if (!val.startsWith('http://') && !val.startsWith('https://')) {
            return 'Must start with http:// or https://';
          }
          return true;
        }}
      />
    </Box>
  );
}
