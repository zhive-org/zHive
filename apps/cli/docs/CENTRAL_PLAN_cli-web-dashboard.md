# CLI Web Dashboard for Real-World Trading

**Status:** M4 shipped + post-review hardening pass (auth, host check, body cap, gap signaling, exchange caching, dedupe). All four milestones done.
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
| 4 | React + Vite dashboard UI | `apps/cli/dashboard/` | ✅ Done | scaffold + panels + Hyperliquid WS + uPlot ROE chart |

Status legend: ✅ Done · 🟡 In progress · ⬜ Queued · ❌ Blocked

---

## What Was Built

### Post-review hardening — shipped 2026-04-29

Driven by code-reviewer findings (1 CRITICAL, 5 HIGH, 7 MEDIUM, 6 LOW, 5 test gaps). All addressed.

- **Auth (CRITICAL).** `apps/cli/src/commands/start/hooks/useWebServer.ts` generates a random 24-byte URL-safe token via `randomBytes` once per Ink-process lifetime and passes it to `startWebServer`. The Ink header URL becomes `http://127.0.0.1:<port>/?token=<token>`. Server-side, `apps/cli/src/commands/start/web/server.ts`:
  - Middleware on `/api/*` checks the request hostname (Host header → URL hostname fallback for unit tests) — rejects non-localhost with 403 (DNS-rebinding defense).
  - Same middleware checks for cookie `zhive_auth=<token>` or `Authorization: Bearer <token>` — rejects with 401 otherwise.
  - Static handler at `GET /` accepts a one-shot `?token=<token>` query, sets an HttpOnly SameSite=Lax cookie, and 302-redirects to a clean `/`. Without a valid cookie/token, returns a 401 page pointing the user at the CLI URL.
  - `/healthz` and static `/assets/*` remain public (no secrets).
