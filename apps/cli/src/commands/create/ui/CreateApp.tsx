import React, { useState, useCallback } from 'react';
import { Box, Text, useApp } from 'ink';
import { Header } from '../../../components/Header.js';
import { StepIndicator } from '../../../components/StepIndicator.js';
import { ApiKeyStep, type ApiKeyResult } from './steps/ApiKeyStep.js';
import { NameStep } from './steps/NameStep.js';
import { IdentityStep, type IdentityResult } from './steps/IdentityStep.js';
import { AvatarStep } from './steps/AvatarStep.js';
import { SoulStep } from './steps/SoulStep.js';
import { StrategyStep } from './steps/StrategyStep.js';
import { ScaffoldStep } from './steps/ScaffoldStep.js';
import { DoneStep } from './steps/DoneStep.js';
import { colors, symbols } from '../../shared/theme.js';
import { getProvider, type AIProvider } from '../../../shared/config/ai-providers.js';
import type { AIProviderId } from '../../../shared/config/ai-providers.js';

type Step = 'api-key' | 'name' | 'identity' | 'avatar' | 'soul' | 'strategy' | 'scaffold' | 'done';

function ensureAvatarUrl(content: string, avatarUrl: string): string {
  const lines = content.split('\n');
  const avatarIdx = lines.findIndex((l) => /^## Avatar/.test(l));
  if (avatarIdx === -1) {
    return content;
  }

  // Find the next section header after ## Avatar
  let nextSectionIdx = lines.length;
  for (let i = avatarIdx + 1; i < lines.length; i++) {
    if (/^##?\s/.test(lines[i])) {
      nextSectionIdx = i;
      break;
    }
  }

  // Replace the content between ## Avatar and next section with the raw URL
  const before = lines.slice(0, avatarIdx + 1);
  const after = lines.slice(nextSectionIdx);
  const result = [...before, '', avatarUrl, '', ...after];
  return result.join('\n');
}

function ensureSectionLine(
  content: string,
  sectionHeader: string,
  linePrefix: string,
  value: string,
): string {
  const lines = content.split('\n');
  const sectionIdx = lines.findIndex((l) => new RegExp(`^##\\s+${sectionHeader}`).test(l));
  if (sectionIdx === -1) {
    // Section missing — append it at the end
    return content + `\n\n## ${sectionHeader}\n\n${linePrefix} ${value}\n`;
  }

  // Find the next section header after this one
  let nextSectionIdx = lines.length;
  for (let i = sectionIdx + 1; i < lines.length; i++) {
    if (/^##?\s/.test(lines[i])) {
      nextSectionIdx = i;
      break;
    }
  }

  // Look for existing line with the prefix in this section
  const escapedPrefix = linePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const prefixRegex = new RegExp(`^${escapedPrefix}\\s`);
  const lineIdx = lines.findIndex(
    (l, i) => i > sectionIdx && i < nextSectionIdx && prefixRegex.test(l),
  );
  if (lineIdx !== -1) {
    // Replace the existing line
    lines[lineIdx] = `${linePrefix} ${value}`;
  } else {
    // Insert after the section header (skip blank lines)
    let insertIdx = sectionIdx + 1;
    while (insertIdx < nextSectionIdx && lines[insertIdx].trim() === '') {
      insertIdx++;
    }
    lines.splice(insertIdx, 0, `${linePrefix} ${value}`);
  }

  // Remove duplicate/malformed lines with the same prefix (e.g. "- Active timeframes" without value)
  const loosePrefix = linePrefix.replace(/:$/, '');
  const looseRegex = new RegExp(`^${loosePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`);
  const canonicalLine = `${linePrefix} ${value}`;
  for (let i = nextSectionIdx - 1; i > sectionIdx; i--) {
    if (looseRegex.test(lines[i]) && lines[i] !== canonicalLine) {
      lines.splice(i, 1);
    }
  }

  return lines.join('\n');
}

function ensureStrategyFields(
  content: string,
  sectors: string[],
  sentiment: string,
  timeframes: string[],
): string {
  const sectorsLine = sectors.length > 0 ? sectors.join(', ') : 'all categories';
  const timeframesLine = timeframes.length > 0 ? timeframes.join(', ') : '4h, 24h, 7d';

  let patched = ensureSectionLine(content, 'Sentiment', '- Bias:', sentiment);
  patched = ensureSectionLine(patched, 'Sector Focus', '- Sectors:', sectorsLine);
  patched = ensureSectionLine(patched, 'Timeframe', '- Active timeframes:', timeframesLine);
  return patched;
}

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
  const [strategyContent, setStrategyContent] = useState('');
  const [resolvedProjectDir, setResolvedProjectDir] = useState('');
  const [error, setError] = useState('');

  const stepIndex = STEP_ORDER.indexOf(step);

  const provider: AIProvider | null = providerId ? getProvider(providerId) : null;

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

  const handleSoul = useCallback(
    (content: string) => {
      const patched = ensureAvatarUrl(content, avatarUrl);
      setSoulContent(patched);
      setStep('strategy');
    },
    [avatarUrl],
  );

  const handleStrategy = useCallback(
    (content: string) => {
      const patched = ensureStrategyFields(content, sectors, sentiment, timeframes);
      setStrategyContent(patched);
      setStep('scaffold');
    },
    [sectors, sentiment, timeframes],
  );

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

      {step === 'api-key' && <ApiKeyStep onComplete={handleApiKey} />}

      {step === 'name' && <NameStep onComplete={handleName} />}

      {step === 'identity' && <IdentityStep agentName={agentName} onComplete={handleIdentity} />}

      {step === 'avatar' && <AvatarStep agentName={agentName} onComplete={handleAvatar} />}

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
