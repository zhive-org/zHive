import * as ai from 'ai';
import { wrapAISDK } from 'langsmith/experimental/vercel';
import { AgentRuntime } from '../agent/runtime';
import { createPineScriptTool, createPineScriptToolForAsset } from '../tools/pinescript';
import { IExchange } from './exchange/types';
import { AccountSummary, PairInfo } from './types';
import { cacheableSystem } from '../agent';
import { HyperliquidProvider } from '../tools/pinescript/providers/hyperliquid/provider';

const { ToolLoopAgent } = wrapAISDK(ai);

const ANALYZER_MAX_OUTPUT_TOKENS = 50000;

const pinescriptGuide = `# PineScript Usage Guide for PineTS Runtime

You will write PineScript v5 to compute and expose the indicators and conditions defined in STRATEGY.md. Follow these rules strictly.

This guide applies to the **PineTS** runtime (https://luxalgo.github.io/PineTS), not TradingView's native Pine editor. The semantics differ in important ways — follow this guide, not generic PineScript tutorials.

## What PineScript Is For

PineScript is your tool for computing indicator values and evaluating stateless conditions against real market data. Use it for:

- **Indicator math:** EMAs, RSI, ATR, MACD, Bollinger Bands, volume averages, pivots, etc.
- **Multi-timeframe data:** pulling higher-timeframe values (4h, daily, weekly) while analyzing on a lower one
- **Cross-asset references:** comparing to BTC, SPY, sector indices, correlated names
- **Pattern detection:** candle patterns, divergences, structural breaks, pullback zones
- **Stateless boolean conditions:** "is EMA20 > EMA50", "is price within 1×ATR of EMA20", "is RSI in range"

Do NOT use PineScript for:

- **Position state logic:** PineScript doesn't know your entry price, TP1 status, or time held. These live in your evaluation code.
- **Exit rules that depend on "after entry" semantics:** trailing stops, invalidation windows, time stops. Compute the underlying indicators in PineScript; evaluate against position state in Step 4.
- **Risk limit checks:** account drawdown, concurrent position counts, correlation rules. These are portfolio-level and evaluated without PineScript.
- **Guessing or estimating:** if you don't have a value from a script, you don't have it. Run the script.

## Calling the Script Multiple Times

You are not limited to one PineScript call. Call it as many times as the analysis requires. Good reasons to call more than once:

- **Probe before committing:** if uncertain whether the regime filter passes, run a small script checking only that before writing a full entry-conditions script.
- **Cross-asset context:** one call for the asset's own indicators, another call with a different "syminfo" to check BTC trend or a sector reference.
- **Progressive refinement:** first call tells you the signal is borderline, a second call examines additional context (volume profile, higher-timeframe confirmation) to break the tie.
- **Debugging a failure:** if the first script returns unexpected values, write a smaller isolated script to check the specific indicator that looks off.
- **Exit analysis:** one script for trailing indicators (4h EMA20), another for invalidation signals (consecutive closes beyond EMA50).

Do not over-call. Each call costs time. Bias toward **one comprehensive script** that returns everything you need, and only split into multiple calls when there is a concrete reason (cross-asset, cross-symbol, or debug).

### Pre-flight checklist (run mentally before every "executePineScript" call)

- [ ] "//@version=5" at the top.
- [ ] Every multiplication between a number and a variable uses "*" ("0.2 * atr", never "0.2atr").
- [ ] Every logical op is "and"/"or"/"not", not "&&"/"||"/"!".
- [ ] Every "plot()" has a unique string name as the 2nd arg.
- [ ] Every boolean plot is wrapped "cond ? 1 : 0".
- [ ] Every "request.security" call wraps its own "ta.*" expression and passes "lookahead=barmerge.lookahead_off".
- [ ] The "timeframe" argument is a numeric-minute string ("'60'", "'240'"), not "'1h'" or "'4h'".
- [ ] "fetchCandleCount" is ≥ 2× the slowest indicator's lookback on the chart TF.
- [ ] No unsupported functions ("ta.sum", "request.financial", "fixnan" is OK, "while", "for...in", "library", "import", "alert", "max_bars_back", "runtime.error", strategy.*, etc.).
- [ ] A "ready" flag guards the final long/short booleans.

---

## Script Type

Use "indicator()", not "strategy()". Set "overlay=true" if your plotted values are price-like (EMAs, bands), otherwise "false". Pin "//@version=5" — v6 is experimental in PineTS and should not be used.

\`\`\`pine
//@version=5
indicator('Strategy Signals', overlay=true)
\`\`\`

---

## How Values Are Read Out (CRITICAL)

PineTS scripts are consumed **programmatically** by the calling TypeScript code. The caller reads values two ways:

1. **"ctx.plots"** — populated by every "plot()" call. This is the primary channel. Each plot becomes "ctx.plots['<name>']" with a time-series array.
2. **"ctx.result"** — populated by "return { ... }" at the end of the script (only works in the JS/TS-function form, not raw Pine string form).

**For agent consumption, always use "plot()" with an explicit name.** The downstream consumer reads the last element of each named plot array:

\`\`\`pine
plot(ema20_4h, 'ema20_4h')
plot(longCond ? 1 : 0, 'longCond')
\`\`\`

Booleans MUST be plotted as "cond ? 1 : 0" — "plot()" requires numeric input.

**Plot names must be unique.** If you call "plot()" twice with the same title, PineTS appends "#1", "#2" suffixes and breaks lookup by name.

---

## Timeframe & Symbol: Set Them at Instantiation, Not in the Script

The PineTS instance is constructed with a fixed symbol and timeframe:

\`\`\`ts
const pine = new PineTS(provider, 'BTC', '240', 500);
\`\`\`

This is the **chart timeframe** for the whole script. All bare references to "close", "high", "volume", "ta.ema(close, 20)", etc. operate on this timeframe.

**Do not hardcode timeframes inside the script.** If the strategy needs 4h analysis, instantiate PineTS at "'240'" and write the script as if it's the only timeframe that exists. This is simpler, faster, and avoids all "request.security" complications.

---

## When You Actually Need Multi-Timeframe: "request.security"

PineTS implements "request.security" by **creating a second PineTS instance** at the target timeframe and re-running the expression there. Consequences:

1. The data provider must support that timeframe for that symbol.
2. Computing indicators INSIDE "request.security" is correct — the secondary context runs the expression on its own timeframe's "close", "high", etc.
3. Always pass "lookahead=barmerge.lookahead_off" to avoid lookahead bias.
4. **Same-TF "request.security" is a no-op or NaN generator** — if your chart TF is '240' and you also request '240', don't.
5. **Never request a LOWER timeframe than the chart TF** — you can't recover sub-bar data from aggregated bars. "request.security" is for going UP in TF.

✅ Correct multi-TF (chart = '60', higher TF = '240'):

\`\`\`pine
ema20_4h = request.security(syminfo.tickerid, '240', ta.ema(close, 20), lookahead=barmerge.lookahead_off)
atr_4h   = request.security(syminfo.tickerid, '240', ta.atr(14),        lookahead=barmerge.lookahead_off)
rsi_4h   = request.security(syminfo.tickerid, '240', ta.rsi(close, 14), lookahead=barmerge.lookahead_off)
\`\`\`

❌ Wrong — ATR computed on chart TF, not 4h:

\`\`\`pine
[h4, l4, c4] = request.security(syminfo.tickerid, '240', [high, low, close])
atr_4h = ta.atr(14)  // still the chart's TF
\`\`\`

**Strong default recommendation:** pick one timeframe per script. If the strategy is "4h regime filter + 1h trigger", either:

- Instantiate at '60' and fetch '240' via "request.security" (matches the original Pine idiom), OR
- Instantiate at '240' and drop the trigger logic (simpler, often good enough).

Mixing works but is the most common source of bugs.

---

## 🚫 Unsupported Functions in PineTS (with Workarounds)

The following TradingView Pine functions DO NOT WORK in PineTS. Using them throws "X is not a function" at runtime. Use the workarounds instead.

### Technical Analysis

| TradingView Pine | PineTS workaround                                |
|------------------|--------------------------------------------------|
| "ta.sum(x, n)"   | "ta.sma(x, n) * n" (rolling sum over n bars)     |

### Fundamental/Market Data Requests (ALL UNSUPPORTED)

| TradingView Pine          | Workaround                                     |
|---------------------------|------------------------------------------------|
| "request.financial()"     | Fetch in TS, inject via "Indicator" inputs     |
| "request.earnings()"      | Same                                           |
| "request.dividends()"     | Same                                           |
| "request.splits()"        | Same                                           |
| "request.economic()"      | Same                                           |
| "request.currency_rate()" | Fetch FX rate in TS                            |
| "request.quandl()"        | Fetch in TS                                    |
| "request.seed()"          | Fetch in TS                                    |

Only "request.security()" (and "request.security_lower_tf()") are implemented. Anything else under "request.*" throws at runtime.

### Control Flow

| TradingView Pine          | PineTS workaround                              |
|---------------------------|------------------------------------------------|
| "while cond"              | Not supported — rewrite as bounded "for" loop  |
| "for x in array"          | Not supported — use indexed "for (let i ...)"  |

"for" loops must use JS syntax: "for (let i = 0; i <= n; i++) { ... }", NOT Pine's "for i = 0 to n".
"switch" uses JS syntax: "switch (x) { case 1: ...; break; default: ...; }".

### Modules & Runtime

| TradingView Pine      | PineTS workaround                                  |
|-----------------------|----------------------------------------------------|
| "library(...)"        | Not supported — keep the script self-contained     |
| "import user/lib/1"   | Not supported — inline helpers directly            |
| "max_bars_back(n)"    | Not supported — control lookback via fetchCandleCount |
| "runtime.error(...)"  | Not supported — guard with "na()"/"nz()"           |
| "ask", "bid"          | Not available — use "close" or provider-side feeds |

### NaN / Missing Data Handling

"na(x)", "nz(x, def)", and "fixnan(x)" are all supported in PineTS. Prefer "nz(x, def)" when a meaningful default exists. Use "fixnan(x)" to carry the previous non-"na" value forward.

### String Manipulation

| TradingView Pine    | PineTS workaround                               |
|---------------------|-------------------------------------------------|
| "str.split()"       | Do string work in TS before/after Pine run     |
| "str.substring()"   | Same                                            |
| "str.format_time()" | Format timestamps in TS with "Intl.DateTimeFormat" |

### Math Conversions

| TradingView Pine         | PineTS workaround        |
|--------------------------|--------------------------|
| "math.todegrees(rad)"    | "rad * 180 / math.pi"    |
| "math.toradians(deg)"    | "deg * math.pi / 180"    |

### Alerts

| TradingView Pine       | PineTS workaround                              |
|------------------------|------------------------------------------------|
| "alert(...)"           | Emit via "plot()", consume from TS             |
| "alertcondition(...)"  | Same — plot the condition, act on it in TS     |

(Note: PineTS docs mention runtime alert support but coverage is incomplete. For agent reliability, stick to "plot()" as the output channel.)

### Strategy API (DON'T USE)

Don't use "strategy.entry()", "strategy.close()", "strategy.exit()", "strategy.risk.*", etc. Even though PineTS implements "strategy()", your bot is the execution layer — Pine only computes signals.

---

## Caller/Agent Contract

The calling agent must pass:

| Param        | Required format                          | Common mistakes                   |
|--------------|------------------------------------------|-----------------------------------|
| "tickerId"   | Symbol recognized by the active provider | Passing 'xyz', wrong case         |
| "timeframe"  | One of: '1','3','5','15','30','60','120','240','D','W','M' | Passing '4h', passing number |
| "limit"      | ≥ (slowest period × 2) bars              | Passing 100 with EMA200 in script |

For the Hyperliquid provider, use the raw coin symbol (e.g., "'BTC'", "'ETH'") — whatever key your provider's "getMarketData" expects.

**Critical for multi-TF scripts:** "syminfo.tickerid" returns whatever string your provider's "getSymbolInfo().tickerid" field is set to. This string is passed back to "getMarketData" by "request.security". Your provider MUST set "tickerid" to the raw form its own "getMarketData" accepts — not a fancy "HYPERLIQUID:BTCUSD.P" display string.

---

## Operators & Syntax

- Multiplication requires "*": "0.2 * atr", never "0.2atr"
- Comparison: ">", "<", ">=", "<=", "==", "!="
- Logical: "and", "or", "not" (lowercase words — NOT "&&", "||", "!")
- Ternary: "cond ? a : b"
- Historical series reference: "close[1]" = previous bar's close. Prefer this form (Pine-style) over treating "close" as a raw JS array — in PineTS, direct numeric indexing on a series can return chronologically-ordered values (oldest first), which is the opposite of what you want. Stick to "close[n]" for n-bars-ago semantics.

## PineTS-specific Syntax Gotchas

- **"var" vs "let"**: "var x = value" follows Pine semantics — persists across bars. "let x = value" resets each bar (standard JS semantics). Use "var" for rolling counters like "consecutive-N-closes-below-EMA50".
- **Loops use JS syntax**:
  - ✅ "for (let i = 0; i <= n; i++) { ... }"
  - ❌ "for i = 0 to n" (TradingView Pine syntax — won't parse)
- **Switch uses JS syntax**:
  - ✅ "switch (x) { case 1: ...; break; default: ...; }"
  - ❌ Pine-style "switch x \\n 1 => ...".
- **User-defined function returning a tuple must DOUBLE-WRAP** the return array so the runtime can tell a tuple from a time-series:
  \`\`\`pine
  myFn(x) =>
      a = x * 2
      b = x + 1
      [[a, b]]   // double brackets — single brackets look like a time-series
  [a, b] = myFn(close)
  \`\`\`
  "request.security" multi-returns and "ta.macd"-style built-ins destructure normally with single-bracket assignment.
- **Keep "//@version=5"**. Do not output "//@version=6".

---

## Timeframe Strings (PineTS-supported)

"'1'", "'3'", "'5'", "'15'", "'30'", "'45'", "'60'", "'120'", "'180'", "'240'", "'D'", "'W'", "'M'".

Never use "'4h'", "'1h'", "'1d'" — use the numeric minute strings.

---

## Volume Comparisons

If your chart TF is already the timeframe you want (e.g., '240'):

\`\`\`pine
vol_avg = ta.sma(volume, 42)   // 42 = 7d × 24h / 4h
volOk = volume >= 1.1 * vol_avg
\`\`\`

If you need a rolling N-bar sum (remember "ta.sum" is unsupported):

\`\`\`pine
vol_sum_last_4 = ta.sma(volume, 4) * 4
\`\`\`

---

## Warmup & NaN

Indicators return "na" until they have enough bars. EMA200 needs 200+, ATR(14) needs 14+. If the caller asks for a signal on a script whose slowest indicator hasn't warmed up, the booleans will be "false" because "NaN > NaN" is "false". The caller must request "limit" ≥ (slowest period × 2) worth of bars.

Guard the output so the caller can distinguish "not ready" from "false":

\`\`\`pine
ready = not na(ema200) and not na(atr) and not na(rsi)
plot(ready ? 1 : 0, 'ready')
\`\`\`

Agent MUST check "ready === 1" before trusting "longCond" / "shortCond".

---

## Input Contract (When Using "Indicator" Runtime Inputs)

If the caller uses "new Indicator(code, { Length: 20 })" to override inputs, the key must match the "title" argument of "input.*", NOT the variable name:

\`\`\`pine
length = input.int(14, "Length")  // TS must pass { Length: 20 }, not { length: 20 }
\`\`\`

---

## Required Output Contract

Every generated script MUST plot every value the agent needs, using stable unique names. Minimum output set for a signal script:

\`\`\`pine
plot(close, 'close')
plot(ema20, 'ema20')
plot(ema50, 'ema50')
plot(ema200, 'ema200')
plot(rsi, 'rsi')
plot(atr, 'atr')
plot(volOk ? 1 : 0, 'volOk')
plot(longCond and ready ? 1 : 0, 'longCond')
plot(shortCond and ready ? 1 : 0, 'shortCond')
plot(ready ? 1 : 0, 'ready')
\`\`\`

The downstream parser reads these by name. Do not rename them between runs.

---

## Worked Example — EMA-stack pullback with 1h reversal trigger

This script demonstrates the patterns above for a strategy with a 4h trend/momentum/volume filter and a 1h reversal candle trigger. Call the tool with "timeframe: '60'" and "fetchCandleCount: 1000" so the 4h EMA(200) has enough warmup.

\`\`\`pine
//@version=5
indicator('Swing pullback signals', overlay=false)

// --- Chart TF is '60' (1h). Everything 4h comes through request.security. ---

// 4h trend filter
ema20_4h  = request.security(syminfo.tickerid, '240', ta.ema(close, 20),  lookahead=barmerge.lookahead_off)
ema50_4h  = request.security(syminfo.tickerid, '240', ta.ema(close, 50),  lookahead=barmerge.lookahead_off)
ema200_4h = request.security(syminfo.tickerid, '240', ta.ema(close, 200), lookahead=barmerge.lookahead_off)

// 4h momentum + volatility
rsi_4h = request.security(syminfo.tickerid, '240', ta.rsi(close, 14), lookahead=barmerge.lookahead_off)
atr_4h = request.security(syminfo.tickerid, '240', ta.atr(14),        lookahead=barmerge.lookahead_off)

// 4h volume confirmation. 7d of 4h bars = 7 * 24 / 4 = 42 bars.
// ta.sma(volume, 42) is computed INSIDE request.security so the volume series is the 4h series.
vol_avg_4h = request.security(syminfo.tickerid, '240', ta.sma(volume, 42), lookahead=barmerge.lookahead_off)
vol_last_4h = request.security(syminfo.tickerid, '240', volume,            lookahead=barmerge.lookahead_off)
volOk = vol_last_4h >= 1.1 * vol_avg_4h

// Pullback zones from 4h EMA(20), width = [0.2 * atr_4h, 1.0 * atr_4h]
pullbackHighLong  = ema20_4h - 0.2 * atr_4h
pullbackLowLong   = ema20_4h - 1.0 * atr_4h
pullbackLowShort  = ema20_4h + 0.2 * atr_4h
pullbackHighShort = ema20_4h + 1.0 * atr_4h

// 1h reversal candle — current bar is the most recent completed 1h candle at chart TF
bull1h = close > open and (close - low)  >= 0.25 * atr_4h
bear1h = close < open and (high - close) >= 0.25 * atr_4h

// Entry rules
longCond  = ema20_4h > ema50_4h and ema50_4h > ema200_4h
           and close >= pullbackLowLong and close <= pullbackHighLong
           and bull1h
           and rsi_4h >= 40 and rsi_4h <= 65
           and volOk

shortCond = ema20_4h < ema50_4h and ema50_4h < ema200_4h
           and close >= pullbackLowShort and close <= pullbackHighShort
           and bear1h
           and rsi_4h >= 35 and rsi_4h <= 60
           and volOk

ready = not na(ema200_4h) and not na(atr_4h) and not na(rsi_4h) and not na(vol_avg_4h)

plot(close,      'close')
plot(ema20_4h,   'ema20_4h')
plot(ema50_4h,   'ema50_4h')
plot(ema200_4h,  'ema200_4h')
plot(rsi_4h,     'rsi_4h')
plot(atr_4h,     'atr_4h')
plot(vol_last_4h,'vol_last_4h')
plot(vol_avg_4h, 'vol_avg_4h')
plot(volOk ? 1 : 0,              'volOk')
plot(bull1h ? 1 : 0,             'bull1h')
plot(bear1h ? 1 : 0,             'bear1h')
plot(longCond  and ready ? 1 : 0,'longCond')
plot(shortCond and ready ? 1 : 0,'shortCond')
plot(ready ? 1 : 0,              'ready')
\`\`\`

Use this as a template — swap indicators, thresholds, and plot names to match the actual STRATEGY.md you've been given. Keep the overall shape: chart TF = entry-trigger TF, higher-TF values via "request.security" with the "ta.*" call wrapped inside, one named plot per downstream-needed value, a "ready" gate on the output booleans.`;

