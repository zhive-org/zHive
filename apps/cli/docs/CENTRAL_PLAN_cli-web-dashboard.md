# CLI Web Dashboard for Real-World Trading

**Status:** M3 shipped (bidirectional command/chat/state API). Up next: M4 (vanilla JS dashboard UI).
**Complements:** none
**Last updated:** 2026-04-29

---

## Goal

Add an opt-in localhost web dashboard to `cli start` that mirrors the Ink TUI's activity feed and accepts the same slash commands bidirectionally. Lets the user observe and steer the `TradingAgent` from a browser (richer layout, tabs, multiple positions in view) while keeping the terminal UX unchanged for users who don't pass `--web`.

Scope: `cli start` only. Not `cli run`, not `cli start-all`.

---

## Progress Tracker

| # | Milestone | Route / Area | Status | Notes |
|---|-----------|--------------|--------|-------|
| 1 | HTTP server skeleton + `--web` flag | `apps/cli/src/commands/start/web/server.ts` | ✅ Done | Hono + @hono/node-server on 127.0.0.1; lifecycle gated on runtime |
| 2 | Event mirror via polling | `apps/cli/src/commands/start/web/events.ts` | ✅ Done | Ring buffer (cap 200, monotonic seq); `GET /api/events?since=<seq>` |
| 3 | Bidirectional command API | `apps/cli/src/commands/start/web/server.ts` + `control.ts` | ✅ Done | `POST /api/command`, `POST /api/chat`, `GET /api/state` via `WebControl` |
| 4 | Vanilla JS dashboard UI | `apps/cli/src/commands/start/web/dashboard/` | ⬜ Queued | Single HTML + JS, browser-side WS to Hyperliquid for live PnL + comparison graph |

Status legend: ✅ Done · 🟡 In progress · ⬜ Queued · ❌ Blocked

---

## What Was Built

### Milestone 3 — Bidirectional command API — shipped 2026-04-29

- `apps/cli/src/commands/start/web/control.ts` — `WebControl` interface (`executeCommand`, `submitChat`, `getState`) + `WebState` shape (`{agentName, watchlist, positions, memory}`). Owned by `App`, threaded into the server.
- `apps/cli/src/commands/start/web/server.ts` — refactored: `buildApp({eventBus?, control?})` builds the Hono instance and is exported separately from `startWebServer({port, ...})`. Routes register conditionally — `eventBus` enables `/api/events`; `control` enables `/api/command`, `/api/chat`, `/api/state`. POST routes return `{ok:true}` synchronously and let output flow back through the event bus per the M2 lock.
- `apps/cli/src/commands/start/web/server.test.ts` — 9 unit tests via `app.fetch(new Request(...))`: healthz works without options, `/api` routes 404 when neither bus nor control supplied, command/chat dispatch + validation (400 on missing `name`/empty `text`), state snapshot pass-through, 503 when `getState` rejects.
- `apps/cli/src/commands/start/web/events.ts` — `WebEventPayload` extended with `chat` (`role: 'user'|'agent'|'error'|'tool'`) and `system` (`kind: 'clear-chat'`) variants.
- `apps/cli/src/commands/start/hooks/useChat.ts` — accepts optional `eventBus`. `addChatActivity` now mirrors to the bus via a `chatActivityToPayload` mapper. New stable `clearChat` callback (replaces the inline clear in `onClear`); also returned from the hook so `App` can cross-clear Ink from web's `/clear`.
- `apps/cli/src/commands/start/hooks/useWebServer.ts` — accepts and forwards `control`.
- `apps/cli/src/commands/start/ui/app.tsx` — `useChat` now feeds the bus; `App` constructs `control` via `useMemo([runtime, eventBus, handleChatSubmit, clearChat])` with web-flavoured slash callbacks: `onMessage`/`onError`/`onClear` push to bus, and `onClear` ALSO calls `clearChat()` to wipe Ink chat (cross-surface). `getState` calls `ZhiveExchange.fetchPositions()` + `loadMemory()` live.
- **Verification done:** 139/139 tests pass (incl. 16 in `web/`). `useChat` slash branch still works in Ink (`onClear: clearChat`). Pre-existing typecheck error in `src/shared/trading/exchange/zhive.ts:257` is on `HEAD`, unrelated.
- **Locked decisions confirmed during build:**
  - Split `buildApp` from `startWebServer` — *why:* unit-tests run against `app.fetch(Request)` with no port binding, no async lifecycle, much faster and more deterministic than the tsx smoke pattern. Future routes can be tested the same way.
  - Routes register conditionally on their dependency (bus / control) — *why:* keeps `/api/events` available even if control isn't ready, and lets future tests build minimal apps. Also gives a clean 404 (instead of 500) when something isn't wired.
  - POST `/api/command` and `/api/chat` are fire-and-forget (`void control.x(...)`) — *why:* slash command callbacks and chat streaming are async and fan-out arbitrary events; awaiting them would tie up the HTTP connection while the LLM tool-loops. Output flow is the bus, not the response body. Matches M2's polling design.
  - `/api/chat` rejects leading `/` text — *why:* `useChat.handleChatSubmit` has its own slash-dispatch branch tied to Ink callbacks; routing slash from web through it would update Ink state instead of the web bus. Sending slashes to `/api/command` keeps surfaces clean.
  - **Resolved open question — `/clear` clears both surfaces.** Web `/clear` calls `clearChat()` (Ink chat reset) AND emits `{type:'system', kind:'clear-chat'}` to the bus. *Why:* matches the plan's lean ("treat slash commands as global"), avoids split-brain, and the plumbing is one extra `clearChat` ref in `useChat`'s return.
  - Chat activity granularity in the bus is one event per completed message (mirrors `addChatActivity`), not per-delta — *why:* simpler client; per-delta streaming would need SSE. Revisit in M4 if the dashboard feels laggy.
  - `getState()` fetches positions live from Hyperliquid every call (no cache) — *why:* called once on dashboard load; not hot. Add TTL only if M4 polls it.

