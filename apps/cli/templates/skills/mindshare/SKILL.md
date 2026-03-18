---
name: mindshare
description: >
  Market sentiment analysis using mindshare data. Use when (1) signal mentions
  social sentiment, narrative, or hype levels, (2) claims a project is trending
  or gaining attention, (3) references KOL activity or community buzz, (4)
  discusses narrative rotation between sectors. Triggers on: "mindshare",
  "sentiment", "trending", "social attention", "narrative shift", "KOL".
compatibility: Requires mindshare_* tools from hive-cli.
---

# Mindshare Analysis Knowledge

Strategic guidance for analyzing market sentiment through mindshare data.

## What is Mindshare?

Mindshare measures the share of social attention a project, sector, or user captures relative to the overall conversation. It's derived from social media activity, primarily Twitter/X, and represents how much "mental bandwidth" the market is allocating to different assets.

Key concepts:

- **Mindshare Value:** Percentage of total attention (e.g., 2.5% means this asset captures 2.5% of all discussion)
- **Mindshare Delta:** Change in mindshare over the timeframe (positive = gaining attention, negative = losing attention)
- **Rank:** Position relative to other projects/sectors/users

## Decision Framework: When to Use Mindshare

**Use mindshare when the signal:**

- Mentions social sentiment, narrative, or hype levels
- Claims a project is "trending" or "gaining attention"
- References KOL activity or community buzz
- Discusses narrative rotation (DeFi to AI, L1 to L2, etc.)
- Makes claims about retail interest or social momentum

**Skip mindshare when the signal:**

- Is purely technical (price patterns, support/resistance)
- Focuses on fundamentals (TVL, revenue, on-chain metrics)
- Discusses tokenomics or unlock schedules
- Is about macro events without social angle

**Mindshare confirms sentiment, not price.** High mindshare means attention, not necessarily bullish price action. A project can trend for negative reasons.

## Signal Types and When to Use Them

### Delta Signals (Sudden Spikes)

**What:** Detects rapid increases in mindshare over a short period.

**Use when:**

- You want to catch early momentum shifts
- Looking for projects suddenly gaining attention
- Validating claims about "sudden interest" or "breakout buzz"

**Interpret:**

- High delta (>10%) = significant attention spike
- Moderate delta (3-10%) = notable increase
- Low delta (<3%) = minor uptick

**Caveat:** Spikes can be driven by FUD, hacks, or drama — not just bullish sentiment.

### MA Signals (Sustained Attention)

**What:** Detects mindshare exceeding its moving average by standard deviations.

**Use when:**

- Looking for projects with sustained elevated attention
- Validating claims about "continued interest"
- Distinguishing flash-in-the-pan from real momentum

**Interpret:**

- > 2 std dev above MA = significantly elevated
- 1-2 std dev = moderately elevated
- <1 std dev = within normal range

**Best for:** Confirming that buzz isn't just a one-day spike.

### SMA Z-Score Signals (Statistical Anomalies)

**What:** Uses Z-scores to detect statistically unusual mindshare levels relative to historical norms.

**Use when:**

- Looking for outliers — projects with attention levels far from their baseline
- Validating "unprecedented interest" claims
- Identifying potential narrative shifts early

**Interpret:**

- Z-score > 2.0 = highly anomalous (2+ std deviations above mean)
- Z-score 1.0-2.0 = elevated but not extreme
- Z-score < 1.0 = within normal variation

**Best for:** Catching early-stage momentum before it becomes obvious.

## Analysis Workflow

### Step 1: Establish Baseline

Before checking signals, understand the current landscape:

- What sectors are trending?
- Who are the top projects by mindshare?
- Is overall attention on majors or altcoins?

### Step 2: Match Data to Claim

Select the appropriate tool based on what the signal claims:

| Signal Claims                          | Use This Tool                          |
| -------------------------------------- | -------------------------------------- |
| "X is trending" or "gaining attention" | Project Leaderboard (check rank/delta) |
| "Sudden spike in interest"             | Delta Signals                          |
| "Sustained momentum"                   | MA Signals                             |
| "Unprecedented interest"               | SMA Z-Score Signals                    |
| "KOLs are talking about X"             | User Leaderboard by Project            |
| "DeFi rotation happening"              | Sector Leaderboard                     |

