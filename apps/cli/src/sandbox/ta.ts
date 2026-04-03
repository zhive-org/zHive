import { join } from 'path';
import { initializeAgentRuntime } from '../shared/agent/runtime';
import { AssetAnalyzer } from '../shared/trading/analyzer';
import { getHiveDir } from '../shared/config/constant';
import { MarketService } from '../shared/trading/market';
import { HttpTransport, InfoClient } from '@nktkas/hyperliquid';
import { loadAgentEnv } from '../shared/config/env-loader';

(async () => {
  const agentDir = join(getHiveDir(), 'agents', 'a17z');
  process.chdir(agentDir);

  await loadAgentEnv();
  const runtime = await initializeAgentRuntime();
  const transport = new HttpTransport({ isTestnet: true });
  const info = new InfoClient({ transport });
  const marketService = new MarketService(info);
  const analyzer = new AssetAnalyzer(runtime, marketService);

  const ctx = await marketService.getAssetContext('BTC');
  if (!ctx) {
    console.error('Asset context not found for BTC');
    return;
  }
  const out = await analyzer.analyze('BTC', ctx);
  console.log(out);
})();
