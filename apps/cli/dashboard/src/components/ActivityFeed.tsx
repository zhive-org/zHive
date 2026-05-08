import { useEffect, useMemo, useRef } from 'react';
import { formatTime, formatUsd } from '../lib/format';
import type { WebEvent } from '../lib/types';

interface ActivityFeedProps {
  events: WebEvent[];
}

const ACTION_COLOR: Record<string, string> = {
  LONG: 'text-hive-bullish',
  SHORT: 'text-hive-bearish',
  CLOSE: 'text-hive-honey',
  HOLD: 'text-hive-text-secondary',
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
    <section className="flex min-h-0 flex-1 flex-col border border-hive-border bg-hive-near-black">
      <div className="flex shrink-0 items-center justify-between border-b border-hive-border px-4 py-2">
        <h2 className="font-mono text-xs font-medium uppercase tracking-wider text-hive-text-secondary">
          Activity
        </h2>
        <span className="font-mono text-xs text-hive-text-dim">{visible.length} events</span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 font-mono text-sm">
        {visible.length === 0 && (
          <p className="text-hive-text-dim">Waiting for the agent to come online…</p>
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
  const stamp = <span className="mr-3 text-hive-text-dim">{time}</span>;

  switch (event.type) {
    case 'message':
      return (
        <div className="leading-relaxed">
          {stamp}
          <span className="text-hive-white">{event.text}</span>
        </div>
      );
    case 'error':
      return (
        <div className="leading-relaxed">
          {stamp}
          <span className="text-hive-bearish">⚠ {event.errorMessage}</span>
        </div>
      );
    case 'online':
      return (
        <div className="leading-relaxed">
          {stamp}
          <span className="text-hive-bullish">● {event.name} online</span>
          {event.bio && <span className="ml-2 text-hive-text-secondary">— {event.bio}</span>}
        </div>
      );
    case 'decision': {
      const color = ACTION_COLOR[event.action] ?? 'text-hive-white';
      const size = event.sizeUsd !== undefined ? ` ${formatUsd(event.sizeUsd)}` : '';
      return (
        <div className="leading-relaxed">
          {stamp}
          <span className={`font-semibold ${color}`}>{event.action}</span>
          <span className="ml-2 text-hive-text-primary">{event.asset}</span>
          <span className="text-hive-text-dim">{size}</span>
          <div className="ml-[6.5rem] mt-0.5 text-hive-text-secondary">{event.reasoning}</div>
        </div>
      );
    }
    default:
      return null;
  }
}
