import React, { useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import { Header } from '../../../components/Header.js';
import { StepIndicator } from '../../../components/StepIndicator.js';
import { ApiKeyStep, type ApiKeyResult } from './steps/ApiKeyStep.js';
import { AgentIdentityStep, type AgentIdentityResult } from './steps/AgentIdentityStep.js';
import { SoulStep } from './steps/SoulStep.js';
import { StrategyStep, type StrategyStepResult } from './steps/StrategyStep.js';
import { ScaffoldStep } from './steps/ScaffoldStep.js';
import { colors, symbols } from '../../shared/theme.js';
import { getProvider, type AIProvider } from '../../../shared/config/ai-providers.js';
import type { AIProviderId } from '../../../shared/config/ai-providers.js';

type Step = 'identity' | 'api-key' | 'soul' | 'strategy' | 'scaffold';

const STEP_ORDER: Step[] = ['identity', 'api-key', 'soul', 'strategy', 'scaffold'];
const STEP_LABELS: Record<Step, string> = {
  identity: 'Identity',
  'api-key': 'API Key',
  soul: 'Soul',
  strategy: 'Strategy',
  scaffold: 'Create',
};

const STEP_DEFS = STEP_ORDER.map((s) => ({ key: s, label: STEP_LABELS[s] }));

interface CreateAppProps {
  initialName?: string;
}

export function CreateApp({ initialName }: CreateAppProps): React.ReactElement {
  const [step, setStep] = useState<Step>('identity');
  const [providerId, setProviderId] = useState<AIProviderId | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [agentName, setAgentName] = useState(initialName ?? '');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [soulContent, setSoulContent] = useState('');
  const [soulDraft, setSoulDraft] = useState('');
  const [soulPrompt, setSoulPrompt] = useState('');
  const [strategyContent, setStrategyContent] = useState('');
  const [strategyDraft, setStrategyDraft] = useState('');
  const [strategyPrompt, setStrategyPrompt] = useState('');
  const [sectors, setSectors] = useState<string[]>([]);
  const [timeframes, setTimeframes] = useState<string[]>([]);
  const [error, setError] = useState('');

  const stepIndex = STEP_ORDER.indexOf(step);

  const provider: AIProvider | null = providerId ? getProvider(providerId) : null;

  const goBack = useCallback(() => {
    const currentIndex = STEP_ORDER.indexOf(step);
    if (currentIndex > 0) {
      setStep(STEP_ORDER[currentIndex - 1]!);
    }
  }, [step]);

  const handleIdentity = useCallback((result: AgentIdentityResult) => {
    setAgentName(result.name);
    setBio(result.bio);
    setAvatarUrl(result.avatarUrl);
    setStep('api-key');
  }, []);

  const handleApiKey = useCallback((result: ApiKeyResult) => {
    setProviderId(result.providerId);
    setApiKey(result.apiKey);
    setStep('soul');
  }, []);

  const goBackFromSoul = useCallback(
    (draft?: string, prompt?: string) => {
      if (draft) setSoulDraft(draft);
      if (prompt) setSoulPrompt(prompt);
      goBack();
    },
    [goBack],
  );

  const goBackFromStrategy = useCallback(
    (draft?: string, prompt?: string) => {
      if (draft) setStrategyDraft(draft);
      if (prompt) setStrategyPrompt(prompt);
      goBack();
    },
    [goBack],
  );

  const handleSoul = useCallback((content: string) => {
    setSoulContent(content);
    setSoulDraft('');
    setStep('strategy');
  }, []);

  const handleStrategy = useCallback((result: StrategyStepResult) => {
    setStrategyContent(result.strategyContent);
    setSectors(result.sectors);
    setTimeframes(result.timeframes);
    setStrategyDraft('');
    setStep('scaffold');
  }, []);

  const handleScaffoldError = useCallback((message: string) => {
    setError(message);
  }, []);

  return (
    <Box flexDirection="column">
      <Header />
      <StepIndicator steps={STEP_DEFS} currentIndex={stepIndex} />

      {step === 'identity' && (
        <AgentIdentityStep
          initialValues={agentName ? { name: agentName, bio, avatarUrl } : undefined}
          onComplete={handleIdentity}
        />
      )}

      {step === 'api-key' && (
        <ApiKeyStep
          initialResult={providerId && apiKey ? { providerId, apiKey } : undefined}
          onBack={goBack}
          onComplete={handleApiKey}
        />
      )}

      {step === 'soul' && providerId && (
        <SoulStep
          providerId={providerId}
          apiKey={apiKey}
          agentName={agentName}
          bio={bio}
          initialContent={soulContent || soulDraft || undefined}
          initialPrompt={soulPrompt || undefined}
          onBack={goBackFromSoul}
          onComplete={handleSoul}
        />
      )}

      {step === 'strategy' && providerId && (
        <StrategyStep
          providerId={providerId}
          apiKey={apiKey}
          agentName={agentName}
          bio={bio}
          initialContent={strategyContent || strategyDraft || undefined}
          initialPrompt={strategyPrompt || undefined}
          initialSectors={sectors.length > 0 ? sectors : undefined}
          initialTimeframes={timeframes.length > 0 ? timeframes : undefined}
          onBack={goBackFromStrategy}
          onComplete={handleStrategy}
        />
      )}

      {step === 'scaffold' && provider && (
        <ScaffoldStep
          projectName={agentName}
          provider={provider}
          apiKey={apiKey}
          bio={bio}
          avatarUrl={avatarUrl}
          soulContent={soulContent}
          strategyContent={strategyContent}
          sectors={sectors}
          timeframes={timeframes}
          onError={handleScaffoldError}
        />
      )}

      {error !== '' && (
        <Box marginTop={1} marginLeft={2}>
          <Text color={colors.red}>
            {symbols.cross} {error}
          </Text>
        </Box>
      )}
    </Box>
  );
}
