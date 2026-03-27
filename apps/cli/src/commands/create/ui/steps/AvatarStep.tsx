import React from 'react';
import { Box, Text } from 'ink';
import { TextPrompt } from '../../../../components/TextPrompt';
import { colors, symbols } from '../../../shared/theme';

interface AvatarStepProps {
  agentName: string;
  defaultValue?: string;
  onBack?: () => void;
  onComplete: (avatarUrl: string) => void;
}

export function AvatarStep({
  agentName,
  defaultValue,
  onBack,
  onComplete,
}: AvatarStepProps): React.ReactElement {
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
        defaultValue={defaultValue}
        onBack={onBack}
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
