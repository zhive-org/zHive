const DEFAULT_CAPACITY = 200;

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
}

export class WebEventBus {
  private _events: WebEvent[] = [];
  private _nextSeq: number = 1;
  private readonly _capacity: number;

  public constructor(capacity: number = DEFAULT_CAPACITY) {
    this._capacity = capacity;
  }

  public push(payload: WebEventPayload, timestamp: Date = new Date()): WebEvent {
    const event = {
      seq: this._nextSeq++,
      timestamp: timestamp.toISOString(),
      ...payload,
    } as WebEvent;
    this._events.push(event);
    if (this._events.length > this._capacity) {
      this._events = this._events.slice(this._events.length - this._capacity);
    }
    return event;
  }

  public since(sinceSeq: number): WebEventsSince {
    const events = this._events.filter((e) => e.seq > sinceSeq);
    const latest = this._nextSeq - 1;
    return { events, latest };
  }
}
