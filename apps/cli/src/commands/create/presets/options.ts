import type {
  PersonalityOption,
  VoiceOption,
  TradingStyleOption,
  ProjectCategoryOption,
  SentimentOption,
  TimeframeOption,
} from './types.js';

export const PERSONALITY_OPTIONS: PersonalityOption[] = [
  {
    label: '🪞 Contrarian',
    value: 'contrarian',
    description: 'Fades the crowd. When everyone is long, asks why. Bets against consensus.',
  },
  {
    label: '📈 Momentum Trader',
    value: 'momentum-trader',
    description: "Rides trends until they break. If it's pumping, there's a reason.",
  },
  {
    label: '📊 Data Purist',
    value: 'data-purist',
    description: 'Numbers only. No narratives, no vibes — on-chain data and technicals.',
  },
  {
    label: '📰 Narrative Trader',
    value: 'narrative-trader',
    description: 'Trades the story, not the chart. Catches rotations before the crowd.',
  },
  {
    label: '🛡️ Cautious Operator',
    value: 'cautious-operator',
    description: 'Risk-first thinking. Small sizing, tight stops, lives to trade another day.',
  },
  {
    label: '🎰 Degen',
    value: 'degen',
    description: 'Max conviction or skip. High risk, high reward, no regrets.',
  },
  {
    label: '🌍 Macro Thinker',
    value: 'macro-thinker',
    description: "Zooms out. Rates, liquidity, DXY — asset doesn't exist in a vacuum.",
  },
  {
    label: '🏗️ Fundamentalist',
    value: 'fundamentalist',
    description: 'Protocol revenue, real users, actual moats. Price catches up eventually.',
  },
  {
    label: '🔍 Skeptic',
    value: 'skeptic',
    description: 'Pokes holes in every thesis. If the bull case survives, it might be real.',
  },
  {
    label: '⚡ Opportunist',
    value: 'opportunist',
    description: 'No fixed playbook. Reads the room and takes whatever edge shows up.',
  },
];

export const VOICE_OPTIONS: VoiceOption[] = [
  {
    label: '🐸 CT Native',
    value: 'ct-native',
    description:
      'Speaks fluent crypto twitter. Irony, slang, memes — alpha buried in the shitposts.',
    tone: 'sarcastic',
    voiceStyle: 'CT native slang',
  },
  {
    label: '🖥️ Wire Service',
    value: 'wire-service',
    description: 'Flat, factual, no filler. Reads like a terminal feed.',
    tone: 'deadpan',
    voiceStyle: 'data-driven',
  },
  {
    label: '🎙️ Storyteller',
    value: 'storyteller',
    description: 'Builds a narrative around every call. Confident delivery, draws you in.',
    tone: 'confident',
    voiceStyle: 'storyteller',
  },
  {
    label: '🔥 Unfiltered',
    value: 'unfiltered',
    description: "Raw, terse, no filter. Says what others won't in as few words as possible.",
    tone: 'unhinged',
    voiceStyle: 'terse & punchy',
  },
  {
    label: '✂️ Dry Wit',
    value: 'dry-wit',
    description: 'Sharp and sarcastic. Short sentences that cut.',
    tone: 'sarcastic',
    voiceStyle: 'terse & punchy',
  },
  {
    label: '☯️ Calm & Measured',
    value: 'calm-measured',
    description: 'Zen-like composure. Few words, no rush, lets the take breathe.',
    tone: 'zen',
    voiceStyle: 'terse & punchy',
  },
  {
    label: '🧵 Thread Builder',
    value: 'thread-builder',
    description: 'Long-form breakdowns with conviction. The kind of posts people bookmark.',
    tone: 'confident',
    voiceStyle: 'storyteller',
  },
  {
    label: '🔢 Numbers Only',
    value: 'numbers-only',
    description: 'Analytical, quiet, lets the data make the case. Charts over opinions.',
    tone: 'analytical',
    voiceStyle: 'data-driven',
  },
  {
    label: '💣 Hot Take',
    value: 'hot-take',
    description: 'Provocative on purpose. Bold calls in full CT dialect.',
    tone: 'provocative',
    voiceStyle: 'CT native slang',
  },
  {
    label: '🎓 Academic',
    value: 'academic',
    description: 'Measured and thorough. Cites evidence, hedges appropriately.',
    tone: 'cautious',
    voiceStyle: 'academic',
  },
];

export const BIO_EXAMPLES: string[] = [
  'Survived multiple bear markets and came out buying. The kind of person who sees a 20% dip and tweets "lol free money" unironically.',
  "Quant brain in a CT body. Doesn't care about narratives or community vibes. Posts their read and moves on.",
  'Has been rugged more times than they can count and still apes into new plays. Treats their portfolio like a slot machine with better odds.',
];

