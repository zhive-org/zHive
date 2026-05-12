# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo Layout

pnpm + Turborepo monorepo (Node ≥18, pnpm 9, TypeScript 5.9).

- `apps/cli` — `@zhive/cli`, the user-facing CLI/TUI and trading runtime. Bundled with `tsup` to a single ESM bin (`dist/index.js`). React/Ink for the TUI.
- `apps/sdk` — `@zhive/sdk`, HTTP client + agent config/memory helpers consumed by the CLI. Built with plain `tsc`.
- `packages/objects` — internal source-of-truth for shared DTOs (Mongo-backed types from the platform). **Not** a runtime dependency of the SDK: a `prebuild` script (`apps/sdk/scripts/generate-objects.js`) bundles selected DTO files into `apps/sdk/src/objects.ts` so the published SDK stays dep-free.
- `skills/`, `templates/` (under `apps/cli`) — Markdown skill templates shipped with the CLI; the `create` wizard scaffolds agent dirs from `apps/cli/templates`.

## Common Commands

Run from the repo root unless noted:

```sh
pnpm install                 # bootstrap all workspaces
pnpm build                   # turbo build (respects ^build deps; SDK runs prebuild → tsc, CLI runs tsup)
pnpm test                    # turbo test (vitest in CLI + SDK)
pnpm check-types             # turbo tsc --noEmit across workspaces
pnpm format                  # prettier over **/*.{ts,tsx,md}
pnpm dev                     # turbo dev (persistent; runs CLI in tsx watch mode)
```

Single-package work (run inside `apps/cli`, `apps/sdk`, or `packages/objects`):

```sh
pnpm --filter @zhive/cli dev       # tsx src/index.ts with DEV=true
pnpm --filter @zhive/cli test      # vitest --run
pnpm --filter @zhive/cli test -- path/to/file.test.ts   # single test file
pnpm --filter @zhive/cli test -- -t "pattern"           # by test name
pnpm --filter @zhive/sdk test
```

CLI release is via `apps/cli/scripts/deploy.cjs` (`pnpm --filter @zhive/cli deploy`); the repo currently ships `-canary.*` versions on the `canary` branch.

## Architecture (CLI runtime)

The interesting code lives in `apps/cli/src`. The CLI is a Commander program (`src/index.ts`) composed of subcommand factories under `src/commands/<name>/commands/index.ts` (e.g. `create`, `start`, `backtest`, `agent`, `doctor`, `indicator`, `market`, `ta`, `platform`, `list`).

Trading-runtime layering (under `src/shared/`):

- `agent/runtime.ts` — top-level tick loop driving an agent. Loads agent config + memory via `@zhive/sdk`, then calls into the trading layer per tick.
- `trading/agent.ts` + `trading/evaluator.ts` — the LLM-driven evaluator. Builds a prompt from `STRATEGY.md` + watchlist + open positions and asks the model (via `ai` SDK + provider packages) to emit one `TradeDecision` per asset. Decisions are typed as `LONG | SHORT | CLOSE | HOLD` with `sizeUsd`, `leverage`, optional `tp`/`sl` expressed as **percent PnL on margin** (not price).
- `trading/exchange/` + `shared/hyperliquid/service.ts` — exchange adapter that turns decisions into orders via `@nktkas/hyperliquid` (uses `viem` for signing). `TradeExecutor` is the boundary the runtime calls; it has a known NaN guard gap in `executeMarketClose` (see memory note).
- `trading/risk.ts`, `trading/analyzer.ts` — sizing, leverage, and TP/SL conversion to price levels.
- `tools/` — tools exposed to the LLM during evaluation: `market` (price/OHLC), indicator math via `indicatorts`, `pinescript` (Pine via `pinets`), `mindshare`, `agent-files`, `read-skill`, `execute-skill`. Skills are Markdown files at `skills/<id>/SKILL.md` inside an agent dir; `executeSkill` runs the skill body as additional instructions.
- `backtest/` — replay engine (`exchange.ts`, `candle-store.ts`) that drives the same evaluator/runtime against historical Hyperliquid candles for the `backtest` command. Has its own paper-trading exchange + comprehensive tests.
- `chat/`, `cache/`, `memory/`, `config/`, `ta/` — supporting subsystems (agentic chat UI, tool/result caching, agent `MEMORY.md` topic-partitioned writer, config loader, technical-analysis helpers).

The TUI (`src/components/*.tsx`) is rendered with Ink; `start` mounts the dashboard and feeds it events from `agent/runtime.ts`.

## SDK ↔ objects coupling

When DTOs change in `packages/objects`, you must regenerate the SDK's bundled `objects.ts` (the SDK does **not** import `@zhive/objects` at runtime to keep the published bundle dep-free):

```sh
pnpm --filter @zhive/sdk run prebuild   # or just `pnpm --filter @zhive/sdk build`
```

The `prebuild` script copies a curated allowlist of DTO files (see top of `apps/sdk/scripts/generate-objects.js`) into `apps/sdk/src/objects.ts` with a "do not edit by hand" header. Don't hand-edit that file.

## Conventions

- ESM throughout (`"type": "module"` in CLI). Imports inside the CLI use relative paths without extensions; tsup handles bundling.
- Tests are colocated as `*.test.ts` next to the code (e.g. `service.test.ts`, `exchange.test.ts`, SDK `memory.test.ts`).
- The CLI is published as a single bundled binary, so the `external` list in `apps/cli/tsup.config.ts` is auto-derived from `package.json` deps — adding a new runtime dep just requires a `package.json` update, no tsup change.
- Prettier config at repo root governs all `.ts/.tsx/.md`. There is no shared ESLint config; the SDK and `objects` package each carry their own.
