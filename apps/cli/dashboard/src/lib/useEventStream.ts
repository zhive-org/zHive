import { useEffect, useReducer, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchEvents } from './api';
import type { WebEvent } from './types';

const MAX_EVENTS = 500;

export interface EventsState {
  events: WebEvent[];
}

export type EventsAction =
  | { type: 'append'; events: WebEvent[] }
  | { type: 'reset'; events: WebEvent[] };

export function applyClearChat(events: WebEvent[]): WebEvent[] {
  let cutoff = -1;
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === 'system' && e.kind === 'clear-chat') {
      cutoff = e.seq;
      break;
    }
  }
  if (cutoff === -1) return events;
  return events.filter((e) => e.type !== 'chat' || e.seq > cutoff);
}

export function dedupeBySeq(events: WebEvent[]): WebEvent[] {
  const seen = new Set<number>();
  const out: WebEvent[] = [];
  for (const e of events) {
    if (seen.has(e.seq)) continue;
    seen.add(e.seq);
    out.push(e);
  }
  return out;
}

export function eventsReducer(state: EventsState, action: EventsAction): EventsState {
  switch (action.type) {
    case 'reset': {
      let merged = applyClearChat(dedupeBySeq(action.events));
      if (merged.length > MAX_EVENTS) merged = merged.slice(-MAX_EVENTS);
      return { events: merged };
    }
    case 'append': {
      if (action.events.length === 0) return state;
      let merged = dedupeBySeq([...state.events, ...action.events]);
      merged = applyClearChat(merged);
      if (merged.length > MAX_EVENTS) merged = merged.slice(-MAX_EVENTS);
      return { events: merged };
    }
  }
}

export interface EventStream {
  events: WebEvent[];
  isError: boolean;
  isPending: boolean;
}

export function useEventStream(): EventStream {
  const [state, dispatch] = useReducer(eventsReducer, { events: [] });
  const sinceRef = useRef(0);
  // Identity check so a doubly-invoked StrictMode effect doesn't re-append
  // the same poll's events.
  const lastDataRef = useRef<unknown>(null);
  // Highest latest-seq we've already processed. Used to detect a capacity-drop
  // gap by comparing against the next poll's oldestSeq.
  const prevLatestRef = useRef(0);
  // Last server bus generation we saw. A bump means the bus reset (agent
  // boundary) and our `since` cursor is now meaningless.
  const generationRef = useRef(0);

  const query = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      // Send the generation we last saw so the server can backfill from 0
      // when our cursor's seq space is stale (agent boundary). undefined on
      // first poll so the server's behavior is unchanged for fresh clients.
      const lastGen = generationRef.current === 0 ? undefined : generationRef.current;
      const result = await fetchEvents(sinceRef.current, lastGen);
      sinceRef.current = result.latest;
      return result;
    },
    refetchInterval: 1000,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  useEffect(() => {
    const data = query.data;
    if (!data || data === lastDataRef.current) return;
    lastDataRef.current = data;

    // Generation bump: server reset its bus (agent boundary). Our cursor
    // points past the new agent's seq numbering and would silently filter
    // its events. Drop it and rebuild from this poll's events.
    const generationChanged =
      generationRef.current !== 0 && data.generation !== generationRef.current;
    generationRef.current = data.generation;

    // Capacity-drop gap: the bus's oldestSeq leapfrogged the last latest we
    // saw, meaning events were silently evicted. Reset to the freshly received
    // events so the dashboard doesn't carry forward stale state (e.g. a
    // dropped clear-chat could leave old chats visible forever).
    const droppedGap =
      data.oldestSeq > 0 && prevLatestRef.current > 0 && data.oldestSeq > prevLatestRef.current + 1;
    prevLatestRef.current = data.latest;

    if (generationChanged) {
      // Server seq has restarted at 1; our cursor was already updated to
      // data.latest in queryFn, so subsequent polls are correct.
      dispatch({ type: 'reset', events: data.events });
      return;
    }
    if (droppedGap) {
      dispatch({ type: 'reset', events: data.events });
      return;
    }
    if (data.events.length > 0) {
      dispatch({ type: 'append', events: data.events });
    }
  }, [query.data]);

  return {
    events: state.events,
    isError: query.isError,
    isPending: query.isPending,
  };
}