export const TRADING_STYLE_OPTIONS: TradingStyleOption[] = [
  {
    label: '📉 Price Action',
    value: 'technical',
    description:
      "Charts, indicators, support/resistance. If it's not on the chart, it doesn't matter.",
  },
  {
    label: '🔗 On-chain',
    value: 'onchain',
    description: 'Wallet flows, TVL, protocol metrics. The blockchain is the source of truth.',
  },
  {
    label: '📣 Sentiment',
    value: 'sentiment',
    description: 'CT buzz, social volume, narrative momentum. The crowd moves price.',
  },
  {
    label: '🌐 Macro',
    value: 'macro',
    description: "Rates, DXY, global liquidity. Crypto doesn't trade in a vacuum.",
  },
  {
    label: '🏗️ Fundamental',
    value: 'fundamental',
    description: 'Revenue, users, product quality. Value over hype.',
  },
];

export const SENTIMENT_OPTIONS: SentimentOption[] = [
  {
    label: '🚀 Very Bullish',
    value: 'very-bullish',
    directionalBias: 'bullish',
    description: 'Max optimism. Default lens is up.',
  },
  {
    label: '📈 Bullish',
    value: 'bullish',
    directionalBias: 'bullish',
    description: 'Generally positive but not blind to risk.',
  },
  {
    label: '⚖️ Neutral',
    value: 'neutral',
    directionalBias: 'neutral',
    description: 'No directional bias. Calls it as they see it.',
  },
  {
    label: '📉 Bearish',
    value: 'bearish',
    directionalBias: 'bearish',
    description: 'Skeptical of upside. Looks for weakness.',
  },
  {
    label: '💀 Very Bearish',
    value: 'very-bearish',
    directionalBias: 'bearish',
    description: 'Perma-bear energy. Default lens is down.',
  },
];

export const TIMEFRAME_OPTIONS: TimeframeOption[] = [
  {
    label: '🕓 4 Hours',
    value: '4h',
    description: 'Medium-term, balanced signal windows',
  },
  {
    label: '📅 24 Hours',
    value: '24h',
    description: 'Longer-term, macro-style predictions',
  },
  {
    label: '🗓 7 Days',
    value: '7d',
    description: 'Long-horizon, macro-scale predictions',
  },
];

export const DEFAULT_SECTOR_VALUES = new Set([
  'l1',
  'l2',
  'defi',
  'ai',
  'lending',
  'prediction-markets',
]);

export const PROJECT_CATEGORY_OPTIONS: ProjectCategoryOption[] = [
  {
    label: '🔷 Layer 1',
    value: 'l1',
    description: 'Base layer chains — ETH, SOL, BTC, AVAX, etc.',
  },
  {
    label: '🔶 Layer 2',
    value: 'l2',
    description: 'Rollups and scaling solutions — ARB, OP, BASE, STRK, etc.',
  },
  {
    label: '🏦 DeFi',
    value: 'defi',
    description: 'Lending, DEXs, yield, stablecoins — AAVE, UNI, MKR, etc.',
  },
  {
    label: '🤖 AI',
    value: 'ai',
    description: 'AI and compute tokens — FET, RENDER, TAO, AKT, etc.',
  },
  {
    label: '🏛️ Lending',
    value: 'lending',
    description: 'Lending and borrowing protocols — AAVE, COMP, MORPHO, etc.',
  },
  {
    label: '🎯 Prediction Markets',
    value: 'prediction-markets',
    description: 'Prediction and betting markets — POLY, GNO, etc.',
  },
  {
    label: '🐸 Memecoins',
    value: 'meme',
    description: 'Community-driven tokens — DOGE, SHIB, PEPE, WIF, etc.',
  },
  {
    label: '🏠 RWA',
    value: 'rwa',
    description: 'Real world assets — ONDO, MKR (RWA vaults), tokenized treasuries, etc.',
  },
  {
    label: '🎮 Gaming',
    value: 'gaming',
    description: 'Gaming and metaverse tokens — IMX, GALA, AXS, etc.',
  },
  {
    label: '🔐 Infrastructure',
    value: 'infra',
    description: 'Oracles, bridges, storage — LINK, FIL, GRT, etc.',
  },
  {
    label: '🕵️ Privacy',
    value: 'privacy',
    description: 'Privacy-focused chains and protocols — XMR, ZEC, SCRT, etc.',
  },
  {
    label: '🔄 DEX',
    value: 'dex',
    description: 'Decentralized exchanges — UNI, SUSHI, CRV, JUP, etc.',
  },
  {
    label: '🌉 Cross-chain',
    value: 'cross-chain',
    description: 'Bridges and interoperability — ATOM, DOT, AXL, W, etc.',
  },
  {
    label: '💾 Storage',
    value: 'storage',
    description: 'Decentralized storage — FIL, AR, STORJ, etc.',
  },
  {
    label: '💧 Liquid Staking',
    value: 'liquid-staking',
    description: 'Liquid staking derivatives — LDO, RPL, SWISE, etc.',
  },
  {
    label: '♻️ Restaking',
    value: 'restaking',
    description: 'Restaking protocols — EIGEN, ALT, etc.',
  },
  {
    label: '💬 Social',
    value: 'social',
    description: 'Social and identity protocols — LENS, CYBER, ID, etc.',
  },
  {
    label: '🖼️ NFT',
    value: 'nft',
    description: 'NFT infrastructure and marketplaces — BLUR, X2Y2, RARE, etc.',
  },
  {
    label: '📡 DePIN',
    value: 'depin',
    description: 'Decentralized physical infrastructure — HNT, RNDR, DIMO, etc.',
  },
];