const SYSTEM_PROMPT = `You are a technical analyst. Your task is to analyze a given asset based on the user's strategy and decide the next action.

## Rules
- If there is opened position, you can only close or increase position size. you cannot change from long to short or short to long

## Output
- Concise summary of the analysis without headings or titles.
- Be direct and specific: cite the actual indicator values and which rules passed or failed.
- If the decision is HOLD, briefly state which rule(s) failed or which limits blocked the trade.
- If the decision is LONG/SHORT/CLOSE, state the rules that supported it and include the proposed order (for entries) or the triggered exit condition (for closes).


${pinescriptGuide}`;

export class AssetAnalyzer {
  constructor(private runtime: AgentRuntime) {}

  async analyze(
    ctx: { abortSignal?: AbortSignal },
    coin: string,
    pairInfo: PairInfo,
    account: AccountSummary,
    currentPosition?: {
      side: string;
      size: number;
      entryPrice: number;
      pnl: number;
      leverage: number;
    },
  ): Promise<string> {
    const dex = coin.includes(':') ? coin.split(':')[0] : undefined;

    const hyperliquidProvider = await HyperliquidProvider.create({ dex });
    const pineScriptTool = createPineScriptToolForAsset(coin, hyperliquidProvider);

    const agent = new ToolLoopAgent({
      model: this.runtime.model,
      instructions: cacheableSystem(SYSTEM_PROMPT),
      maxOutputTokens: ANALYZER_MAX_OUTPUT_TOKENS,
      tools: {
        pineScriptTool,
      },
    });

    const currentPositionLine = currentPosition
      ? `## Position 
side:${currentPosition.side} 
size:${currentPosition.size}
entry:$${currentPosition.entryPrice} 
pnl:$${currentPosition.pnl.toFixed(2)}
leverage=${currentPosition.leverage}x`
      : `## Position
No open position`;

    const availableUsdc = account.spotBalances.find((b) => b.coin === 'USDC')?.hold ?? '0';

    const prompt = `## Asset
Asset: ${coin}
Mark price: ${pairInfo.markPx}
Mid price: ${pairInfo.midPx ? `$${pairInfo.midPx}` : 'N/A'}
Funding rate: ${pairInfo.funding}
Open interest: $${pairInfo.openInterest.toLocaleString()}
Prev day price: $${pairInfo.prevDayPx}
24h volume: $${pairInfo.dayNtlVlm.toLocaleString()}


${currentPositionLine}

## Account
Value: $${account.accountValue.toFixed(2)} 
Margin Used=$${account.marginUsed.toFixed(2)}
Available Trading Balance: value=${availableUsdc}

## Strategy
${this.runtime.config.strategyContent}`;

    const res = await agent.generate({ prompt, abortSignal: ctx.abortSignal });
    return res.text;
  }
}
