import React, { useCallback, useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import fs from 'fs-extra';
import path from 'path';
import { SearchSelect, type SearchSelectItem } from './SearchSelect';
import { Spinner } from './Spinner';
import { ZhiveExchange } from '../shared/trading/exchange/zhive';
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assets, setAssets] = useState<SearchSelectItem[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    ZhiveExchange.create()
      .then((exchange) => exchange.getAvailableTradingPairs())
      .then((pairs) => {
        setAssets(pairs.map((p) => ({ label: p, value: p })));
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to fetch assets');
        setLoading(false);
      });
  }, []);

  const handleSubmit = useCallback(
    async (selected: SearchSelectItem[]) => {
      setSaving(true);
      try {
        const config = await loadConfig();
        if (!config) {
          throw new Error('config not found');
        }
        config.watchList = selected.map((s) => s.value);
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

  if (loading) {
    return (
      <Box paddingLeft={1}>
        <Spinner label="Fetching available assets from Hyperliquid..." />
      </Box>
    );
  }

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

  const defaultSelected = currentWatchlist.length > 0 ? new Set(currentWatchlist) : undefined;

  return (
    <Box flexDirection="column" paddingLeft={1}>
      <SearchSelect
        label="Update your watchlist"
        items={assets}
        defaultSelected={defaultSelected}
        onSubmit={handleSubmit}
        onBack={onClose}
      />
    </Box>
  );
}
