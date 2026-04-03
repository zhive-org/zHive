import React from 'react';
import { Box, Text } from 'ink';
import { Header } from '../../../components/Header';
import { StepIndicator } from '../../../components/StepIndicator';
import { AgentIdentityStep } from './steps/AgentIdentityStep';
import { WatchlistStep } from './steps/WatchlistStep';
import { ApiKeyStep } from './steps/ApiKeyStep';
import { SoulStep } from './steps/SoulStep';
import { StrategyStep } from './steps/StrategyStep';
import { ScaffoldStep } from './steps/ScaffoldStep';
import { colors, symbols } from '../../shared/theme';
import { WizardProvider, useWizard, STEP_ORDER, STEP_LABELS } from './wizard-context';

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

      {state.step === 'watchlist' && <WatchlistStep />}

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
