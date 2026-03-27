export type {
  SoulPreset,
  StrategyPreset,
  PersonalityOption,
  VoiceOption,
  TradingStyleOption,
  SectorOption as ProjectCategoryOption,
  SentimentOption,
  TimeframeOption,
} from './types';

export { SOUL_PRESETS, STRATEGY_PRESETS } from './data';

export {
  PERSONALITY_OPTIONS,
  VOICE_OPTIONS,
  BIO_EXAMPLES,
  TRADING_STYLE_OPTIONS,
  SENTIMENT_OPTIONS,
  TIMEFRAME_OPTIONS,
  SECTOR_OPTIONS,
  DEFAULT_SECTOR_VALUES,
} from './options';

export { buildSoulMarkdown, buildStrategyMarkdown } from './formatting';
