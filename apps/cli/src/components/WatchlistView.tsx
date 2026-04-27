import React, { useCallback, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { WatchlistSelector } from './WatchlistSelector';
import { Spinner } from './Spinner';
import { colors, symbols } from '../commands/shared/theme';
import { loadConfig, saveConfig } from '@zhive/sdk';

interface WatchlistViewProps {
  currentWatchlist: string[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function WatchlistView({
  currentWatchlist,
  onClose,
  onSaved,
}: WatchlistViewProps): React.ReactElement {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useInput((_input, key) => {
    if (key.escape && (saving || error)) {
      onClose();
    }
  });

  const handleSubmit = useCallback(
    async (assets: string[]) => {
      setSaving(true);
      try {
        const config = await loadConfig();
        if (!config) {
          throw new Error('config not found');
        }
        config.watchList = assets;
        await saveConfig(config);
        await onSaved();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save watchlist');
        setSaving(false);
      }
    },
    [onSaved, onClose],
  );

  if (saving) {
    return (
      <Box paddingLeft={1}>
        <Spinner label="Saving watchlist..." />
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" paddingLeft={1}>
        <Text color={colors.red}>
          {symbols.cross} {error}
        </Text>
        <Text color={colors.grayDim}>
          Press <Text color={colors.honey}>esc</Text> to go back
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingLeft={1}>
      <WatchlistSelector
        defaultSelected={currentWatchlist}
        onSubmit={handleSubmit}
        onBack={onClose}
      />
    </Box>
  );
}
