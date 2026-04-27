import React, { useCallback } from 'react';
import { WatchlistSelector } from '../../../../components/WatchlistSelector.js';
import { useWizard } from '../wizard-context.js';

export function WatchlistStep(): React.ReactElement {
  const { state, dispatch } = useWizard();

  const handleSubmit = useCallback(
    (assets: string[]) => {
      dispatch({ type: 'SET_WATCHLIST', payload: { assets } });
    },
    [dispatch],
  );

  const handleBack = useCallback(() => {
    dispatch({ type: 'GO_BACK' });
  }, [dispatch]);

  return (
    <WatchlistSelector
      defaultSelected={state.watchlist.assets}
      onSubmit={handleSubmit}
      onBack={handleBack}
    />
  );
}
