import React from 'react';
import { Box, Text } from 'ink';
import { colors, symbols } from '../commands/shared/theme';

export interface StepDef {
  key: string;
  label: string;
}

interface StepIndicatorProps {
  steps: StepDef[];
  currentIndex: number;
}

export function StepIndicator({ steps, currentIndex }: StepIndicatorProps): React.ReactElement {
  return (
    <Box marginLeft={1} marginBottom={1}>
      {steps.map((step, i) => {
        const isCurrent = i === currentIndex;
        const isCompleted = i < currentIndex;

        let symbol: string;
        let symbolColor: string;
        let labelColor: string;
        let bold = false;

        if (isCurrent) {
          symbol = symbols.dot;
          symbolColor = colors.honey;
          labelColor = colors.honey;
          bold = true;
        } else if (isCompleted) {
          symbol = symbols.check;
          symbolColor = colors.green;
          labelColor = colors.gray;
        } else {
          symbol = symbols.diamondOpen;
          symbolColor = colors.grayDim;
          labelColor = colors.grayDim;
        }

        return (
          <React.Fragment key={step.key}>
            {i > 0 && <Text> </Text>}
            <Text color={symbolColor}>{symbol}</Text>
            <Text color={labelColor} bold={bold}>
              {' '}
              {step.label}
            </Text>
          </React.Fragment>
        );
      })}
    </Box>
  );
}
