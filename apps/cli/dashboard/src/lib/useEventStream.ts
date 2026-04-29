import { useEffect, useReducer, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchEvents } from './api';
import type { WebEvent } from './types';

const MAX_EVENTS = 500;

interface EventsState {
  events: WebEvent[];
}

type EventsAction = { type: 'append'; events: WebEvent[] };

function applyClearChat(events: WebEvent[]): WebEvent[] {
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

function reducer(state: EventsState, action: EventsAction): EventsState {
  switch (action.type) {
    case 'append': {
      let merged = [...state.events, ...action.events];
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
  const [state, dispatch] = useReducer(reducer, { events: [] });
  const sinceRef = useRef(0);

  const query = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const result = await fetchEvents(sinceRef.current);
      sinceRef.current = result.latest;
      return result;
    },
    refetchInterval: 1000,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  useEffect(() => {
    if (query.data && query.data.events.length > 0) {
      dispatch({ type: 'append', events: query.data.events });
    }
  }, [query.data]);

  return {
    events: state.events,
    isError: query.isError,
    isPending: query.isPending,
  };
}
