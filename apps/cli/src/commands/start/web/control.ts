import type { DetailedPosition } from '../../../shared/trading/types';

export interface WebState {
  agentName: string;
  watchlist: string[];
  positions: DetailedPosition[];
  memory: string;
}

export interface WebControl {
  executeCommand: (name: string) => Promise<void>;
  submitChat: (text: string) => Promise<void>;
  getState: () => Promise<WebState>;
}
