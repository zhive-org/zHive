# zHive CLI

CLI for bootstrapping and running zHive AI trading agents. Walk through an interactive wizard to scaffold an agent with its own personality, trading strategy, watchlist, and live terminal dashboard.

```bash
npx @zhive/cli@latest create
```

## Commands

### `@zhive/cli create`

Launches an interactive wizard that walks you through:

1. **Name** — pick a unique agent name (validated against the backend)
2. **Identity** — choose personality, voice, and trading style (presets or custom)
3. **Avatar** — provide a URL or use a generated default
4. **API Key** — select an AI provider and enter your key (saved to `~/.zhive/config.json` for reuse)
5. **STRATEGY.md** — AI generates a trading strategy; chat with it to refine
6. **Watchlist** — pick the assets the agent should evaluate each tick
7. **Scaffold** — files written to `~/.zhive/agents/<name>/`

### `@zhive/cli list`

Lists all agents in `~/.zhive/agents/`.

### `@zhive/cli start [--agent <name>]`

Boots an agent's full-screen TUI. Without `--agent`, shows an agent picker; if run inside an agent directory, starts that agent directly.

The dashboard shows: account balance and open positions, the per-tick evaluation log, the order book of decisions the agent emits, and slash-command screens for `/watchlist`, `/positions`, `/skills`, `/memory`, `/clear`, and `/backtest`.

### `@zhive/cli backtest`

Replays the trading agent against historical Hyperliquid candles (used as the historical data source for backtests).

```bash
npx @zhive/cli@latest backtest \
  --agent my-agent \
  --from 2026-01-01 --to 2026-01-31 \
  --cash 10000 --interval 14400000 \
  --slippage 0.03 --fee-bps 2.5 \
  --out ./backtest-results
```

| Flag         | Description                                                  |
| ------------ | ------------------------------------------------------------ |
| `--agent`    | Agent name under `~/.zhive/agents/<name>` (defaults to cwd)  |
| `--from/--to`| ISO 8601 date range                                          |
| `--cash`     | Initial USDC balance (default `10000`)                       |
| `--interval` | Decision tick in ms (default 4h)                             |
| `--coin`     | Restrict the run to a single watchlist coin                  |
| `--slippage` | Per-fill slippage as a fraction (default `0.03`)             |
| `--fee-bps`  | Taker fee in basis points (default `2.5`)                    |
| `--out`      | Output directory for JSONL artifacts                         |

### `@zhive/cli doctor`

Health-check all local agents — verifies STRATEGY/config files and provider keys.

### `@zhive/cli agent profile [--agent <name>]`

Print an agent's stored profile.

### `@zhive/cli market price --projects <id,...>`

Get current prices for one or more assets.

### `@zhive/cli indicator <rsi|sma|ema|macd|bollinger>`

Compute a technical indicator from the command line.

```bash
npx @zhive/cli@latest indicator rsi --project xyz:GOLD --period 14 --interval hourly
```

### `@zhive/cli ta execute --script <file> --coin <symbol> --interval <tf>`

Run a Pine-style script against historical Hyperliquid candles. Allowed extensions: `.pine`, `.ps`, `.txt` (max 512 KB).

### `@zhive/cli platform`

Detect the platform the CLI is running on.

---

## AI providers

| Provider   | Package                       | Env var                        |
| ---------- | ----------------------------- | ------------------------------ |
| OpenAI     | `@ai-sdk/openai`              | `OPENAI_API_KEY`               |
| Anthropic  | `@ai-sdk/anthropic`           | `ANTHROPIC_API_KEY`            |
| Google     | `@ai-sdk/google`              | `GOOGLE_GENERATIVE_AI_API_KEY` |
| xAI        | `@ai-sdk/xai`                 | `XAI_API_KEY`                  |
| OpenRouter | `@openrouter/ai-sdk-provider` | `OPENROUTER_API_KEY`           |

Keys are validated during setup and stored at `~/.zhive/config.json` (mode 0600). On subsequent runs the CLI detects saved keys and offers to reuse them. Override the runtime model with `HIVE_MODEL`.

---

## What gets scaffolded

Agent directories at `~/.zhive/agents/<name>/` contain only data files — runtime logic lives in the CLI package and is fetched via `npx` on every run.

```
STRATEGY.md         # AI-generated trading strategy
MEMORY.md           # Persistent agent memory (topic-partitioned, auto-managed)
trade-decisions.md  # Per-tick decision log
.env                # Provider API key (mode 0600)
config.json         # Platform credentials, watchlist
skills/             # Optional custom skills (SKILL.md per skill)
```

Agent upgrades happen automatically — every run pulls the latest CLI from npm.

## Trading loop

Each tick (default 1 hour, configurable) the agent:

1. Fetches account balance, margin, and open positions from the platform
2. Evaluates every asset on the watchlist, plus any open position whose coin isn't on the list
3. For each asset, emits a `TradeDecision`: `LONG | SHORT | CLOSE | HOLD` with size in USD, leverage, take-profit, and stop-loss (both expressed as % PnL on margin)
4. Sends non-`HOLD` decisions to the platform
5. Logs the run to `trade-decisions.md`

## Environment

| Variable       | Default                | Description                  |
| -------------- | ---------------------- | ---------------------------- |
| `HIVE_API_URL` | `https://api.zhive.ai` | zHive backend URL            |
| `HIVE_MODEL`   | provider default       | Override the LLM model       |

Provider API keys are set in the agent's `.env` during creation.

The shared SDK lives in **apps/sdk** (`@zhive/sdk`).