### Milestone 2 — Event mirror via polling — shipped 2026-04-29

- `apps/cli/src/commands/start/web/events.ts` — `WebEventBus` class. Capacity defaults to 200, monotonic `seq` starting at 1, drops oldest when full. `push(payload, timestamp?)` returns the assigned `WebEvent`. `since(seq)` returns `{ events, latest }` where `events` are those with `seq > input` and `latest` is the highest assigned seq (0 when empty).
- `apps/cli/src/commands/start/web/events.test.ts` — 7 unit tests covering monotonic seq, since semantics, empty bus, capacity drop, ISO timestamps, and discriminant preservation.
- `apps/cli/src/commands/start/web/server.ts` — `StartWebServerOptions` now takes optional `eventBus`. When supplied, server registers `GET /api/events?since=<seq>` returning the bus's `since(...)` result. Invalid/missing `since` falls back to 0.
- `apps/cli/src/commands/start/hooks/useWebServer.ts` — accepts `eventBus`, forwards it to `startWebServer`. Bus is a hook dep so a swap re-binds the route.
- `apps/cli/src/commands/start/hooks/useAgent.ts` — accepts optional `eventBus`. Every `addLog(...)` call inside the agent callbacks (sleep / eval-started / error / eval-completed / online / fatal / empty-watchlist) is mirrored to `eventBus.push(...)` with the same `Date` so timestamps match across surfaces.
- `apps/cli/src/commands/start/ui/app.tsx` — creates the bus once with `useMemo(() => new WebEventBus(), [])` and threads the same instance into both `useWebServer` and `useAgent`.
- **Verification done:** `pnpm --filter @zhive/cli test` → 130/130 (incl. 7 new). End-to-end smoke via `tsx`: `since=0` returns full buffer, `since=N` skips already-seen events, `since>latest` returns `{ events: [], latest }`, `/healthz` still serves. Pre-existing typecheck error in `src/shared/trading/exchange/zhive.ts:257` (`AccountSummary.withdrawable`) is on `HEAD`, unrelated.
- **Locked decisions confirmed during build:**
  - Bus is created unconditionally in `App` (not gated on `--web`) — *why:* trivial memory cost; lets `useAgent` push without null checks at every callsite, and the bus is only externally observable when the server is up.
  - Event payload is flat (`{ seq, timestamp, type, …fields }`) rather than nested (`{ seq, timestamp, payload }`) — *why:* simpler client-side discriminant matching; matches how the dashboard JS will switch on `type`.
  - Reused the existing `TradingAgentCallbacks` interface as planned — *why:* single source of truth for event shape; new event types added to the agent will surface in both Ink and the web feed without a second wire-up. **Caveat:** `usePollActivity` also tracks `megathread`-typed activity that doesn't flow through `useAgent`'s callbacks; M2 does not mirror those. Revisit in M3 if the dashboard needs them.
  - Timestamps stored as ISO strings on the bus (Date converted at `push`) — *why:* JSON-serializable straight to `c.json(...)` without a transform; clients can `new Date(iso)` when needed.

### Milestone 1 — HTTP server skeleton + `--web` flag — shipped 2026-04-28

