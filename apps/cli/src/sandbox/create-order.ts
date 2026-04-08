import 'dotenv/config';
import { ExchangeClient, HttpTransport, InfoClient } from '@nktkas/hyperliquid';
import { formatPrice, formatSize, SymbolConverter } from '@nktkas/hyperliquid/utils';
import { privateKeyToAccount } from 'viem/accounts';
import { TradeDecision } from '../shared/trading/types';
import { TradeExecutor } from '../shared/trading/executor';
import { HyperliquidMarketService } from '../shared/trading/market';

(async () => {
  const order = {
    a: 0, // SOL
    b: true, // short
    p: '77.243040',
    sz: '2.51',
    r: false,
    t: { limit: { tif: 'FrontendMarket' } },
  };

  const transport = new HttpTransport({ isTestnet: true });
  const wallet = privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`);

  const info = new InfoClient({ transport });
  const exchange = new ExchangeClient({ transport, wallet });
  const converter = await SymbolConverter.create({ transport });

  const executor = new TradeExecutor(exchange, info, converter);

  const market = new HyperliquidMarketService(info);
  const account = await market.fetchAccountState(process.env.WALLET_ADDRESS as `0x${string}`);

  const res = await executor.execute(
    {
      coin: 'SOL',
      action: 'LONG',
      sizeUsd: 100,
      leverage: 1,
      reasoning: 'Test order',
      sl: 80,
    },
    account,
  );
  console.log(res);
})();
