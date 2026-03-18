---
name: ta
description: >
  Technical analysis for crypto trading signals. Use when (1) signal mentions
  price levels, targets, or stop losses, (2) references chart patterns like
  breakout, support, resistance, (3) claims momentum shift or trend reversal,
  (4) makes time-sensitive entry/exit recommendations. Triggers on: "RSI",
  "MACD", "Bollinger", "oversold", "overbought", "support", "resistance",
  "breakout", "momentum".
compatibility: Requires market_* tools from hive-cli.
---

# Technical Analysis Knowledge

Strategic guidance for applying technical analysis to crypto trading signals.

## Decision Framework: When to Use TA

**Use TA when the signal:**
- Mentions specific price levels, targets, or stop losses
- References chart patterns (breakout, support, resistance, consolidation)
- Claims momentum shift or trend reversal
- Makes time-sensitive entry/exit recommendations

**Skip TA when the signal:**
- Is purely fundamental (team news, partnerships, protocol upgrades)
- Discusses long-term thesis without actionable price levels
- Focuses on narrative or sentiment without technical claims
- Is about assets too illiquid for meaningful TA (sub-$1M daily volume)

**One-indicator rule:** For most signals, one well-chosen indicator is enough. Adding more often creates noise without improving conviction.

## Signal Analysis Workflow

When you receive a trading signal, follow this sequence:

### Step 1: Establish Context
Get current price first. This anchors everything else:
- Is the signal's mentioned price still relevant?
- Has the market already moved past the entry point?
- What's the 24h momentum direction?

### Step 2: Match Indicator to Claim
Select ONE indicator based on what the signal claims:

| Signal Claims | Use This |
|---------------|----------|
| "Oversold bounce" or "overbought pullback" | RSI |
| "Breaking out" or "breaking down" | Bollinger Bands |
| "Momentum shifting" or "trend reversing" | MACD |
| "Above/below key moving average" | SMA or EMA |
| "At support/resistance" | Price + recent OHLC |

### Step 3: Validate or Contradict
Compare indicator reading against the signal's claim:
- **Confirms:** Indicator supports the thesis → higher conviction
- **Neutral:** Indicator inconclusive → use other factors
- **Contradicts:** Indicator opposes the thesis → lower conviction, note in analysis

### Step 4: State Your Finding
Be direct: "RSI at 28 confirms oversold conditions" or "RSI at 55 does not support oversold claim."

## Indicator Selection Guide

### RSI (Momentum Exhaustion)
**Best for:** Signals claiming overbought/oversold conditions or momentum exhaustion.

Use RSI when:
- Signal says "oversold bounce incoming" → check if RSI < 30
- Signal says "overbought, expect pullback" → check if RSI > 70
- Signal claims momentum is shifting

Don't use RSI when:
- Asset is in a strong trend (RSI can stay overbought/oversold for weeks)
- Signal is about breakouts (use Bollinger instead)

### MACD (Trend Direction)
**Best for:** Signals claiming trend changes or momentum shifts.

Use MACD when:
- Signal claims "momentum turning bullish/bearish"
- Signal mentions "trend reversal"
- You need to confirm direction, not just magnitude

Read the histogram, not just the lines. Shrinking histogram often precedes crossover.

### Bollinger Bands (Volatility & Range)
**Best for:** Breakout/breakdown signals and volatility plays.

Use Bollinger when:
- Signal claims price is "breaking out" → is price actually outside bands?
- Signal mentions "consolidation before move" → are bands squeezing?
- You need to assess if current price is extended

Bandwidth squeeze (bands contracting) often precedes large moves in either direction.

### Moving Averages (Trend Context)
**Best for:** Understanding the broader trend context.

Use SMA/EMA when:
- Signal mentions specific MAs (50-day, 200-day)
- You need to determine if price is in uptrend or downtrend
- Signal claims "golden cross" or "death cross"

Common periods: 20 (short-term), 50 (medium-term), 200 (long-term trend).

## Interpretation Patterns

### Confirming vs. Contradicting Signals

**Strong confirmation pattern:**
- Signal: "BTC oversold, expecting bounce"
- RSI: 25 (deeply oversold)
- Your take: "RSI confirms oversold at 25, supporting bounce thesis"

**Clear contradiction pattern:**
- Signal: "ETH overbought, short opportunity"
- RSI: 58 (neutral)
- Your take: "RSI at 58 does not support overbought claim; momentum neutral"

**Nuanced interpretation:**
- Signal: "SOL breaking out of consolidation"
- Bollinger: Price at upper band, but bands not particularly tight
- Your take: "Price touching upper band but no prior squeeze; breakout less convincing"

### Reading Multiple Timeframes

If signal doesn't specify timeframe, default to daily. But consider:
- Hourly: Short-term momentum, intraday signals
- Daily: Standard swing trading, most signals
- Weekly: Trend context for longer-term positions

Timeframe should match the signal's implied holding period.

## Common Pitfalls

### Over-Analyzing
**Problem:** Using 5 indicators when 1 would suffice.
**Fix:** Pick the ONE indicator that directly tests the signal's claim.

### Confirmation Bias
**Problem:** Cherry-picking indicators that agree with the signal.
**Fix:** Pick indicator BEFORE looking at it, based on what's being claimed.

### Ignoring Context
**Problem:** "RSI is 32" without knowing what that means for this asset.
**Fix:** Some assets run hot (RSI rarely below 40), others are volatile. State the reading and what it suggests, not just the number.

### Lagging Indicator Trap
**Problem:** All these indicators use historical data. By the time MACD crosses, the move may be mostly done.
**Fix:** Use indicators to validate claims, not predict futures. "The signal claimed X, indicator reading is Y" — not "indicator says price will go up."

### False Precision
**Problem:** "RSI at 69.7 suggests we're approaching overbought."
**Fix:** Treat zones, not precise numbers. 65-75 is "approaching overbought," not a decimal reading.

## Available Tools

The following market tools are available for technical analysis:

- `market_getPrice` - Get price at a specific timestamp
- `market_getOHLC` - Get historical OHLC candlestick data
- `market_getSMA` - Calculate Simple Moving Average
- `market_getEMA` - Calculate Exponential Moving Average
- `market_getRSI` - Calculate Relative Strength Index
- `market_getMACD` - Calculate MACD indicator
- `market_getBollinger` - Calculate Bollinger Bands

## Output Format

When presenting TA findings in your analysis:

```
**Technical Check:** [Indicator] at [reading]
- [What this reading means in context]
- [Whether it confirms, contradicts, or is neutral to signal's claim]
```

Keep it brief. TA is one input to conviction, not the whole analysis.
