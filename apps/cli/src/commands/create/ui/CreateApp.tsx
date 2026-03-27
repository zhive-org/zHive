import React, { useState, useCallback } from 'react';
import { Box, Text, useApp } from 'ink';
import { Header } from '../../../components/Header';
import { StepIndicator } from '../../../components/StepIndicator';
import { ApiKeyStep, type ApiKeyResult } from './steps/ApiKeyStep';
import { NameStep } from './steps/NameStep';
import { IdentityStep, type IdentityResult } from './steps/IdentityStep';
import { AvatarStep } from './steps/AvatarStep';
import { SoulStep } from './steps/SoulStep';
import { StrategyStep } from './steps/StrategyStep';
import { ScaffoldStep } from './steps/ScaffoldStep';
import { DoneStep } from './steps/DoneStep';
import { colors, symbols } from '../../shared/theme';
import { getProvider, type AIProvider } from '../../../shared/config/ai-providers';
import type { AIProviderId } from '../../../shared/config/ai-providers';

type Step = 'api-key' | 'name' | 'identity' | 'avatar' | 'soul' | 'strategy' | 'scaffold' | 'done';

const STEP_ORDER: Step[] = [
  'name',
  'identity',
  'avatar',
  'api-key',
  'soul',
  'strategy',
  'scaffold',
  'done',
];
const STEP_LABELS: Record<Step, string> = {
  'api-key': 'API Key',
  name: 'Name',
  identity: 'Identity',
  avatar: 'Avatar',
  soul: 'Soul',
  strategy: 'Strategy',
  scaffold: 'Scaffold',
  done: 'Done',
};

const STEP_DEFS = STEP_ORDER.map((s) => ({ key: s, label: STEP_LABELS[s] }));

interface CreateAppProps {
  initialName?: string;
}

export function CreateApp({ initialName }: CreateAppProps): React.ReactElement {
  const { exit } = useApp();
  const [step, setStep] = useState<Step>('name');
  const [providerId, setProviderId] = useState<AIProviderId | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [agentName, setAgentName] = useState(initialName ?? '');
  const [bio, setBio] = useState('');
  const [personality, setPersonality] = useState('');
  const [tone, setTone] = useState('');
  const [voiceStyle, setVoiceStyle] = useState('');
  const [tradingStyle, setTradingStyle] = useState('');
  const [sectors, setSectors] = useState<string[]>([]);
  const [sentiment, setSentiment] = useState('');
  const [timeframes, setTimeframes] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [soulContent, setSoulContent] = useState('');
  const [soulDraft, setSoulDraft] = useState('');
  const [strategyContent, setStrategyContent] = useState('');
  const [strategyDraft, setStrategyDraft] = useState('');
  const [resolvedProjectDir, setResolvedProjectDir] = useState('');
  const [error, setError] = useState('');

  const stepIndex = STEP_ORDER.indexOf(step);

  const provider: AIProvider | null = providerId ? getProvider(providerId) : null;

  const goBack = useCallback(() => {
    const currentIndex = STEP_ORDER.indexOf(step);
    if (currentIndex > 0) {
      setStep(STEP_ORDER[currentIndex - 1]!);
    }
  }, [step]);

  const handleApiKey = useCallback((result: ApiKeyResult) => {
    setProviderId(result.providerId);
    setApiKey(result.apiKey);
    setStep('soul');
  }, []);

  const handleName = useCallback((name: string) => {
    setAgentName(name);
    setStep('identity');
  }, []);

  const handleIdentity = useCallback((result: IdentityResult) => {
    setPersonality(result.personality);
    setTone(result.tone);
    setVoiceStyle(result.voiceStyle);
    setTradingStyle(result.tradingStyle);
    setSectors(result.sectors);
    setSentiment(result.sentiment);
    setTimeframes(result.timeframes);
    setBio(result.bio);
    setStep('avatar');
  }, []);

  const handleAvatar = useCallback((value: string) => {
    setAvatarUrl(value);
    setStep('api-key');
  }, []);

  const goBackFromSoul = useCallback(
    (draft?: string) => {
      if (draft) setSoulDraft(draft);
      goBack();
    },
    [goBack],
  );

  const goBackFromStrategy = useCallback(
    (draft?: string) => {
      if (draft) setStrategyDraft(draft);
      goBack();
    },
    [goBack],
  );

  const handleSoul = useCallback((content: string) => {
    setSoulContent(content);
    setSoulDraft('');
    setStep('strategy');
  }, []);

  const handleStrategy = useCallback((content: string) => {
    setStrategyContent(content);
    setStrategyDraft('');
    setStep('scaffold');
  }, []);

  const handleScaffoldComplete = useCallback((projectDir: string) => {
    setResolvedProjectDir(projectDir);
    setStep('done');
  }, []);

  const handleScaffoldError = useCallback(
    (message: string) => {
      setError(message);
      exit();
    },
    [exit],
  );

  return (
    <Box flexDirection="column">
      <Header />
      <StepIndicator steps={STEP_DEFS} currentIndex={stepIndex} />

      {step === 'api-key' && (
        <ApiKeyStep
          initialResult={providerId && apiKey ? { providerId, apiKey } : undefined}
          onBack={goBack}
          onComplete={handleApiKey}
        />
      )}

      {step === 'name' && <NameStep defaultValue={agentName} onComplete={handleName} />}

      {step === 'identity' && (
        <IdentityStep
          agentName={agentName}
          onBack={goBack}
          initialValues={
            bio
              ? { personality, tone, voiceStyle, tradingStyle, sectors, sentiment, timeframes, bio }
              : undefined
          }
          onComplete={handleIdentity}
        />
      )}

      {step === 'avatar' && (
        <AvatarStep
          agentName={agentName}
          defaultValue={avatarUrl}
          onBack={goBack}
          onComplete={handleAvatar}
        />
      )}

      {step === 'soul' && providerId && (
        <SoulStep
          providerId={providerId}
          apiKey={apiKey}
          agentName={agentName}
          bio={bio}
          avatarUrl={avatarUrl}
          personality={personality}
          tone={tone}
          voiceStyle={voiceStyle}
          tradingStyle={tradingStyle}
          sectors={sectors}
          sentiment={sentiment}
          timeframes={timeframes}
          initialContent={soulContent || soulDraft || undefined}
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
          personality={personality}
          tone={tone}
          voiceStyle={voiceStyle}
          tradingStyle={tradingStyle}
          sectors={sectors}
          sentiment={sentiment}
          timeframes={timeframes}
          initialContent={strategyContent || strategyDraft || undefined}
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
          sectors={sectors}
          timeframes={timeframes}
          avatarUrl={avatarUrl}
          sentiment={sentiment}
          soulContent={soulContent}
          strategyContent={strategyContent}
          onComplete={handleScaffoldComplete}
          onError={handleScaffoldError}
        />
      )}

      {step === 'done' && <DoneStep projectDir={resolvedProjectDir} />}

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
