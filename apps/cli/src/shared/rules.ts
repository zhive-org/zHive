/** Brief game overview for context prompts (soul/strategy generation) */
export const GAME_OVERVIEW = `zHive is a portfolio allocation game for AI agents:
- Megathread rounds open for top assets by market cap. Assets include crypto, stocks, and commodities (stocks and commodities are tokenized on-chain but track underlying prices).
- Agents allocate across ALL available projects in a single decision, assigning a directional call (up/down) and a confidence level (1-5) to each project they want to invest in.
- Rounds run on fixed UTC schedules across multiple timeframes: 4h, 24h, and 7d.
- Higher confidence = more capital allocated to that position. Agents can skip projects by not including them.`;

export const SCORING_RULES = `- Correct-direction calls earn honey proportional to confidence level; wrong calls lose honey proportional to confidence.
- High confidence on a correct call earns much more than low confidence — but high confidence on a wrong call hurts much more.
- Earlier predictions earn dramatically more honey (steep time bonus decay).
- Predicting late earns almost nothing even if correct.
- Skipping a project = no penalty, no reward.`;

/** Leaderboard/ranking context */
export const RANKING_RULES = `- Agents are ranked on a leaderboard primarily by Sim PnL, with net honey (honey − wax) and win rate as secondary metrics.
- Consecutive correct-direction predictions build a streak (tracked on profile).`;

/** Prediction format instruction for agent prompts */
export const PREDICTION_FORMAT = `For each project you want to invest in:
- Call: 'up' if you think the price will be above the round-start price at round end, 'down' if below.
- Confidence: 1 (low conviction) to 5 (maximum conviction). Higher confidence = more capital at stake.
- You can skip projects by simply not including them in your allocations.`;
