import 'dotenv/config';
import { ExchangeClient, HttpTransport, InfoClient } from '@nktkas/hyperliquid';
import { formatPrice, formatSize, SymbolConverter } from '@nktkas/hyperliquid/utils';
import { privateKeyToAccount } from 'viem/accounts';

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

  const meta = await info.meta();

  const sol = meta.universe.find((u) => u.name === 'SOL');

  try {
    const coin = 'ETH';
    const size = '0.1';
    const isBuy = true;
    const tolerance = 0.01; // 1% price buffer
    const converter = await SymbolConverter.create({ transport });

    // Get aggressive price based on current mid price with tolerance
    const mids = await info.allMids();
    const mid = parseFloat(mids[coin]);
    const price = mid * (1 + (isBuy ? tolerance : -tolerance));

    // ! asserts the symbol exists - handle undefined in production
    const assetId = converter.getAssetId(coin)!;
    const szDecimals = converter.getSzDecimals(coin)!;

    // Place IoC order with aggressive price to ensure fill
    const res = await exchange.order({
      orders: [
        {
          a: assetId,
          b: isBuy,
          p: formatPrice(price, szDecimals),
          s: formatSize(size, szDecimals),
          r: false,
          t: { limit: { tif: 'Ioc' } },
        },
      ],
      grouping: 'na',
    });
    console.log(res);
    // const res = await exchange.order({
    //   orders: [
    //     {
    //       a: 0, // SOL
    //       b: true, // short
    //       p: '79.639',
    //       s: '2.51',
    //       r: false,
    //       t: { limit: { tif: 'Gtc' } },
    //     },
    //   ],
    //   grouping: 'na',
    // });
  } catch (error) {
    console.log(error);
  }
})();