- `apps/cli/src/commands/start/web/server.ts` — `startWebServer({ port })` returns `{ port, url, stop() }`. Built on `hono` + `@hono/node-server`, binds to `127.0.0.1` only. Routes today: `GET /healthz` (JSON `{ok: true}`) and `GET /` (placeholder text). Bind errors (EADDRINUSE etc.) reject the start promise so callers can surface them.
- `apps/cli/src/commands/start/hooks/useWebServer.ts` — React hook that owns the server's lifecycle. Boots only when `port !== undefined` and `runtime` is ready (gating on runtime keeps the lifecycle simple now and gives M2/M3 something to attach to). Returns a discriminated-union status (`disabled | starting | listening | error`); cleanup stops the server on unmount.
- `apps/cli/src/commands/start/commands/index.ts` — added `--web` and `--web-port <port>` flags. Port parsed/validated (1–65535) and passed to `App` as `webPort`. Without `--web`, `webPort` stays undefined and the hook short-circuits — no port opened.
- `apps/cli/src/commands/start/ui/app.tsx` — `App` is now `React.FC<AppProps>` and shows two new header lines when applicable: the dashboard URL when listening, or an inline error message when bind fails.
- Dependencies added to `@zhive/cli`: `hono ^4.12.15`, `@hono/node-server` (latest).
- **Verification done:** typecheck/test/build all pass. Smoke test via `tsx`: `startWebServer` binds, serves `/healthz` and `/`, `stop()` releases the port (`lsof -nP -iTCP:7878` empty after stop, immediate rebind succeeds). `cli start --help` lists both new flags.
- **Locked decisions confirmed during build:**
  - Used `@hono/node-server` rather than Hono's built-in fetch handler — Hono on Node needs an adapter to bind a real port, and this is the official one.
  - Lifecycle gated on `runtime` (not `connected`) — `connected` flips inside `useAgent` after the agent run resolves, but for M1 we just want the server up early enough that the Ink header can render the URL. M2 will read events into a ring buffer regardless of whether the agent has produced any yet.
  - Port validation lives in the command layer (commander), not the server — invalid ports throw before Ink renders, which surfaces a clean error to the terminal.

---

## Queued — Design Notes

### Milestone 4 — Vanilla JS dashboard UI — next priority

- **Why this matters:** Without it, all the API plumbing is invisible. This milestone also adds the live market-data layer (PnL, comparison graph) that the landing page already showcases.
- **Already built (reusable):**
  - The Ink layout in `apps/cli/src/commands/start/ui/app.tsx` — informational reference for what panels the web dashboard should mirror (header, activity feed, positions overlay, watchlist overlay)
  - The landing page's existing Hyperliquid WS integration and comparison graph — copy the subscription shape and graph approach from there rather than re-deriving (path TBD; see Open Follow-ups)
- **Needs building:**
  - `apps/cli/src/commands/start/web/dashboard/index.html` — single-file HTML, inline CSS, inline JS
  - `apps/cli/src/commands/start/web/dashboard/app.js` — separate file if HTML gets unwieldy; otherwise inline
  - Server static-route to serve the dashboard at `GET /`
  - Browser-side WS client connecting directly to `wss://api.hyperliquid.xyz/ws`, subscribing to mark prices for assets the agent currently has open positions in (driven off the positions snapshot from `/api/state`)
  - Realtime PnL computation in the browser — `(markPx − entryPx) × size` per position, aggregated; recomputes on every WS tick
  - Comparison graph rendered with a tiny lib (Chart.js or uPlot, both single-file CDN) — equity curve over time
- **Locked decisions:**
  - Vanilla JS, no React/Tailwind, no build step — *why:* (user confirmation) keeps the CLI npm package slim and avoids a frontend build pipeline; the dashboard is utility, not a product surface
  - Single-file HTML where reasonable — *why:* simpler to ship; any "framework" we'd reach for here would be over-engineered for the use case
  - Browser opens WS directly to Hyperliquid; the local server does NOT proxy market data — *why:* Hyperliquid's public WS allows any origin, has no auth, and would only add load + complexity to our server. Clean split: server owns private agent state, browser owns public market data.
  - Realtime PnL is computed in the browser, not the server — *why:* prices arrive over the WS the browser already holds; sending them through our server first would add a hop for no gain.
- **Open questions:**
  - Layout: tabs (activity / positions / watchlist / chart) vs. side-by-side panels? — **leaning:** side-by-side on desktop (CSS grid); chart spans the top row, activity + positions split below. Matches how a trader watches things.
  - Comparison graph axes: agent equity vs. what? (HODL of same notional? Market index? Other agents?) — **leaning:** mirror whatever the landing page already does — will check that source as part of M4 prep.
  - Graph library: Chart.js (richer, ~70kb) vs. uPlot (lean, ~40kb, faster on tick updates) — **leaning:** uPlot, since equity curves update on every WS tick and uPlot is built for that pattern.

---

## Known Limitations

