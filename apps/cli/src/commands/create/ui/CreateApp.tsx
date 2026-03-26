import React from 'react';
import { Box, Text } from 'ink';
import { Header } from '../../../components/Header.js';
import { StepIndicator } from '../../../components/StepIndicator.js';
import { AgentIdentityStep } from './steps/AgentIdentityStep.js';
import { ApiKeyStep } from './steps/ApiKeyStep.js';
import { SoulStep } from './steps/SoulStep.js';
import { StrategyStep } from './steps/StrategyStep.js';
import { ScaffoldStep } from './steps/ScaffoldStep.js';
import { colors, symbols } from '../../shared/theme.js';
import { WizardProvider, useWizard, STEP_ORDER, STEP_LABELS } from './wizard-context.js';

const STEP_DEFS = STEP_ORDER.map((s) => ({ key: s, label: STEP_LABELS[s] }));

interface CreateAppProps {
  initialName?: string;
}

function CreateAppInner(): React.ReactElement {
  const { state } = useWizard();
  const stepIndex = STEP_ORDER.indexOf(state.step);

  return (
    <Box flexDirection="column">
      <Header />
      <StepIndicator steps={STEP_DEFS} currentIndex={stepIndex} />

      {state.step === 'identity' && <AgentIdentityStep />}

      {state.step === 'api-key' && <ApiKeyStep />}

      {state.step === 'soul' && state.apiConfig.providerId && <SoulStep />}

      {state.step === 'strategy' && state.apiConfig.providerId && <StrategyStep />}

      {state.step === 'scaffold' && state.apiConfig.providerId && <ScaffoldStep />}

      {state.error !== '' && (
        <Box marginTop={1} marginLeft={2}>
          <Text color={colors.red}>
            {symbols.cross} {state.error}
          </Text>
        </Box>
      )}
    </Box>
  );
}

export function CreateApp({ initialName }: CreateAppProps): React.ReactElement {
  return (
    <WizardProvider initialName={initialName}>
      <CreateAppInner />
    </WizardProvider>
  );
}