### Step 3: Validate or Contradict

Compare data against the signal's claim:

- **Confirms:** Data supports the thesis → note in analysis
- **Neutral:** Data inconclusive → don't weight heavily
- **Contradicts:** Data opposes the thesis → flag discrepancy

### Step 4: Add Context

Mindshare data needs interpretation:

- Is high mindshare from positive or negative attention?
- How does current mindshare compare to historical peaks?
- Who's driving the conversation (KOLs, retail, bots)?

## Interpretation Patterns

### Confirming Social Momentum

**Signal:** "SOL is gaining massive attention"
**Data:** SOL #3 on project leaderboard, +15% delta
**Your take:** "Mindshare data confirms elevated attention — SOL ranks #3 with +15% delta over 24h"

### Contradicting Hype Claims

**Signal:** "Everyone is talking about PROJECT_X"
**Data:** PROJECT_X not in top 50, delta +0.5%
**Your take:** "Mindshare data doesn't support broad hype — PROJECT_X not in top 50 and minimal delta"

### Detecting Narrative Rotation

**Signal:** "AI narrative is heating up"
**Data:** AI sector #2 on sector leaderboard, +8% delta; DeFi sector -3% delta
**Your take:** "Sector mindshare confirms AI rotation — AI sector gaining while DeFi declining"

### Identifying KOL-Driven Moves

**Signal:** "Influencers are pushing TOKEN_Y"
**Data:** User leaderboard for TOKEN_Y shows top 5 users account for 60% of mindshare
**Your take:** "Mindshare concentrated among few KOLs — move may lack broad retail interest"

## Common Pitfalls

### Equating Mindshare with Bullishness

**Problem:** Assuming high mindshare = bullish.
**Fix:** Mindshare measures attention, not sentiment direction. A project trending due to an exploit has high mindshare but negative sentiment.

### Ignoring Baseline

**Problem:** "2% mindshare is huge!"
**Fix:** For BTC/ETH, 2% is low. For a small-cap, 2% is massive. Compare to historical norms and peer projects.

### Chasing Old News

**Problem:** Acting on a spike that already happened.
**Fix:** Check timestamp on signals. A delta spike from 6 hours ago may already be priced in. Look for fresh signals.

### Over-Relying on Single Timeframe

**Problem:** "24h delta is flat, no momentum."
**Fix:** Check multiple timeframes. 7D might show sustained uptrend even if 24h is consolidating.

### Ignoring Who's Talking

**Problem:** High mindshare but all from low-credibility accounts.
**Fix:** Cross-reference with user leaderboard. Quality of attention matters as much as quantity.

## Timeframe Selection Guide

- **30m:** Real-time monitoring, catching breaking news
- **24h:** Standard daily analysis, most signal contexts
- **3D:** Short-term trend, filtering out daily noise
- **7D:** Weekly trends, narrative arcs
- **1M:** Monthly themes, sector rotations
- **3M:** Longer-term trend context
- **YTD:** Yearly perspective, major narrative shifts

Match timeframe to signal's implied horizon. A "this week's play" signal needs 7D context; a "today's alpha" needs 24h.

## Output Format

When presenting mindshare findings in your analysis:

```
**Mindshare Check:** [Project/Sector] - [Rank] with [delta]%
- [What this means in context]
- [Whether it confirms, contradicts, or is neutral to signal's claim]
```

Keep it concise. Mindshare is one sentiment input, not the full analysis.

## Combining with Other Data

Mindshare works best when combined with:

- **Price action:** High mindshare + price breakout = momentum confirmation
- **Volume:** High mindshare + volume spike = real interest
- **On-chain:** High mindshare + wallet growth = retail accumulation
- **TA indicators:** High mindshare + RSI oversold = potential bounce catalyst

The strongest signals align across multiple data types.
