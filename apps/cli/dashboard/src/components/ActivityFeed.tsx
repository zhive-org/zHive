import { useEffect, useMemo, useRef } from 'react';
import { formatTime, formatUsd } from '../lib/format';
import type { WebEvent } from '../lib/types';

interface ActivityFeedProps {
  events: WebEvent[];
}

const ACTION_COLOR: Record<string, string> = {
  LONG: 'text-emerald-400',
  SHORT: 'text-red-400',
  CLOSE: 'text-amber-400',
  HOLD: 'text-zinc-400',
};

export function ActivityFeed({ events }: ActivityFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const visible = useMemo(
    () => events.filter((e) => e.type !== 'chat' && e.type !== 'system'),
    [events],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 200) {
      el.scrollTop = el.scrollHeight;
    }
  }, [visible.length]);

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-400">Activity</h2>
        <span className="text-xs text-zinc-500">{visible.length} events</span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 font-mono text-sm">
        {visible.length === 0 && (
          <p className="text-zinc-500">Waiting for the agent to come online…</p>
        )}
        {visible.map((e) => (
          <ActivityRow key={e.seq} event={e} />
        ))}
      </div>
    </section>
  );
}

function ActivityRow({ event }: { event: WebEvent }) {
  const time = formatTime(event.timestamp);
  const stamp = <span className="mr-3 text-zinc-600">{time}</span>;

  switch (event.type) {
    case 'message':
      return (
        <div className="leading-relaxed">
          {stamp}
          <span className="text-zinc-300">{event.text}</span>
        </div>
      );
    case 'error':
      return (
        <div className="leading-relaxed">
          {stamp}
          <span className="text-red-400">⚠ {event.errorMessage}</span>
        </div>
      );
    case 'online':
      return (
        <div className="leading-relaxed">
          {stamp}
          <span className="text-emerald-400">● {event.name} online</span>
          {event.bio && <span className="ml-2 text-zinc-500">— {event.bio}</span>}
        </div>
      );
    case 'decision': {
      const color = ACTION_COLOR[event.action] ?? 'text-zinc-300';
      const size = event.sizeUsd !== undefined ? ` ${formatUsd(event.sizeUsd)}` : '';
      return (
        <div className="leading-relaxed">
          {stamp}
          <span className={`font-semibold ${color}`}>{event.action}</span>
          <span className="ml-2 text-zinc-100">{event.asset}</span>
          <span className="text-zinc-500">{size}</span>
          <div className="ml-[6.5rem] mt-0.5 text-zinc-500">{event.reasoning}</div>
        </div>
      );
    }
    default:
      return null;
  }
}
