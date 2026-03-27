import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { colors, symbols } from '../commands/shared/theme';

interface SpinnerProps {
  label: string;
}

export function Spinner({ label }: SpinnerProps): React.ReactElement {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % symbols.spinner.length);
    }, 120);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return (
    <Box>
      <Text color={colors.honey}>{symbols.spinner[frame]} </Text>
      <Text color={colors.gray}>{label}</Text>
    </Box>
  );
}
