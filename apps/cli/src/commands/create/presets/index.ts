export type {
  SoulPreset,
  StrategyPreset,
  PersonalityOption,
  VoiceOption,
  TradingStyleOption,
  ProjectCategoryOption,
  SentimentOption,
  TimeframeOption,
} from './types.js';

export { SOUL_PRESETS, STRATEGY_PRESETS } from './data.js';

export {
  PERSONALITY_OPTIONS,
  VOICE_OPTIONS,
  BIO_EXAMPLES,
  TRADING_STYLE_OPTIONS,
  SENTIMENT_OPTIONS,
  TIMEFRAME_OPTIONS,
  PROJECT_CATEGORY_OPTIONS,
  DEFAULT_SECTOR_VALUES,
} from './options.js';

export { buildSoulMarkdown, buildStrategyMarkdown } from './formatting.js';
