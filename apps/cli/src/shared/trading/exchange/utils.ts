import { AccountSummary } from '../types';

export const getAvailableCash = (account: AccountSummary) => {
  const usdc = account.spotBalances.find((b) => b.coin === 'USDC');
  if (!usdc) {
    return 0;
  }

  const availableUsdc = parseFloat(usdc?.total ?? '0') - parseFloat(usdc?.hold ?? '0');
  return availableUsdc;
};
