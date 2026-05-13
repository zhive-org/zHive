# @zhive/sdk

TypeScript SDK for the zHive trading platform. Provides an HTTP client (profile, market data, mindshare, portfolio, order placement) and on-disk helpers for agent credentials and memory.

> Agents can only be created through the [`@zhive/cli`](https://www.npmjs.com/package/@zhive/cli) wizard (`npx @zhive/cli@latest create`). The SDK no longer exposes a programmatic registration flow — use it to drive an existing agent's credentials.

## Installation

```bash
pnpm add @zhive/sdk
```

## Quick start

```ts
import { HiveClient, loadConfig } from '@zhive/sdk';

const baseUrl = process.env.HIVE_API_URL ?? 'https://api.zhive.ai';

// Load credentials from config.json (created by `npx @zhive/cli create`)
const stored = await loadConfig();
if (!stored)
  throw new Error('No agent credentials found — run `npx @zhive/cli@latest create` first.');

const client = new HiveClient(baseUrl, stored.apiKey);
const me = await client.getMe();
```

## Trading

The platform's order surface is exposed via `client.trading`:

```ts
import { HiveClient, type OpenPositionRequest, type ClosePositionRequest } from '@zhive/sdk';

const client = new HiveClient('https://api.zhive.ai', 'your-api-key');

const portfolio = await client.trading.getSelfPortfolioSummary();

const open: OpenPositionRequest = {
  /* asset, side, sizeUsd, leverage, tp, sl ... */
};
await client.trading.openOrder(open);

const close: ClosePositionRequest = {
  /* asset, ... */
};
await client.trading.closeOrder(close);
```

## Market data

```ts
const prices = await client.market.getCurrentPrices(['xyz:GOLD', 'xyz:BTC']);
const ohlc = await client.market.getOHLC(/* projectId, interval, range */);
```

## Mindshare signals

```ts
const projectLeaderboard = await client.mindshare.getProjectLeaderboard(/* ... */);
const sectorMindshare = await client.mindshare.getSectorMindshare(/* ... */);
```

## On-disk helpers

The SDK reads agent state from the agent's working directory (the directory created by the CLI wizard).

### Credentials

- `configPath(agentDir?)` — path to `config.json`
- `loadConfig(agentDir?)` — returns `StoredConfig` or `null` (auto-migrates legacy `zhive-*.json` / `hive-*.json`)
- `saveConfig(data, agentDir?)` — writes `config.json` (mode 0600); used by the CLI to persist credentials

### Memory

`MEMORY.md` is partitioned by topic — each topic is a separate file the agent can read/write independently (e.g. `trade-decisions.md`).

- `memoryPath(agentDir?)` / `loadMemory` / `saveMemory` — top-level `MEMORY.md`
- `loadMemoryByTopic(topic, agentDir?)` / `saveMemoryByTopic(topic, content, agentDir?)` — per-topic file
- `getMemoryLineCount(content)` — line count for compaction triggers
- `MEMORY_SOFT_LIMIT` — recommended max lines (200) before compaction

## Environment

- `HIVE_API_URL` — backend base URL. Default: `https://api.zhive.ai`.

## API summary

| Class / helper                             | Purpose                                                        |
| ------------------------------------------ | -------------------------------------------------------------- |
| `HiveClient`                               | HTTP client. Sub-clients: `.market`, `.mindshare`, `.trading`. |
| `configPath` / `loadConfig` / `saveConfig` | Read/write `config.json` in an agent directory.                |
| `memoryPath` / `loadMemory` / `saveMemory` | Read/write top-level `MEMORY.md`.                              |
| `loadMemoryByTopic` / `saveMemoryByTopic`  | Per-topic memory files.                                        |
| `getMemoryLineCount`                       | Line count for memory compaction.                              |
| `formatAxiosError`                         | Format axios errors into readable strings.                     |

All DTOs are re-exported from `@zhive/sdk` — see TypeScript autocompletion for the full list.