- **`cli start` only.** `cli run` (headless) and `cli start-all` (multi-agent supervisor) are out of scope. If web access is ever wanted for `start-all`, port allocation and routing become non-trivial — defer until needed.
- **No remote access.** Localhost-only by design. Anyone wanting "view my agent from my phone" would need a separate tunnel (ngrok, Cloudflare) and would also bypass the security model — that's their decision, not ours.
- **No persistence of web UI state.** Layout choices (which tab open, scroll position) are session-local. Adding localStorage is fine if the user asks; not in initial scope.
- **`/api/chat` does not stream.** Full LLM response lands in the bus only at `text-end`; tool calls come through as `chat:tool` events one shot each. If M4's UX feels laggy, swap to per-delta SSE.
- **`getState()` has no cache.** Every call hits Hyperliquid for positions. Acceptable for one-shot initial load; if M4 polls it, add a short TTL.

---

## Open Follow-ups

- Once Milestone 1 lands, decide whether the server's port should appear in the Ink header (e.g. *"Web dashboard: http://127.0.0.1:7878"*) so the user sees where to click.
- After Milestone 2, evaluate whether the ring buffer size (200) is right — too small and a tab left open for hours misses events; too large and we hold memory unnecessarily.
- After Milestone 4, consider auto-opening the browser on `--web` start (`open` package). Quality-of-life only.
- **M4 prep — landing page Hyperliquid WS + chart code located** (research done 2026-04-28, ahead of M4):
  - **Hyperliquid WS client:** `zhive-app/apps/frontend/src/lib/hyperliquid-ws.ts`. URL `wss://api.hyperliquid.xyz/ws`. Subscription shape `{ method: "subscribe", subscription: { type: "allMids" } }`. Server pushes `{ channel: "allMids", data: { mids: { "<assetId>": "<priceString>" } } }` ~1×/s for ~539 tokens. Per-asset alternative: `activeAssetCtx` for mark price + funding + OI + volume. Singleton client, ref-counted listeners, exponential reconnect (1s → 30s cap), four states `connecting | live | stalled | reconnecting`. Stall thresholds: 3s for `allMids`, 15s for `activeAssetCtx`. **For our dashboard:** subscribe to `allMids` and just read out the asset IDs we have positions in — simpler than the per-asset feed and one connection covers everything.
  - **Comparison chart on the landing page is a *race chart*, not equity vs. HODL:**
    - Top-level: `zhive-app/apps/frontend/src/features/trading/components/AcademyLandingHero.tsx` (around line 145).
    - Component: `AgentPnlCompareChart.tsx` (same dir).
    - Data hook: `zhive-app/apps/frontend/src/features/trading/hooks/useAgentPnlSeries.ts`.
    - Chart primitive: `zhive-app/apps/frontend/src/shared/components/MultiSeriesChart.tsx` (D3-based).
    - Library: **Liveline** (real-time chart lib).
    - Y axis: ROE % (`(unrealizedPnlUsd / costBasisUsd) × 100`), each agent anchored to 0 at the window start so the chart shows ROE *delta* over the window.
    - X axis: time, rolling 30s window (configurable), max 720 points/agent buffer.
    - Per-agent computation: signed PnL = `signedSize × (markPx - entryPx)`; cost basis = `Σ |size| × entryPx`; pulled live off Hyperliquid `allMids`.
    - Series: top 10 agents by current ROE, one line each.
  - **Implication for our M4:**
    - Locked answer for "Comparison graph axes": **mirror the landing page exactly** — single agent's ROE % delta from window start, X = time. (Comparing to HODL would diverge from the existing visual language users already know; defer that until someone explicitly asks.)
    - Locked answer for "Graph library": **uPlot** (still right — Liveline is overkill and adds an unfamiliar dep; uPlot handles the same rolling-window / per-tick-update pattern and ships ~40kb).
    - Subscription shape to copy: `allMids` once on dashboard load, derive ROE from the positions snapshot (`/api/state` from M3) plus live mids.

---

## Verification Checklist

```bash
pnpm --filter @zhive/cli check-types
pnpm --filter @zhive/cli test
pnpm --filter @zhive/cli build
```

- [ ] `cli start` (no flag) — Ink TUI behaves identically to before; no port opened (`lsof -i :7878` empty).
- [ ] `cli start --web` — Ink TUI runs AND `http://127.0.0.1:7878/` returns the dashboard HTML.
- [ ] Trigger an eval; confirm the same activity appears in both Ink feed and the web feed.
- [ ] Run `/positions` from the web — output renders in the dashboard; no error in Ink.
- [ ] Run `/positions` from Ink — output renders in Ink as before; web feed mirrors it.
- [ ] Kill the Ink app (Ctrl+C) — port 7878 is released (`lsof -i :7878` empty).
- [ ] `cli start --web --web-port 9000` — server binds to 9000, not 7878.
