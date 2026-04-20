export type ChatActivityType =
  | 'chat-user'
  | 'chat-agent'
  | 'chat-error'
  | 'tool-summary'
  | 'tool-call';

export interface ChatActivityItem {
  type: ChatActivityType;
  text: string;
  timestamp?: Date;
}

type BasePollActivityItem = {
  id?: string;
  timestamp: Date;
};
export type PollActivityItem = BasePollActivityItem &
  (
    | ({
        id: string;
        type: 'megathread';
        projectId: string;
        timeframe: string;
      } & MegathreadResult)
    | { type: 'message'; text: string }
    | { type: 'online'; bio: string; name: string }
    | { type: 'error'; errorMessage: string }
  );

type BaseMagathreadResult = {
  priceAtStart?: number;
  currentPrice?: number;
  timeLeftMs?: number;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    toolCalls: number;
    toolNames: string[];
    toolResults: Array<{ toolName: string; result: string }>;
  };
};

export type MegathreadResult = BaseMagathreadResult &
  (
    | {
        status: 'posted';
        call: 'up' | 'down';
        summary: string;
      }
    | {
        status: 'analyzing';
      }
    | {
        status: 'error';
        errorMessage: string;
      }
    | {
        status: 'skipped';
        skipReason?: string;
      }
  );

export type SettlePollActivityItem = Extract<
  PollActivityItem,
  { status: 'posted' | 'skipped' | 'error' }
>;
