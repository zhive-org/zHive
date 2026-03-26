import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text } from 'ink';
import axios from 'axios';
import { TextPrompt } from '../../../../components/TextPrompt.js';
import { Spinner } from '../../../../components/Spinner.js';
import { colors, symbols } from '../../../shared/theme.js';
import { HIVE_API_URL } from '../../../../shared/config/constant.js';
import { agentName as validateAgentName, required, compose, maxLength } from '../../validation.js';
import { BIO_EXAMPLES } from '../../presets/index.js';

const ADJECTIVES = [
  'royal',
  'golden',
  'buzzy',
  'honey',
  'sweet',
  'stung',
  'waxed',
  'bold',
  'swift',
  'wild',
  'keen',
  'warm',
  'hazy',
  'calm',
  'busy',
  'amber',
  'pollen',
  'nectar',
  'floral',
  'sunny',
  'misty',
  'fuzzy',
  'striped',
  'waggle',
  'silent',
  'fierce',
  'humble',
  'lunar',
  'solar',
  'bloomed',
  'bullish',
  'bearish',
  'staked',
  'minted',
  'forked',
  'based',
  'degen',
  'pumped',
  'longed',
  'shorted',
  'bridged',
  'pegged',
  'hodl',
  'mega',
  'alpha',
  'sigma',
  'hyper',
  'ultra',
  'rapid',
  'atomic',
];

const NOUNS = [
  'bee',
  'drone',
  'queen',
  'swarm',
  'hive',
  'comb',
  'larva',
  'pupa',
  'sting',
  'apiary',
  'keeper',
  'mead',
  'pollen',
  'nectar',
  'propolis',
  'colony',
  'brood',
  'waggle',
  'cell',
  'wax',
  'bloom',
  'blossom',
  'hornet',
  'bumble',
  'worker',
  'forager',
  'scout',
  'smoker',
  'whale',
  'bull',
  'bear',
  'shard',
  'block',
  'node',
  'vault',
  'ledger',
  'oracle',
  'miner',
  'staker',
  'bridge',
  'token',
  'chain',
  'wick',
  'candle',
  'pump',
  'moon',
  'floor',
  'whale',
];

function generateRandomName(): string {
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]!;
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]!;
  const number = Math.floor(Math.random() * 900) + 100;
  return `${adjective}-${noun}-${number}`;
}

export interface AgentIdentityResult {
  name: string;
  bio: string;
  avatarUrl: string;
}

interface AgentIdentityStepProps {
  initialValues?: Partial<AgentIdentityResult>;
  onComplete: (result: AgentIdentityResult) => void;
}

type SubStep = 'name' | 'bio' | 'avatar';

export function AgentIdentityStep({
  initialValues,
  onComplete,
}: AgentIdentityStepProps): React.ReactElement {
  const [subStep, setSubStep] = useState<SubStep>(initialValues?.name ? 'bio' : 'name');
  const [name, setName] = useState(initialValues?.name ?? '');
  const [bio, setBio] = useState(initialValues?.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(initialValues?.avatarUrl ?? '');
  const [checking, setChecking] = useState(false);
  const [nameError, setNameError] = useState('');
  const placeholder = useMemo(() => generateRandomName(), []);

  const handleNameSubmit = useCallback(async (value: string) => {
    setChecking(true);
    setNameError('');

    try {
      const response = await axios.get<{ available: boolean }>(`${HIVE_API_URL}/agent/check-name`, {
        params: { name: value },
        timeout: 3000,
      });

      if (!response.data.available) {
        setNameError(`Name "${value}" is already taken`);
        setChecking(false);
        return;
      }
    } catch {
      // best-effort: silently proceed if backend is unavailable
    }

    setChecking(false);
    setName(value);
    setSubStep('bio');
  }, []);

  const handleBioSubmit = useCallback((value: string) => {
    setBio(value);
    setSubStep('avatar');
  }, []);

  const handleAvatarSubmit = useCallback(
    (value: string) => {
      const defaultUrl = `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(name)}`;
      const finalUrl = value || defaultUrl;
      setAvatarUrl(finalUrl);
      onComplete({ name, bio, avatarUrl: finalUrl });
    },
    [name, bio, onComplete],
  );

  const handleSubStepBack = useCallback(() => {
    switch (subStep) {
      case 'bio':
        setSubStep('name');
        break;
      case 'avatar':
        setSubStep('bio');
        break;
    }
  }, [subStep]);

  const defaultAvatarUrl = name
    ? `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(name)}`
    : '';

  return (
    <Box flexDirection="column">
      {/* Summary of filled values */}
      {(name || bio) && (
        <Box flexDirection="column" marginLeft={2} marginBottom={1}>
          {name && (
            <Text color={colors.gray}>
              {symbols.check} Name: <Text color={colors.honey}>{name}</Text>
            </Text>
          )}
          {bio && (
            <Text color={colors.gray}>
              {symbols.check} Bio:{' '}
              <Text color={colors.honey}>{bio.length > 60 ? bio.slice(0, 60) + '...' : bio}</Text>
            </Text>
          )}
        </Box>
      )}

      {subStep === 'name' && !checking && (
        <Box flexDirection="column">
          <TextPrompt
            label="Enter your agent name"
            placeholder={placeholder}
            defaultValue={name || undefined}
            onSubmit={handleNameSubmit}
            validate={validateAgentName}
          />
          {nameError !== '' && (
            <Box marginLeft={2}>
              <Text color={colors.red}>
                {symbols.cross} {nameError}
              </Text>
            </Box>
          )}
        </Box>
      )}

      {subStep === 'name' && checking && (
        <Box flexDirection="column">
          <Spinner label="Checking name availability..." />
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
            placeholder="A short description of your agent"
            defaultValue={bio || undefined}
            onSubmit={handleBioSubmit}
            onBack={handleSubStepBack}
            maxLength={1000}
            validate={compose(required('Bio'), maxLength(1000))}
          />
        </Box>
      )}

      {subStep === 'avatar' && (
        <Box flexDirection="column">
          <Box marginBottom={1} marginLeft={2}>
            <Text color={colors.gray}>
              {symbols.diamond} Default: <Text color={colors.honey}>{defaultAvatarUrl}</Text>
            </Text>
          </Box>
          <TextPrompt
            label="Avatar image URL (press Enter for default)"
            placeholder={defaultAvatarUrl}
            defaultValue={avatarUrl || undefined}
            onBack={handleSubStepBack}
            onSubmit={handleAvatarSubmit}
            validate={(val) => {
              if (!val) return true;
              if (!val.startsWith('http://') && !val.startsWith('https://'))
                return 'Must start with http:// or https://';
              return true;
            }}
          />
        </Box>
      )}
    </Box>
  );
}
