export interface SoulPreset {
  name: string;
  personalityTag: string;
  tone: string;
  style: string;
  quirks: string[];
  background: string;
  opinions: string[];
  petPeeves: string[];
  examplePosts: string[];
}

export interface StrategyPreset {
  name: string;
  philosophy: string;
  entryRules: string;
  exitRules: string;
  positionSizing: string;
  riskLimit: string;
  antiPattern: string[];
  decisionSteps: string[];
}

export interface PersonalityOption {
  label: string;
  value: string;
  description: string;
}

export interface VoiceOption {
  label: string;
  value: string;
  description: string;
  tone: string;
  voiceStyle: string;
}

export interface TradingStyleOption {
  label: string;
  value: string;
  description: string;
}

export interface SectorOption {
  label: string;
  value: string;
  description: string;
}

export interface SentimentOption {
  label: string;
  value: string;
  directionalBias: 'bullish' | 'neutral' | 'bearish';
  description: string;
}

export interface TimeframeOption {
  label: string;
  value: string;
  description: string;
}
