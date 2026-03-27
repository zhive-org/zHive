import React, { useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import { SelectPrompt, type SelectItem } from '../../../../components/SelectPrompt';
import { MultiSelectPrompt, type MultiSelectItem } from '../../../../components/MultiSelectPrompt';
import { TextPrompt } from '../../../../components/TextPrompt';
import { CharacterSummaryCard } from '../../../../components/CharacterSummaryCard';
import {
  PERSONALITY_OPTIONS,
  VOICE_OPTIONS,
  TRADING_STYLE_OPTIONS,
  SECTOR_OPTIONS,
  SENTIMENT_OPTIONS,
  TIMEFRAME_OPTIONS,
  DEFAULT_SECTOR_VALUES,
  BIO_EXAMPLES,
  type VoiceOption,
} from '../../presets/index';
import { colors, symbols } from '../../../shared/theme';
import { required, compose, maxLength } from '../validation';

export interface IdentityResult {
  personality: string;
  tone: string;
  voiceStyle: string;
  tradingStyle: string;
  sectors: string[];
  sentiment: string;
  timeframes: string[];
  bio: string;
}

interface IdentityStepProps {
  agentName: string;
  onBack?: () => void;
  initialValues?: Partial<IdentityResult>;
  onComplete: (result: IdentityResult) => void;
}

type SubStep =
  | 'personality'
  | 'personality-custom'
  | 'voice'
  | 'voice-custom'
  | 'trading'
  | 'trading-custom'
  | 'sectors'
  | 'sentiment'
  | 'timeframe'
  | 'bio';

function buildSelectItems<T extends { label: string; value: string; description: string }>(
  options: T[],
  addCustom: boolean = false,
): SelectItem[] {
  const items: SelectItem[] = options.map((opt) => ({
    label: opt.label,
    value: opt.value,
    description: opt.description,
  }));
  if (addCustom) {
    items.push({ label: 'Custom...', value: '__custom__' });
  }
  return items;
}

const personalityItems = buildSelectItems(PERSONALITY_OPTIONS, true);
const voiceItems = buildSelectItems(VOICE_OPTIONS, true);
const tradingStyleItems = buildSelectItems(TRADING_STYLE_OPTIONS, true);
const sectorItems = buildSelectItems(SECTOR_OPTIONS);
const sentimentItems = buildSelectItems(SENTIMENT_OPTIONS);
const timeframeItems = buildSelectItems(TIMEFRAME_OPTIONS);
const timeframeDefaultSelected = new Set(TIMEFRAME_OPTIONS.map((opt) => opt.value));

export function IdentityStep({
  agentName,
  onBack,
  initialValues,
  onComplete,
}: IdentityStepProps): React.ReactElement {
  const hasInitial = initialValues && initialValues.bio;
  const [subStep, setSubStep] = useState<SubStep>(hasInitial ? 'bio' : 'personality');
  const [personalityLabel, setPersonalityLabel] = useState(initialValues?.personality ?? '');
  const [personality, setPersonality] = useState(initialValues?.personality ?? '');
  const [personalitySelectValue, setPersonalitySelectValue] = useState('');
  const [tone, setTone] = useState(initialValues?.tone ?? '');
  const [voiceStyle, setVoiceStyle] = useState(initialValues?.voiceStyle ?? '');
  const [voiceLabel, setVoiceLabel] = useState(initialValues?.voiceStyle ?? '');
  const [voiceSelectValue, setVoiceSelectValue] = useState('');
  const [tradingStyle, setTradingStyle] = useState(initialValues?.tradingStyle ?? '');
  const [tradingStyleLabel, setTradingStyleLabel] = useState(initialValues?.tradingStyle ?? '');
  const [sectors, setSectors] = useState<string[]>(initialValues?.sectors ?? []);
  const [sectorsLabel, setSectorsLabel] = useState(initialValues?.sectors?.join(', ') ?? '');
  const [sentiment, setSentiment] = useState(initialValues?.sentiment ?? '');
  const [sentimentLabel, setSentimentLabel] = useState(initialValues?.sentiment ?? '');
  const [timeframes, setTimeframes] = useState<string[]>(initialValues?.timeframes ?? []);
  const [timeframesLabel, setTimeframesLabel] = useState(
    initialValues?.timeframes?.join(', ') ?? '',
  );
  const [bio, setBio] = useState(initialValues?.bio ?? '');

  const handleSubStepBack = useCallback(() => {
    switch (subStep) {
      case 'personality':
        onBack?.();
        break;
      case 'personality-custom':
        setSubStep('personality');
        break;
      case 'voice':
        setSubStep('personality');
        break;
      case 'voice-custom':
        setSubStep('voice');
        break;
      case 'trading':
        setSubStep('voice');
        break;
      case 'trading-custom':
        setSubStep('trading');
        break;
      case 'sectors':
        setSubStep('trading');
        break;
      case 'sentiment':
        setSubStep('sectors');
        break;
      case 'timeframe':
        setSubStep('sentiment');
        break;
      case 'bio':
        setSubStep('timeframe');
        break;
    }
  }, [subStep, onBack]);

  const handlePersonalitySelect = useCallback((item: SelectItem) => {
    if (item.value === '__custom__') {
      setSubStep('personality-custom');
      return;
    }
    const description = item.description ?? '';
    const personalityValue = `${item.label} — ${description}`;
    setPersonality(personalityValue);
    setPersonalityLabel(item.label);
    setPersonalitySelectValue(item.value);
    setSubStep('voice');
  }, []);

  const handlePersonalityCustom = useCallback((value: string) => {
    setPersonality(value);
    setPersonalityLabel(value);
    setSubStep('voice');
  }, []);

  const handleVoiceSelect = useCallback((item: SelectItem) => {
    if (item.value === '__custom__') {
      setSubStep('voice-custom');
      return;
    }
    const voiceOption = VOICE_OPTIONS.find((v) => v.value === item.value) as VoiceOption;
    setTone(voiceOption.tone);
    setVoiceStyle(voiceOption.voiceStyle);
    setVoiceLabel(item.label);
    setVoiceSelectValue(item.value);
    setSubStep('trading');
  }, []);

  const handleVoiceCustom = useCallback((value: string) => {
    setTone(value);
    setVoiceStyle(value);
    setVoiceLabel(value);
    setSubStep('trading');
  }, []);

  const handleTradingStyleSelect = useCallback((item: SelectItem) => {
    if (item.value === '__custom__') {
      setSubStep('trading-custom');
      return;
    }
    setTradingStyle(item.value);
    setTradingStyleLabel(item.label);
    setSubStep('sectors');
  }, []);

  const handleTradingStyleCustom = useCallback((value: string) => {
    setTradingStyle(value);
    setTradingStyleLabel(value);
    setSubStep('sectors');
  }, []);

  const handleSectors = useCallback((selected: MultiSelectItem[]) => {
    const values = selected.map((s) => s.value);
    const labels = selected.map((s) => s.label);
    setSectors(values);
    const displayLabel = values.length === sectorItems.length ? 'All' : labels.join(', ');
    setSectorsLabel(displayLabel);
    setSubStep('sentiment');
  }, []);

  const handleSentimentSelect = useCallback((item: SelectItem) => {
    setSentiment(item.value);
    setSentimentLabel(item.label);
    setSubStep('timeframe');
  }, []);

  const handleTimeframes = useCallback((selected: MultiSelectItem[]) => {
    const values = selected.map((s) => s.value);
    const labels = selected.map((s) => s.label);
    setTimeframes(values);
    const displayLabel = values.length === timeframeItems.length ? 'All' : labels.join(', ');
    setTimeframesLabel(displayLabel);
    setSubStep('bio');
  }, []);

  const handleBio = useCallback(
    (value: string) => {
      setBio(value);
      const result: IdentityResult = {
        personality,
        tone,
        voiceStyle,
        tradingStyle,
        sectors,
        sentiment,
        timeframes,
        bio: value,
      };
      onComplete(result);
    },
    [personality, tone, voiceStyle, tradingStyle, sectors, sentiment, timeframes, onComplete],
  );

  return (
    <Box flexDirection="column">
      <CharacterSummaryCard
        name={agentName}
        personality={personalityLabel || undefined}
        voice={voiceLabel || undefined}
        tradingStyle={tradingStyleLabel || undefined}
        sectors={sectorsLabel || undefined}
        sentiment={sentimentLabel || undefined}
        timeframe={timeframesLabel || undefined}
        bio={bio || undefined}
      />

      {subStep === 'personality' && (
        <SelectPrompt
          label="Choose a personality"
          items={personalityItems}
          defaultValue={personalitySelectValue || undefined}
          onSelect={handlePersonalitySelect}
          onBack={onBack ? handleSubStepBack : undefined}
        />
      )}

      {subStep === 'personality-custom' && (
        <TextPrompt
          label="Describe your agent's personality"
          placeholder="e.g. stoic realist with a dry wit"
          onSubmit={handlePersonalityCustom}
          onBack={handleSubStepBack}
          validate={required('Personality')}
        />
      )}

      {subStep === 'voice' && (
        <SelectPrompt
          label="Choose a voice"
          items={voiceItems}
          defaultValue={voiceSelectValue || undefined}
          onSelect={handleVoiceSelect}
          onBack={handleSubStepBack}
        />
      )}

      {subStep === 'voice-custom' && (
        <TextPrompt
          label="Describe your agent's voice"
          placeholder="e.g. writes like a bloomberg terminal on acid"
          onSubmit={handleVoiceCustom}
          onBack={handleSubStepBack}
          validate={required('Voice')}
        />
      )}

      {subStep === 'trading' && (
        <SelectPrompt
          label="How does your agent evaluate signals?"
          items={tradingStyleItems}
          defaultValue={tradingStyle || undefined}
          onSelect={handleTradingStyleSelect}
          onBack={handleSubStepBack}
        />
      )}

      {subStep === 'trading-custom' && (
        <TextPrompt
          label="Describe your agent's trading style"
          placeholder="e.g. combines on-chain data with sentiment analysis"
          onSubmit={handleTradingStyleCustom}
          onBack={handleSubStepBack}
          validate={required('Trading style')}
        />
      )}

      {subStep === 'sectors' && (
        <MultiSelectPrompt
          label="Which categories should your agent trade?"
          items={sectorItems}
          defaultSelected={sectors.length > 0 ? new Set(sectors) : DEFAULT_SECTOR_VALUES}
          hint="Recommended categories selected — press spacebar to toggle"
          onSubmit={handleSectors}
          onBack={handleSubStepBack}
        />
      )}

      {subStep === 'sentiment' && (
        <SelectPrompt
          label="What's your agent's market sentiment?"
          items={sentimentItems}
          defaultValue={sentiment || undefined}
          onSelect={handleSentimentSelect}
          onBack={handleSubStepBack}
        />
      )}

      {subStep === 'timeframe' && (
        <Box flexDirection="column">
          <MultiSelectPrompt
            label="Which timeframes should your agent participate in?"
            items={timeframeItems}
            defaultSelected={timeframes.length > 0 ? new Set(timeframes) : timeframeDefaultSelected}
            hint="all timeframes selected by default — press spacebar to toggle"
            onSubmit={handleTimeframes}
            onBack={handleSubStepBack}
          />
        </Box>
      )}

      {subStep === 'bio' && (
        <Box flexDirection="column">
          <Box flexDirection="column" marginLeft={2} marginBottom={1}>
            <Text color={colors.grayDim} italic>
              {symbols.arrow} Examples:
            </Text>
            {BIO_EXAMPLES.map((example, i) => (
              <Box key={i} marginLeft={2} marginTop={i > 0 ? 1 : 0}>
                <Text color={colors.grayDim} italic>
                  {symbols.diamond} {`"${example}"`}
                </Text>
              </Box>
            ))}
          </Box>
          <TextPrompt
            label="Write your agent's bio"
            placeholder={`short bio for your ${personalityLabel} agent`}
            defaultValue={bio || undefined}
            onSubmit={handleBio}
            onBack={handleSubStepBack}
            maxLength={1000}
            validate={compose(required('Bio'), maxLength(1000))}
          />
        </Box>
      )}
    </Box>
  );
}
