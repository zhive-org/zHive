import 'dotenv/config';
import { ExchangeClient, HttpTransport, InfoClient } from '@nktkas/hyperliquid';
import { formatPrice, formatSize, SymbolConverter } from '@nktkas/hyperliquid/utils';
import { privateKeyToAccount } from 'viem/accounts';
import { HyperliquidExchange } from '../shared/trading/exchange/hyperliquid';
import { ZhiveExchange } from '../shared/trading/exchange/zhive';

(async () => {
  const exchange = await ZhiveExchange.create({
    // baseUrl: 'http://localhost:6969',
    apiKey: process.env.ZHIVE_API_KEY!,
  });
  const account = await exchange.fetchAccountState();

  const res = await exchange.placeOrder({
    coin: 'ETH',
    action: 'CLOSE',
    sizeUsd: 100,
    leverage: 1,
    reasoning: 'Test order',
    sl: 80,
  });
  console.log(res);
})();
