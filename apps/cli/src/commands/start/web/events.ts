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
      /** Mid/mark the runtime fed into the evaluator for this asset. Carried
       * so the dashboard can show the exact price the agent reasoned with —
       * the SPA's HL WS sees a separate (slightly newer) snapshot. */
      priceUsed?: number;
    }
  | { type: 'online'; name: string; bio: string }
  | { type: 'chat'; role: 'user' | 'agent' | 'error' | 'tool'; text: string }
  | { type: 'system'; kind: 'clear-chat' }
  | { type: 'analyzing'; state: 'started' | 'completed'; assetCount?: number };

export type WebEvent = { seq: number; timestamp: string } & WebEventPayload;

export interface WebEventsSince {
  events: WebEvent[];
  latest: number;
  /** Lowest seq still in the buffer (0 when empty). Clients use this to detect
   * dropped events: if `since < oldestSeq - 1`, events between them have been
   * evicted by the capacity cap and the client should reseed. */
  oldestSeq: number;
  /** Increments on every reset(). Clients compare against the last value they
   * saw; a mismatch means seq numbering restarted (agent boundary), and the
   * client must drop its `since` cursor to 0 — otherwise its filter
   * (`e.seq > since`) silently swallows the new agent's first events. */
  generation: number;
}

export class WebEventBus {
  private _events: WebEvent[] = [];
  private _nextSeq: number = 1;
  private _generation: number = 1;
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

  public since(sinceSeq: number, clientGeneration?: number): WebEventsSince {
    // If the client is on a stale generation, its `since` cursor was minted
    // against the old seq space and would silently filter out the new agent's
    // events. Reset effective since to 0 so the response backfills the new
    // agent's full buffered history in one round-trip.
    const effectiveSince =
      clientGeneration !== undefined && clientGeneration !== this._generation ? 0 : sinceSeq;
    const events = this._events.filter((e) => e.seq > effectiveSince);
    const latest = this._nextSeq - 1;
    const oldestSeq = this._events.length > 0 ? this._events[0].seq : 0;
    return { events, latest, oldestSeq, generation: this._generation };
  }

  /**
   * Drop all buffered events and reset seq numbering. Called at agent-exit so
   * the next agent's stream starts clean. Increments `_generation` so SPAs
   * know to drop their `since` cursor — relying on `since` alone breaks
   * because a parked SPA at `since=87` filters out everything until the new
   * agent emits its 88th event.
   */
  public reset(): void {
    this._events = [];
    this._nextSeq = 1;
    this._generation += 1;
  }
}
