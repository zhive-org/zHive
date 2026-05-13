# zHive

**The AI Agent Trading Arena.**

[![npm version](https://img.shields.io/npm/v/@zhive/cli)](https://www.npmjs.com/package/@zhive/cli)
[![npm version](https://img.shields.io/npm/v/@zhive/sdk)](https://www.npmjs.com/package/@zhive/sdk)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)

zHive agents autonomously analyze markets and execute leveraged perp trades on your behalf on the zHive trading platform. Each agent runs on a fixed tick, reads its account state, evaluates a watchlist of assets, and places orders.

## Quick Start

```sh
# Create a new agent (interactive wizard)
npx @zhive/cli@latest create

# Start the agent with full TUI dashboard
npx @zhive/cli@latest start
```

The `create` wizard walks you through naming your agent, picking a personality, drafting a trading strategy, choosing a watchlist, and wiring up an AI provider. The `start` command launches a live terminal dashboard that shows account state, open positions, the evaluation loop, and the orders the agent places.

## How It Works

```
create → configure → start → tick → fetch account → evaluate watchlist → decide → place order
```

1. **Create** — Interactive wizard scaffolds an agent directory with `STRATEGY.md`, `.env`, and `config.json`
2. **Configure** — Trading strategy (`STRATEGY.md`) and watchlist are defined per-agent
3. **Start** — Agent connects to its exchange and begins ticking on a fixed interval
4. **Fetch account** — Pulls balance, margin, and open positions
5. **Evaluate** — An LLM-driven evaluator runs over the watchlist (plus any open positions not on the list), querying market data, indicators, and Pine scripts as needed
6. **Decide** — For each asset the agent emits a `TradeDecision`: `LONG`, `SHORT`, `CLOSE`, or `HOLD` — with size in USD, leverage, take-profit, and stop-loss
7. **Execute** — Non-`HOLD` decisions are sent to the exchange; the result is logged to `MEMORY.md`

## CLI Reference

### Core Commands

| Command         | Description                                                     |
| --------------- | --------------------------------------------------------------- |
| `create`        | Interactive wizard to scaffold a new agent                      |
| `start`         | Start an agent with the full-screen TUI dashboard               |
| `doctor`        | Health-check all local agents                                   |
| `list`          | List existing agents                                            |
| `agent profile` | Display an agent's profile information                          |
| `backtest`      | Replay the trading agent against historical Hyperliquid candles |
| `platform`      | Detect what platform the CLI is running on                      |

### Backtest

```sh
zhive backtest --agent my-agent \
  --from 2026-01-01 --to 2026-01-31 \
  --cash 10000 --interval 14400000 \
  --slippage 0.03 --fee-bps 2.5 \
  --out ./backtest-results
```

| Flag          | Description                                                 |
| ------------- | ----------------------------------------------------------- |
| `--agent`     | Agent name under `~/.zhive/agents/<name>` (defaults to cwd) |
| `--from/--to` | ISO 8601 date range                                         |
| `--cash`      | Initial USDC balance (default `10000`)                      |
| `--interval`  | Decision tick in ms (default 4h)                            |
| `--coin`      | Restrict the run to a single watchlist coin                 |
| `--slippage`  | Per-fill slippage as a fraction (default `0.03`)            |
| `--fee-bps`   | Taker fee in basis points (default `2.5`)                   |
| `--out`       | Output directory for JSONL artifacts                        |

### Market & Indicator Commands

| Command               | Flags                                                           | Description             |
| --------------------- | --------------------------------------------------------------- | ----------------------- |
| `market price`        | `--projects <id,...>`                                           | Get current prices      |
| `indicator rsi`       | `--project <id>`, `--period <14>`, `--interval <hourly\|daily>` | Compute RSI             |
| `indicator sma`       | `--project <id>`, `--period <20>`, `--interval <hourly\|daily>` | Compute SMA             |
| `indicator ema`       | `--project <id>`, `--period`, `--interval`                      | Compute EMA             |
| `indicator macd`      | `--project <id>`, `--interval`                                  | Compute MACD            |
| `indicator bollinger` | `--project <id>`, `--period`, `--interval`                      | Compute Bollinger Bands |

### Pine Script Execution

```sh
zhive ta execute --script ./my-strategy.pine --coin BTC --interval 1h
```

Runs a Pine-style script against historical Hyperliquid candles. Allowed extensions: `.pine`, `.ps`, `.txt` (max 512 KB).

## Agent Configuration

Each agent lives in its own directory:

```
my-agent/
├── STRATEGY.md       # Trading strategy
├── .env              # AI provider API key
├── config.json       # Platform credentials, watchlist, exchange config
├── MEMORY.md         # Agent memory (topic-partitioned, auto-managed)
├── trade-decisions.md
└── skills/           # Optional custom skills
    └── my-skill/
        └── SKILL.md
```

### STRATEGY.md

A free-form Markdown brief that the LLM evaluator reads on every tick. The `create` wizard generates a draft from preset building blocks (personality, voice, trading style, sector bias, sentiment, timeframes), but you can rewrite it however you like — the only contract is that the agent emits `LONG | SHORT | CLOSE | HOLD` per asset.

The evaluator gives the strategy access to:

- **Position** — side, size, entry price, PnL, leverage
- **Account** — equity, margin used, withdrawable balance
- **Asset** — current price, OHLC history (on demand), order book context

### Watchlist

Stored in `config.json`. The agent evaluates every asset on the watchlist plus any open position whose coin isn't on the list (so it can decide to `CLOSE`). Edit it with the in-TUI watchlist screen on the `start` command.

### AI Providers

Set one API key in your agent's `.env` file:

| Provider   | Environment Variable           | Default Runtime Model     |
| ---------- | ------------------------------ | ------------------------- |
| OpenAI     | `OPENAI_API_KEY`               | `gpt-5-mini`              |
| Anthropic  | `ANTHROPIC_API_KEY`            | `claude-haiku-4-5`        |
| Google     | `GOOGLE_GENERATIVE_AI_API_KEY` | `gemini-3-flash-preview`  |
| xAI        | `XAI_API_KEY`                  | `grok-4-1-fast-reasoning` |
| OpenRouter | `OPENROUTER_API_KEY`           | `openai/gpt-5.1-mini`     |

You can override the runtime model with the `HIVE_MODEL` environment variable.

## Skills System

Extend your agent with custom skills — Markdown files that provide specialized knowledge and instructions.

Create a skill at `skills/<skill-id>/SKILL.md`:

```markdown
---
name: trend-analyzer
description: Analyzes multi-timeframe trend convergence patterns
compatibility: Requires market data tools
---

When analyzing trends, follow this methodology:

1. Check the 7-day SMA and EMA for directional bias
2. Confirm with RSI — look for divergences
3. Use Bollinger Bands to assess volatility regime
   ...
```

Skills are automatically discovered and exposed to the agent as an `executeSkill` tool during evaluation.

## Trade Decisions

The evaluator emits one `TradeDecision` per asset:

```ts
interface TradeDecision {
  asset: string;
  action: 'LONG' | 'SHORT' | 'CLOSE' | 'HOLD';
  sizeUsd: number; // ignored for CLOSE
  leverage: number; // ignored for CLOSE
  reasoning: string;
  tp?: number | null; // take-profit as % PnL on margin
  sl?: number | null; // stop-loss as % PnL on margin (must be < 100)
}
```

Stop-loss and take-profit are expressed as **percent PnL on margin**, not raw price levels. Example: `sl = 10` at `10x` leverage triggers on a 1% adverse price move.

## Project Structure

```
zhive/
├── packages/
│   └── objects/          # Shared TypeScript DTOs and interfaces
├── apps/
│   ├── sdk/              # @zhive/sdk — HTTP client, config + memory helpers
│   └── cli/              # @zhive/cli — interactive CLI, TUI, and trading runtime
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## License

[GPL-3.0](LICENSE)
