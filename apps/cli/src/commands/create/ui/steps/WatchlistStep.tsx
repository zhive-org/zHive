import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text } from 'ink';
import { HttpTransport, InfoClient } from '@nktkas/hyperliquid';
import { HyperliquidMarketService } from '../../../../shared/trading/market.js';
import { SearchSelect, type SearchSelectItem } from '../../../../components/SearchSelect.js';
import { Spinner } from '../../../../components/Spinner.js';
import { colors, symbols } from '../../../shared/theme.js';
import { useWizard } from '../wizard-context.js';

export function WatchlistStep(): React.ReactElement {
  const { state, dispatch } = useWizard();
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<SearchSelectItem[]>([]);
  const [fetchError, setFetchError] = useState('');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    const transport = new HttpTransport({});
    const info = new InfoClient({ transport });
    const market = new HyperliquidMarketService(info);

    market
      .getAvailableAssets()
      .then((names) => {
        setAssets(names.map((n) => ({ label: n, value: n })));
        setLoading(false);
      })
      .catch((err) => {
        setFetchError(err instanceof Error ? err.message : 'Failed to fetch assets');
        setLoading(false);
      });
  }, []);

  const handleSubmit = useCallback(
    (selected: SearchSelectItem[]) => {
      if (selected.length === 0) {
        setValidationError('Please select at least one asset');
        return;
      }
      setValidationError('');
      dispatch({
        type: 'SET_WATCHLIST',
        payload: { assets: selected.map((s) => s.value) },
      });
    },
    [dispatch],
  );

  const handleBack = useCallback(() => {
    dispatch({ type: 'GO_BACK' });
  }, [dispatch]);

  if (loading) {
    return <Spinner label="Fetching available assets from Hyperliquid..." />;
  }

  if (fetchError) {
    return (
      <Box flexDirection="column" marginLeft={2}>
        <Text color={colors.red}>
          {symbols.cross} {fetchError}
        </Text>
        <Text color={colors.grayDim}>
          Press <Text color={colors.honey}>esc</Text> to go back
        </Text>
      </Box>
    );
  }

  const defaultSelected =
    state.watchlist.assets.length > 0 ? new Set(state.watchlist.assets) : undefined;

  return (
    <Box flexDirection="column">
      <SearchSelect
        label="Select assets for your watchlist"
        items={assets}
        defaultSelected={defaultSelected}
        onSubmit={handleSubmit}
        onBack={handleBack}
      />
      {validationError !== '' && (
        <Box marginLeft={2}>
          <Text color={colors.red}>
            {symbols.cross} {validationError}
          </Text>
        </Box>
      )}
    </Box>
  );
}