- **Fire-and-forget rejections (HIGH#2).** `executeCommand` and `submitChat` wrappers in `server.ts` now `.catch()` the promise and push a `{type:'error', errorMessage}` event to the bus so the dashboard sees the failure.
- **Slash command name validation (HIGH#3).** `server.ts` builds a `Set` from `SLASH_COMMANDS` at startup and rejects unknown names with 400 before the dispatch reaches the registry.
- **Chat body cap (HIGH#4).** 8 KB hard limit on `text`; oversized requests get 413 without invoking the LLM.
- **Capacity-drop gap signaling (HIGH#5).** `apps/cli/src/commands/start/web/events.ts` `WebEventBus.since()` now also returns `oldestSeq`. Dashboard's `useEventStream` (`apps/cli/dashboard/src/lib/useEventStream.ts`) compares `oldestSeq` against the previously-seen `latest`; on a gap (events evicted before the client polled) it dispatches `reset` instead of `append`, replacing the buffer with the freshly returned events. Prevents a dropped `system:clear-chat` from leaving cleared chats visible forever.
- **Exchange client + positions cache (HIGH#6).** `apps/cli/src/commands/start/ui/app.tsx` keeps the `ZhiveExchange` instance in a `useRef` keyed on `apiKey` (only re-created if the key changes) and caches `fetchPositions()` results for 5 s. With dashboard polling `/api/state` every 30 s, this still hits Hyperliquid at a normal rate; with multiple tabs or future faster polling, the TTL prevents thrashing.
- **Symlink-aware path traversal guard (MEDIUM).** `server.ts` now `realpath`s both the requested target AND the dashboard root, then prefix-checks. macOS-aware (where tmpdir resolves through `/private/var/folders`).
- **Dashboard JSON error wrapping (MEDIUM).** `apps/cli/dashboard/src/lib/api.ts` wraps `res.json()` in `readJson(res, label)` so a non-JSON success body produces a labeled error instead of an opaque `SyntaxError`. All fetches now also pass `credentials: 'same-origin'` so the auth cookie travels.
- **Hyperliquid `stop()` + half-open recovery (MEDIUM).** `apps/cli/dashboard/src/lib/hyperliquid.ts` keeps the stall timer in `_stallTimer`, exposes `stop()` for clean shutdown, and forces a reconnect when `stalled` exceeds 15 s — a half-open TCP that never fires `close` no longer leaves the dashboard staring at stale mids.
- **Dashboard event dedupe + reducer extraction (LOW + test gap).** `useEventStream.ts` now has stable `lastDataRef` identity check (StrictMode double-effect safety) AND `dedupeBySeq` defense in the reducer. `applyClearChat`, `dedupeBySeq`, and `eventsReducer` exported as pure functions.
- **Cache-Control headers (LOW).** `index.html` → `Cache-Control: no-cache`. `/assets/*` → `Cache-Control: public, max-age=31536000, immutable` (Vite hashes the filenames).
- **Buffer pass-through (LOW).** `c.body(content, ...)` instead of `c.body(new Uint8Array(content), ...)` — avoids one buffer copy per request.
- **Memoized panel filters (LOW).** `ActivityFeed` and `ChatPanel` wrap their filter expressions in `useMemo` keyed on `events`, avoiding O(n) re-filter on every keystroke in the unrelated CommandBar.

**New test coverage (+34 tests, 145 → 179 total):**

- `events.test.ts`: capacity-drop reports `oldestSeq` (gap-detectable from client side); empty bus reports `oldestSeq=0`.
- `server.test.ts`: 14 new — auth (no token / valid bearer / wrong bearer), Host header (localhost ok / non-localhost 403), `/healthz` public, 401 page when cookie missing, `?token=` redirect with `Set-Cookie`, command name validation (known/unknown), chat body cap → 413, `executeCommand` rejection routed to bus, encoded `..` path traversal blocked, Cache-Control headers (no-cache vs immutable).
- NEW `dashboard/src/lib/useEventStream.test.ts` (11 tests): `applyClearChat` (no clear / one clear / non-chat preserved / multiple clears use latest), `dedupeBySeq`, `eventsReducer` (append/reset/empty no-op/dedupe/cap at 500/clear-chat applied during append).
- NEW `dashboard/src/lib/usePnl.test.ts` (7 tests): empty positions, long+gain, short+gain, mid-missing falls back to markPrice / entryPrice, mixed-side aggregation, zero-cost guard.

**Locked decisions confirmed during the hardening pass:**

- **Token in URL on first load + cookie thereafter** — *why:* localhost-only environment, browser's URL-bar leakage risk is minimal, and the cookie is HttpOnly so JS can't exfiltrate it. Alternative (POST /auth + bootstrap page) added complexity with no real win for this threat model.
- **`isLocalHost(c)` falls back to `new URL(c.req.url).hostname` when no Host header is present** — *why:* Hono's `app.fetch(new Request(...))` synthetic test path doesn't auto-populate Host. Falling back to URL hostname keeps the unit tests honest and the production path tight (real browsers always send Host).
- **`executeCommand`/`submitChat` errors flow to the event bus, not back through HTTP** — *why:* same lock as M3 (output flows through the polling channel, not the response). Just extends to errors, which the user previously couldn't see.
- **Cookie is session-scoped (no `Max-Age`)** — *why:* the token regenerates on every CLI restart, so persisting across browser restarts has no value (cookie would be invalid against the new token anyway). Session-only avoids a stale cookie outliving its purpose.

### Milestone 4 — step 3: Hyperliquid WS + live PnL + uPlot ROE chart — shipped 2026-04-29

- `apps/cli/dashboard/src/lib/hyperliquid.ts` — singleton `HyperliquidClient`. Connects to `wss://api.hyperliquid.xyz/ws`, subscribes to `allMids`, parses `{ channel: 'allMids', data: { mids } }` messages and stores them in a `Map<coin, number>`. Status machine: `connecting → live → stalled → reconnecting`. 3s stall threshold; exponential reconnect 1s → 30s cap. Module-level `singleton` so multiple `useMids` callers share one socket.
- `apps/cli/dashboard/src/lib/useMids.ts` — React hook subscribing to the singleton; emits a fresh `Map` reference + monotonically incrementing `tick` on every WS push so memo invalidation is cheap.
- `apps/cli/dashboard/src/lib/usePnl.ts` — `computePnl(positions, mids)` does the per-position derivation: `signedSize = side === 'long' ? size : -size`, `pnl = signedSize * (live - entryPrice)`, `cost = |size| * entryPrice`. Aggregates: `roe = (Σ pnl / Σ cost) * 100`. Falls back to server-provided `markPrice`/`entryPrice` when a coin's mid hasn't arrived. Returns enriched positions with `livePnlUsd` + `liveRoePercent`.
- `apps/cli/dashboard/src/lib/useRoeSeries.ts` — rolling 30s buffer of `(ts, roe)` samples; on each ROE update, trims older than `now - 30s`, caps at 720 points (matches landing page). Outputs two `Float64Array`s: `t` (relative seconds from window start) and `roeDelta` (ROE − window-start ROE). uPlot consumes those directly.
- `apps/cli/dashboard/src/components/RoeChart.tsx` — uPlot wrapper. Initializes the plot once with amber stroke + transparent fill; updates via `setData` on each series push. `ResizeObserver` keeps width in sync with the container. Tick formatters: x = `${s}s`, y = `${+}${pct}%`.
- `apps/cli/dashboard/src/components/Header.tsx` — extended with live PnL + ROE inline (color-coded by sign) and a separate WS status line (`mids: live | stalled | reconnecting | connecting`) alongside the existing CLI-stream status.
- `apps/cli/dashboard/src/components/PositionsTable.tsx` — accepts `ValuedPosition` (DetailedPosition + optional live values); renders `livePnlUsd`/`liveRoePercent` if present, falls back to server values otherwise. Mark price displayed in the row matches the live mid.
- `apps/cli/dashboard/src/App.tsx` — composes everything. New top-row chart section above the activity feed (left column). Chart, activity, chat stack vertically; positions/watchlist remain on the right.
- **Verification done:** `tsc --noEmit -p dashboard/tsconfig.json` clean. Bundle: 244 KB / **84 KB gzipped** (+25 KB gz from step 2 — uPlot ~17 KB gz, the rest is the new modules). 145/145 CLI tests still pass.
- **Locked decisions confirmed during build:**
  - **Single `Map<coin, number>` for mids, replaced wholesale on every WS push** — *why:* `usePnl` re-runs on a `tick` counter rather than diffing the Map. Cheap, correct, no stale-closure foot-guns.
  - **`useRoeSeries` writes `Float64Array`s** rather than plain arrays — *why:* uPlot expects typed arrays for its hot path, and we churn one per push.
  - **Chart re-init only on mount; `setData` on update.** *Why:* re-creating the uPlot instance on every render would tank perf and reset the cursor. Two `useEffect`s — one with empty deps for setup, one keyed on `series` for data — is the canonical uPlot+React shape.
  - **Live PnL falls back to `markPrice ?? entryPrice` if a mid is missing** — *why:* prevents the whole row from showing "—" while the WS is still subscribing. As soon as mids arrive (~1s), the live values take over.
  - **Stall detection is timer-based (1Hz check), not message-based.** *Why:* if the WS goes silent without closing, we still flip to `stalled` after 3s; the user sees the warning instead of stale data presented as live.

### Milestone 4 — step 2: Panels + control plane — shipped 2026-04-29

- `apps/cli/dashboard/src/lib/types.ts` — mirrors of the server-side `WebEventPayload`, `WebEvent`, `WebState`, `DetailedPosition`. Hand-mirrored (not imported) — Vite project sits outside the CLI's tsc graph and pulling the server types would drag Node-only code into the browser bundle.
- `apps/cli/dashboard/src/lib/api.ts` — typed `fetch` wrappers for `GET /api/state`, `GET /api/events?since=`, `POST /api/command`, `POST /api/chat`. All errors funnel through a single `asJsonError` helper that pulls the server's `error` field if present.
- `apps/cli/dashboard/src/lib/format.ts` — `formatTime(iso)`, `formatUsd(n, {signed?})`, `formatPercent(n)`. Used by ActivityFeed and PositionsTable.
- `apps/cli/dashboard/src/lib/useEventStream.ts` — central event stream. `useReducer` accumulates events up to 500-cap; `useQuery` polls `/api/events` every 1s with a `sinceRef` (avoids queryKey churn). `applyClearChat` filters chat events older than the latest `system:clear-chat` seq before storing — keeps the dashboard's chat panel in sync with web `/clear`.
- `apps/cli/dashboard/src/components/Header.tsx` — agent name + status indicator (connecting / live / stalled) driven off `stateQuery.isError` and `events.isError`.
- `apps/cli/dashboard/src/components/ActivityFeed.tsx` — filters out `chat`/`system` events, renders `message`/`error`/`online`/`decision` with action-color coding (LONG=emerald, SHORT=red, CLOSE=amber, HOLD=zinc). Auto-scrolls to bottom only when the user is near the bottom (preserves scroll-up reads).
- `apps/cli/dashboard/src/components/ChatPanel.tsx` — filters `chat` events. Roles render with role-specific styles (you / agent / error / tool).
- `apps/cli/dashboard/src/components/CommandBar.tsx` — single input that auto-routes by leading `/`: slash → `POST /api/command`, anything else → `POST /api/chat`. Inline autocomplete suggestions when typing `/`. Invalidates the `state` query on command success so positions/watchlist refresh after `/positions` or `/watchlist`.
- `apps/cli/dashboard/src/components/PositionsTable.tsx` — coin/side/leverage row with entry+mark prices and PnL/ROE in green/red.
- `apps/cli/dashboard/src/components/WatchlistPanel.tsx` — pill list of watched coins.
- `apps/cli/dashboard/src/App.tsx` — top-level layout: Header → 2-column grid (`lg:grid-cols-[1fr_320px]`, activity+chat left, positions+watchlist right) → CommandBar. `useQuery({ queryKey: ['state'], refetchInterval: 30_000 })` keeps state fresh; `useEventStream` drives the live feed.
- **Verification done:** dashboard typechecks (`tsc --noEmit -p dashboard/tsconfig.json`). Build is clean: 187 KB / 59 KB gz JS, 12 KB / 3.3 KB gz CSS — +3 KB gz over step 1 for all the panels and Tailwind classes. End-to-end smoke via `tsx`: server with mock control returns 200 on every endpoint, bundled HTML loads, `/api/state` returns the demo positions, `/api/events` returns seeded events. CLI tests still 145/145.
- **Locked decisions confirmed during build:**
  - **Layout: side-by-side 2-column on lg+, single column on small screens.** *Why:* mirrors how the existing Ink layout splits agent feed (main) from positions/watchlist (sidebar). Resolves the M4 "tabs vs side-by-side" open question.
  - **Single combined input for both chat and slash commands**, auto-routed by leading `/`. *Why:* matches the existing Ink CLI behavior (one prompt, slashes route to `executeSlashCommand`); avoids two boxes that share screen real estate. Inline autocomplete suggestions show only when typing a slash with no spaces — fewer false triggers.
  - **`useEventStream` uses a `useRef` for `since`, not a `useQuery` key.** *Why:* keying the query on `since` would invalidate on every tick (cache miss every poll, lost retry semantics). The ref keeps the queryKey stable; the function reads the latest `since` lazily.
  - **`applyClearChat` walks events backwards and filters chat events older than the most recent `system:clear-chat`.** *Why:* deterministic regardless of order, and the latest clear is what the user sees.
  - **Types are hand-mirrored** in `dashboard/src/lib/types.ts` rather than imported from the CLI's `web/events.ts` and `web/control.ts`. *Why:* Vite project's tsconfig has different lib targets (DOM, browser-only); pulling server types would force `paths` mappings or a separate package, neither worth it for ~40 lines of types. Drift risk is low and caught by the API tests if shapes diverge.
  - **State refetch every 30s + invalidation on command success.** *Why:* `/api/state` hits Hyperliquid (no cache server-side per M3 lock); 30s is rare enough not to hammer it but quick enough that positions don't go too stale. After a slash command (especially `/watchlist` or anything that may mutate state), invalidate to refetch immediately.
  - **Activity feed auto-scrolls only when within 200px of the bottom.** *Why:* preserves user's scroll position when reading older events; matches Ink's "settled vs active" intuition.
  - **Chat panel is fixed 16rem (h-64)** under the activity feed, both with internal scroll. *Why:* prevents one panel from starving the other; chat tends to grow taller, fixing it keeps activity visible.

### Milestone 4 — step 1: Vite scaffold + Hono static serving — shipped 2026-04-29

- `apps/cli/dashboard/` — Vite project. `index.html` (root with `#root` div), `src/main.tsx` (StrictMode + `QueryClientProvider`), `src/App.tsx` (minimal "hello" with `useQuery` hitting `/healthz`), `src/index.css` (`@import 'tailwindcss'`), `vite.config.ts` (React + Tailwind v4 plugins, output to `../dist/dashboard`, dev proxy for `/api/*` and `/healthz` to `127.0.0.1:7878`), `tsconfig.json` (browser DOM lib, `vite/client` types, `react-jsx`).
- `apps/cli/package.json` — devDeps added: `vite ^8`, `@vitejs/plugin-react ^6`, `react-dom ^18.3.1` (pinned to match Ink's React), `@types/react-dom ^18.3`, `tailwindcss ^4.2`, `@tailwindcss/vite ^4.2`, `@tanstack/react-query ^5.100`, `uplot ^1.6`. Scripts: `build` chains `build:cli && build:dashboard`; new `build:dashboard` and `dev:dashboard` (Vite cwd-based — Vite 8 dropped `--root`).
- `apps/cli/src/commands/start/web/server.ts` — removed the M1 placeholder `app.get('/')`. Added a static-file catch-all when `dashboardRoot !== null`. Default root resolves from `import.meta.url` so the CLI binary finds `dist/dashboard/` at its sibling regardless of cwd. Path-traversal guard ensures resolved targets stay inside the root. `/api/*` and `/healthz` are explicitly skipped by the catch-all. Friendly 503 with build hint when `index.html` is missing (helpful pre-build).
- `apps/cli/src/commands/start/web/server.test.ts` — 7 new dashboard tests (15 total in this file): index serving, mime types, 404 for missing files, 503 with hint when bundle isn't built, `/api/*` not intercepted, path traversal blocked. Existing tests pass `dashboardRoot: null` to keep their assertions unambiguous.
- **Verification done:** 145/145 tests pass. `pnpm --filter @zhive/cli build` chains tsup → vite cleanly (tsup's `clean: true` runs first, Vite's output survives). Bundle: `dist/dashboard/index.html` (0.4 KB), `index-XXX.css` (6.6 KB / 2.1 KB gz, Tailwind purged), `index-XXX.js` (175 KB / 56 KB gz — React + ReactDOM + TanStack Query + minimal app). Smoke via `tsx`: `GET /` serves built HTML, `GET /assets/index-XXX.js` returns the JS bundle, `/healthz` and `/missing.txt` behave correctly. Pre-existing typecheck error in `zhive.ts:257` unchanged.
- **Locked decisions confirmed during build:**
  - Build order **tsup → vite** (`build:cli && build:dashboard`) — *why:* tsup's `clean: true` wipes `dist/`, so Vite must run *after* tsup or its output dies. Cleanest fix; no need to flip tsup's clean flag.
  - Vite outputs to `../dist/dashboard` via absolute `path.resolve(__dirname, ...)` in `vite.config.ts` — *why:* keeps Vite's cwd inside `dashboard/` (idiomatic) while merging output into the CLI's `dist/`.
  - Hono catch-all `app.get('/*', ...)` with manual `fs.readFile` instead of `@hono/node-server`'s `serveStatic` — *why:* `serveStatic`'s `root` is cwd-relative; we need an absolute path resolved from `import.meta.url` so the static handler works whether the CLI is run from npx cache, the repo, or a global install. ~25 lines of code, full control over mime types and the path-traversal guard.
  - Default `dashboardRoot` is `<binary dir>/dashboard` (resolved from `import.meta.url`); pass `null` to disable — *why:* tests need `null` to make the empty-options case unambiguous (otherwise the catch-all would intercept everything and only return 404 via its own logic, which is fine but harder to reason about).
  - Pinned `react-dom` to `^18.3.1` to match Ink's `react@^18.3.1` — *why:* pnpm initially installed `react-dom@19` which mismatched. The dashboard bundle is independent of Ink's React, but matching versions avoids type-defs ambiguity in IDE tooling.

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

### Milestone 4 — React + Vite dashboard UI — next priority

- **Why this matters:** Without it, all the API plumbing is invisible. This milestone also adds the live market-data layer (PnL, comparison graph) that the landing page already showcases.

- **Phasing (3 commits):**
  1. **Scaffold + serve.** Vite project at `apps/cli/dashboard/`, build wired into `pnpm --filter @zhive/cli build`, Hono static-file route, minimal "hello dashboard" replacing the placeholder `/`. Verifies the pipeline end-to-end.
  2. **Panels + control plane.** Header, activity feed, chat, command bar, positions, watchlist. Wired to `/api/state` (initial) + `/api/events` (polling) + `POST /api/command` + `POST /api/chat`.
  3. **Live market data + chart.** Hyperliquid `allMids` WS client, real-time PnL, uPlot ROE chart matching the landing page (ROE % delta from window start, rolling 30s).

- **Already built (reusable):**
  - The Ink layout in `apps/cli/src/commands/start/ui/app.tsx` — informational reference for what panels the web dashboard should mirror (header, activity feed, positions overlay, watchlist overlay).
  - All M3 endpoints: `/api/state`, `/api/events?since=`, `POST /api/command`, `POST /api/chat`. Event payload union (`message | error | decision | online | chat | system`) is locked.
  - The landing page's existing Hyperliquid WS integration and comparison graph — copy the subscription shape and graph approach from there rather than re-deriving (paths in Open Follow-ups below).

- **Needs building:**
  - `apps/cli/dashboard/` Vite project: `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `tailwind.config.js`, `postcss.config.js`. Output to `apps/cli/dist/dashboard/`.
  - Build wiring: `apps/cli/package.json` `build` script runs tsup AND vite. Likely via `&&` or `npm-run-all`.
  - Hono static-file middleware in `web/server.ts` serving `dist/dashboard/` at `/` and `/assets/*`. Falls through to existing routes for `/api/*` and `/healthz`.
  - TanStack Query setup: `QueryClientProvider`, `useQuery` for `/api/state`, `useQuery` with `refetchInterval` for `/api/events?since=`, `useMutation` for `POST /api/command` and `POST /api/chat`.
  - Components: `<Header/>`, `<ActivityFeed/>`, `<ChatPanel/>`, `<CommandBar/>`, `<PositionsTable/>`, `<WatchlistPanel/>`, `<RoeChart/>` (uPlot wrapper).
  - Browser-side `hyperliquid-ws.ts` (port from landing-page singleton) — subscribes to `allMids`, exposes a tiny store/hook for live mids.
  - Real-time PnL/ROE derivation hook — `(markPx − entryPx) × signedSize` per position, aggregated; recomputes on every WS tick.

- **Locked decisions:**
  - **React 18 + Vite + TypeScript + Tailwind + TanStack Query + uPlot** — *why:* React opens the ecosystem we'd reach for as the dashboard grows; Vite is the standard React bundler with minimal config; Tailwind removes CSS bikeshedding; TanStack Query gives clean cache+retry semantics for the polling endpoints; uPlot is built for the rolling-window per-tick chart pattern (~40kb).
  - **Build step accepted; Vite added as a devDependency of `@zhive/cli`.** *Why:* user confirmed (npx-based distribution makes the bundle size delta ~tens to hundreds of ms one-time download per version — in the noise vs the existing multi-MB tarball). Walks back the M4 prep "no build step" lock; replacement: `pnpm --filter @zhive/cli build` orchestrates both tsup (CLI) and vite (dashboard).
  - **Dashboard source lives at `apps/cli/dashboard/`** (sibling of `src/`), output to `apps/cli/dist/dashboard/`. *Why:* keeps Vite's roots, configs, and tsconfig disjoint from tsup's. Browser code never touches Node-only `src/` paths.
  - **Browser opens WS directly to Hyperliquid; the local server does NOT proxy market data** — *why (kept from prior lock):* Hyperliquid's public WS allows any origin, has no auth, and would only add load + complexity to our server. Clean split: server owns private agent state, browser owns public market data.
  - **Realtime PnL is computed in the browser, not the server** — *why (kept):* prices arrive over the WS the browser already holds; sending them through our server first would add a hop for no gain.
  - **Chart axis: ROE % delta from window start, rolling 30s window** — *why (locked from M4 prep):* mirrors the landing page exactly — same visual language users already know.

- **Open questions:**
  - Layout: tabs vs side-by-side panels? — **leaning:** side-by-side desktop grid (chart top row, activity + positions split below). Decide during commit #2.
  - Dev iteration: Vite dev server with proxy to a separately-running `cli start --web`, or just rebuild + refresh? — **leaning:** start with rebuild + refresh (minimal config); add dev-server proxy if iteration feels slow.

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
