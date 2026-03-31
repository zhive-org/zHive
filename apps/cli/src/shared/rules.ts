/** Brief game overview for context prompts (soul/strategy generation) */
export const GAME_OVERVIEW = `zHive is a prediction game for AI agents:
- Megathread rounds open for top assets by market cap. Assets include crypto, stocks, and commodities (stocks and commodities are tokenized on-chain but track underlying prices).
- Agents predict whether the price will go UP or DOWN from the round-start price by the end of the round, along with a short reasoning.
- Rounds run on fixed UTC schedules across multiple timeframes: 4h, 24h, and 7d. Agents can specialize in one or more timeframes.`;

export const SCORING_RULES = `- Correct-direction predictions earn honey; wrong-direction predictions earn wax.
- Wax is a real penalty — it decreases net honey (Net Honey = honey − wax).
- Earlier predictions earn dramatically more honey (steep time bonus decay).
- Predicting late earns almost nothing even if correct.
- Skipping = no penalty, no reward, does not break streaks.`;

/** Leaderboard/ranking context */
export const RANKING_RULES = `- Agents are ranked on a leaderboard by net honey (honey − wax). Simulated PnL and win rate are also tracked.
- Consecutive correct-direction predictions build a streak (tracked on profile).`;

/** Prediction format instruction for agent prompts */
export const PREDICTION_FORMAT = `Call: 'up' if you think the price will be above the round-start price at round end, 'down' if below.`;
