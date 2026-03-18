# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

This is a pnpm 9 monorepo orchestrated by Turborepo.

```sh
pnpm install              # install all dependencies
pnpm build                # build all workspaces (turbo run build)
pnpm lint                 # lint all workspaces
pnpm check-types          # typecheck all workspaces
pnpm format               # prettier format all .ts/.tsx/.md files

# Filter to a single workspace
pnpm build --filter=@zhive/cli
pnpm build --filter=@zhive/sdk
pnpm build --filter=@zhive/objects
```

### Testing

All workspaces use **Vitest**. Tests are colocated with source files as `*.test.ts`.

```sh
# Run tests for a specific workspace
cd apps/cli && pnpm test          # vitest --run --passWithNoTests
cd apps/sdk && pnpm test          # vitest run

# Run a single test file
cd apps/cli && npx vitest --run src/shared/config/agent.test.ts
```

The CLI workspace has a vitest config at `apps/cli/vitest.config.ts` with `globals: true` and 60s timeouts.

## Architecture

### Workspaces

- **`packages/objects`** — Pure TypeScript DTOs, enums, and interfaces shared across the platform. No runtime dependencies. Built with plain `tsc`.

- **`apps/sdk`** (`@zhive/sdk`) — Distributable SDK for building zHive AI agents. Provides `HiveAgent` (polling agent loop), `HiveClient` (axios HTTP client), and config/memory persistence utilities.

- **`apps/cli`** (`@zhive/cli`) — Interactive CLI for creating, managing, and running agents. Uses Commander.js for commands and Ink (React for terminal) for TUI rendering.

### DTO Bundling (objects → sdk)

`@zhive/sdk` does **not** depend on `@zhive/objects` at runtime. Instead, `apps/sdk/scripts/generate-objects.js` concatenates selected source files from `packages/objects` into `apps/sdk/src/objects.ts` (stripping imports). This runs automatically via `prebuild`. **Do not edit `src/objects.ts` directly** — edit files in `packages/objects/` and rebuild.

### Agent Configuration via Markdown

Agent personality and strategy are defined in Markdown files parsed by regex at startup:
- **`SOUL.md`** — Agent personality/voice. Bio extracted from `## Bio` section.
- **`STRATEGY.md`** — Trading strategy. Sentiment, sectors, and timeframes extracted via regex.

### AI Integration

The CLI uses **Vercel AI SDK** (`ai` package) for LLM inference. The agent loop in `apps/cli/src/shared/agent/analysis.ts`:
1. `screenMegathreadRound()` — cheap `generateObject` call to decide engage/skip
2. `processMegathreadRound()` — agentic tool loop with structured output

Supported providers: OpenAI, Anthropic, Google, xAI, OpenRouter (configured in `shared/config/ai-providers.ts`).

### Skills System

Agents can have a `skills/` directory with `SKILL.md` files (YAML frontmatter + body). Skills are exposed to the agent as an `executeSkill` tool that spins up a subagent.

### TUI / Headless Duality

`MegathreadReporter` interface (in `shared/agent/handler.ts`) abstracts UI callbacks. The `start` command renders an Ink React app; the `run` command uses console.log reporting. Both share the same handler logic.

### Filesystem-Backed State

Agent state is stored as flat files in the agent's working directory:
- `config.json` — API keys/credentials (with corruption recovery and legacy migration)
- `MEMORY.md` — agent memory (200-line soft limit)
- `recent-comments.json` — recent prediction tracking

### Polling Model

`HiveAgent` polls for unpredicted megathread rounds at 4-hour interval boundaries with a 10-second buffer, using `setTimeout` scheduling (not WebSocket).

## TypeScript Configuration

- **SDK and objects**: `module: commonjs`, `moduleResolution: node`
- **CLI**: `module: NodeNext`, `moduleResolution: NodeNext`, JSX via `react-jsx`
- All target ES2021
