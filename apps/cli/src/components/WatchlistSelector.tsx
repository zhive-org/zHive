import { Box, Text, useInput } from 'ink';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SearchSelect, type SearchSelectItem } from './SearchSelect.js';
import { Spinner } from './Spinner.js';
import { ZhiveExchange } from '../shared/trading/exchange/zhive.js';
import type { TradingCategory } from '../shared/trading/exchange/types.js';
import { colors, symbols } from '../commands/shared/theme.js';

const CATEGORIES: { id: TradingCategory; label: string }[] = [
  { id: 'stock-commodity', label: 'Stocks & Commodities' },
  { id: 'crypto', label: 'Crypto' },
];

type AssetsByCat = Record<TradingCategory, SearchSelectItem[]>;

interface WatchlistSelectorProps {
  defaultSelected?: string[];
  onSubmit: (assets: string[]) => void;
  onBack?: () => void;
}

export function WatchlistSelector({
  defaultSelected,
  onSubmit,
  onBack,
}: WatchlistSelectorProps): React.ReactElement {
  const [loading, setLoading] = useState(true);
  const [assetsByCat, setAssetsByCat] = useState<AssetsByCat>({
    'stock-commodity': [],
    crypto: [],
  });
  const [activeCat, setActiveCat] = useState<TradingCategory>('stock-commodity');
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(defaultSelected ?? []),
  );
  const [fetchError, setFetchError] = useState('');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const exchange = await ZhiveExchange.create();
        const [stockCom, crypto] = await Promise.all([
          exchange.getAvailableTradingPairs('stock-commodity'),
          exchange.getAvailableTradingPairs('crypto'),
        ]);
        if (cancelled) return;
        setAssetsByCat({
          'stock-commodity': stockCom.map((n) => ({ label: n, value: n })),
          crypto: crypto.map((n) => ({ label: n, value: n })),
        });
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setFetchError(err instanceof Error ? err.message : 'Failed to fetch assets');
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useInput((_input, key) => {
    if (key.escape && (loading || fetchError) && onBack) {
      onBack();
      return;
    }
    if (loading || fetchError) return;
    if (key.leftArrow || key.rightArrow) {
      const idx = CATEGORIES.findIndex((c) => c.id === activeCat);
      const nextIdx = key.leftArrow
        ? (idx - 1 + CATEGORIES.length) % CATEGORIES.length
        : (idx + 1) % CATEGORIES.length;
      setActiveCat(CATEGORIES[nextIdx].id);
    }
  });

  const handleSubmit = useCallback(() => {
    if (selected.size === 0) {
      setValidationError('Please select at least one asset');
      return;
    }
    setValidationError('');
    onSubmit(Array.from(selected));
  }, [onSubmit, selected]);

  const allSelectedItems = useMemo(() => {
    const all = [...assetsByCat['stock-commodity'], ...assetsByCat.crypto];
    return all.filter((i) => selected.has(i.value));
  }, [assetsByCat, selected]);

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

  const activeLabel = CATEGORIES.find((c) => c.id === activeCat)!.label;
  const SIDEBAR_MAX = 10;

  return (
    <Box flexDirection="column">
      <Box marginLeft={2} marginBottom={1}>
        {CATEGORIES.map((c) => {
          const isActive = c.id === activeCat;
          return (
            <Box key={c.id} marginRight={2}>
              <Text color={isActive ? colors.honey : colors.grayDim} bold={isActive}>
                {isActive ? `[ ${c.label} ]` : `  ${c.label}  `}
              </Text>
            </Box>
          );
        })}
        <Text color={colors.grayDim}>
          (<Text color={colors.honey}>← →</Text> switch category)
        </Text>
      </Box>

      <Box flexDirection="row" columnGap={4}>
        <SearchSelect
          key={activeCat}
          label={`Select ${activeLabel}`}
          items={assetsByCat[activeCat]}
          selected={selected}
          onSelectedChange={setSelected}
          onSubmit={handleSubmit}
          onBack={onBack}
        />

        {allSelectedItems.length > 0 && (
          <Box flexDirection="column">
            <Text color={colors.white} bold>
              Selected ({allSelectedItems.length})
            </Text>
            <Box flexDirection="column" marginTop={1}>
              {allSelectedItems.slice(0, SIDEBAR_MAX).map((item) => (
                <Box key={item.value}>
                  <Text color={colors.honey}>◆ </Text>
                  <Text color={colors.honey}>{item.label}</Text>
                </Box>
              ))}
              {allSelectedItems.length > SIDEBAR_MAX && (
                <Text color={colors.grayDim}>
                  +{allSelectedItems.length - SIDEBAR_MAX} more
                </Text>
              )}
            </Box>
          </Box>
        )}
      </Box>

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
