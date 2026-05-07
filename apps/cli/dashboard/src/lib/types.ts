export type WebEventPayload =
  | { type: 'message'; text: string }
  | { type: 'error'; errorMessage: string }
  | {
      type: 'decision';
      action: 'LONG' | 'SHORT' | 'CLOSE' | 'HOLD';
      asset: string;
      reasoning: string;
      sizeUsd?: number;
    }
  | { type: 'online'; name: string; bio: string }
  | { type: 'chat'; role: 'user' | 'agent' | 'error' | 'tool'; text: string }
  | { type: 'system'; kind: 'clear-chat' };

export type WebEvent = { seq: number; timestamp: string } & WebEventPayload;

export interface WebEventsSince {
  events: WebEvent[];
  latest: number;
  oldestSeq: number;
}

export interface DetailedPosition {
  coin: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  markPrice: number | null;
  positionValueUsd: number;
  unrealizedPnl: number;
  roePercent: number;
  liquidationPx: number | null;
  marginUsed: number;
  funding: number;
  leverage: number;
}

export interface WebState {
  agentName: string;
  watchlist: string[];
  positions: DetailedPosition[];
  memory: string;
}
