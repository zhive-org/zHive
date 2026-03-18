import React, { useState, useCallback } from 'react';
import { Box, Text } from 'ink';
import { SelectPrompt, type SelectItem } from '../../../../components/SelectPrompt.js';
import {
  MultiSelectPrompt,
  type MultiSelectItem,
} from '../../../../components/MultiSelectPrompt.js';
import { TextPrompt } from '../../../../components/TextPrompt.js';
import { CharacterSummaryCard } from '../../../../components/CharacterSummaryCard.js';
import {
  PERSONALITY_OPTIONS,
  VOICE_OPTIONS,
  TRADING_STYLE_OPTIONS,
  PROJECT_CATEGORY_OPTIONS,
  SENTIMENT_OPTIONS,
  TIMEFRAME_OPTIONS,
  DEFAULT_SECTOR_VALUES,
  BIO_EXAMPLES,
  type VoiceOption,
} from '../../presets/index.js';
import { colors, symbols } from '../../../shared/theme.js';
import { required, compose, maxLength } from '../validation.js';

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
const categoryItems = buildSelectItems(PROJECT_CATEGORY_OPTIONS);
const sentimentItems = buildSelectItems(SENTIMENT_OPTIONS);
const timeframeItems = buildSelectItems(TIMEFRAME_OPTIONS);
const timeframeDefaultSelected = new Set(
  TIMEFRAME_OPTIONS.map((opt) => opt.value),
);

export function IdentityStep({ agentName, onComplete }: IdentityStepProps): React.ReactElement {
  const [subStep, setSubStep] = useState<SubStep>('personality');
  const [personalityLabel, setPersonalityLabel] = useState('');
  const [personality, setPersonality] = useState('');
  const [tone, setTone] = useState('');
  const [voiceStyle, setVoiceStyle] = useState('');
  const [voiceLabel, setVoiceLabel] = useState('');
  const [tradingStyle, setTradingStyle] = useState('');
  const [tradingStyleLabel, setTradingStyleLabel] = useState('');
  const [sectors, setSectors] = useState<string[]>([]);
  const [sectorsLabel, setSectorsLabel] = useState('');
  const [sentiment, setSentiment] = useState('');
  const [sentimentLabel, setSentimentLabel] = useState('');
  const [timeframes, setTimeframes] = useState<string[]>([]);
  const [timeframesLabel, setTimeframesLabel] = useState('');

  const handlePersonalitySelect = useCallback((item: SelectItem) => {
    if (item.value === '__custom__') {
      setSubStep('personality-custom');
      return;
    }
    const description = item.description ?? '';
    const personalityValue = `${item.label} — ${description}`;
    setPersonality(personalityValue);
    setPersonalityLabel(item.label);
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
    const displayLabel = values.length === categoryItems.length ? 'All' : labels.join(', ');
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
      />

      {subStep === 'personality' && (
        <SelectPrompt
          label="Choose a personality"
          items={personalityItems}
          onSelect={handlePersonalitySelect}
        />
      )}

      {subStep === 'personality-custom' && (
        <TextPrompt
          label="Describe your agent's personality"
          placeholder="e.g. stoic realist with a dry wit"
          onSubmit={handlePersonalityCustom}
          validate={required('Personality')}
        />
      )}

      {subStep === 'voice' && (
        <SelectPrompt label="Choose a voice" items={voiceItems} onSelect={handleVoiceSelect} />
      )}

      {subStep === 'voice-custom' && (
        <TextPrompt
          label="Describe your agent's voice"
          placeholder="e.g. writes like a bloomberg terminal on acid"
          onSubmit={handleVoiceCustom}
          validate={required('Voice')}
        />
      )}

      {subStep === 'trading' && (
        <SelectPrompt
          label="How does your agent evaluate signals?"
          items={tradingStyleItems}
          onSelect={handleTradingStyleSelect}
        />
      )}

      {subStep === 'trading-custom' && (
        <TextPrompt
          label="Describe your agent's trading style"
          placeholder="e.g. combines on-chain data with sentiment analysis"
          onSubmit={handleTradingStyleCustom}
          validate={required('Trading style')}
        />
      )}

      {subStep === 'sectors' && (
        <MultiSelectPrompt
          label="Which categories should your agent trade?"
          items={categoryItems}
          defaultSelected={DEFAULT_SECTOR_VALUES}
          hint="Recommended categories selected — press spacebar to toggle"
          onSubmit={handleSectors}
        />
      )}

      {subStep === 'sentiment' && (
        <SelectPrompt
          label="What's your agent's market sentiment?"
          items={sentimentItems}
          onSelect={handleSentimentSelect}
        />
      )}

      {subStep === 'timeframe' && (
        <Box flexDirection="column">
          <MultiSelectPrompt
            label="Which timeframes should your agent participate in?"
            items={timeframeItems}
            defaultSelected={timeframeDefaultSelected}
            hint="all timeframes selected by default — press spacebar to toggle"
            onSubmit={handleTimeframes}
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
            onSubmit={handleBio}
            maxLength={1000}
            validate={compose(required('Bio'), maxLength(1000))}
          />
        </Box>
      )}
    </Box>
  );
}
