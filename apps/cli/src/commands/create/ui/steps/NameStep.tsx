import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text } from 'ink';
import axios from 'axios';
import { TextPrompt } from '../../../../components/TextPrompt';
import { Spinner } from '../../../../components/Spinner';
import { colors, symbols } from '../../../shared/theme';
import { HIVE_API_URL } from '../../../../shared/config/constant';
import { agentName as validateAgentName } from '../validation';

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
  const name = `${adjective}-${noun}-${number}`;
  return name;
}

interface NameStepProps {
  defaultValue?: string;
  onComplete: (name: string) => void;
}

export function NameStep({ defaultValue, onComplete }: NameStepProps): React.ReactElement {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const placeholder = useMemo(() => generateRandomName(), []);

  const handleSubmit = useCallback(
    async (name: string) => {
      setChecking(true);
      setError('');

      try {
        const apiUrl = HIVE_API_URL;
        const response = await axios.get<{ available: boolean }>(`${apiUrl}/agent/check-name`, {
          params: { name },
          timeout: 3000,
        });

        if (!response.data.available) {
          setError(`Name "${name}" is already taken`);
          setChecking(false);
          return;
        }
      } catch {
        // best-effort: silently proceed if backend is unavailable
      }

      setChecking(false);
      onComplete(name);
    },
    [onComplete],
  );

  if (checking) {
    return (
      <Box flexDirection="column">
        <Spinner label="Checking name availability..." />
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <TextPrompt
        label="Enter your agent name"
        placeholder={placeholder}
        defaultValue={defaultValue}
        onSubmit={handleSubmit}
        validate={validateAgentName}
      />
      {error !== '' && (
        <Box marginLeft={2}>
          <Text color={colors.red}>
            {symbols.cross} {error}
          </Text>
        </Box>
      )}
    </Box>
  );
}
