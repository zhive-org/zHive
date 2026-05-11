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
    () =>
      events.filter(
        (e) => e.type !== 'chat' && e.type !== 'system' && e.type !== 'analyzing',
      ),
    [events],
  );

  // Derive thinking state from the latest analyzing event. The LLM call can
  // take a long time and the activity feed otherwise looks frozen — this
  // tells the user the agent is alive and working.
  const analyzing = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.type === 'analyzing') {
        return e.state === 'started' ? { assetCount: e.assetCount } : null;
      }
    }
    return null;
  }, [events]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < 200) {
      el.scrollTop = el.scrollHeight;
    }
  }, [visible.length, analyzing]);

  return (
    // Designed to fit any flex/fixed-height parent — height comes from the
    // container (e.g. the docked panel in Dashboard.tsx).
    <section className="flex h-full min-h-0 flex-col border border-hive-border bg-hive-near-black">
      <div className="flex shrink-0 items-center justify-between border-b border-hive-border px-4 py-2">
        <h2 className="font-mono text-xs font-medium uppercase tracking-wider text-hive-text-secondary">
          Activity
        </h2>
        <div className="flex items-center gap-3">
          {analyzing && <ThinkingBadge assetCount={analyzing.assetCount} />}
          <span className="font-mono text-xs text-hive-text-dim">{visible.length} events</span>
        </div>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4 font-mono text-sm">
        {visible.length === 0 && !analyzing && (
          <p className="text-hive-text-dim">Waiting for the agent to come online…</p>
        )}
        {visible.map((e) => (
          <ActivityRow key={e.seq} event={e} />
        ))}
        {analyzing && <ThinkingRow assetCount={analyzing.assetCount} />}
      </div>
    </section>
  );
}

function ThinkingBadge({ assetCount }: { assetCount?: number }) {
  return (
    <span className="flex items-center gap-1.5 border border-hive-honey/40 bg-hive-honey-dim px-2 py-0.5 font-mono text-xs text-hive-honey">
      <span className="relative inline-flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-hive-honey opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-hive-honey" />
      </span>
      analyzing{assetCount ? ` ${assetCount}` : ''}
    </span>
  );
}

function ThinkingRow({ assetCount }: { assetCount?: number }) {
  return (
    <div className="mt-1 flex items-center gap-2 leading-relaxed text-hive-honey">
      <span className="text-hive-text-dim">···</span>
      <span className="font-semibold">thinking</span>
      <span className="inline-flex items-end gap-0.5" aria-hidden>
        <span className="h-1 w-1 animate-bounce rounded-full bg-hive-honey [animation-delay:-0.3s]" />
        <span className="h-1 w-1 animate-bounce rounded-full bg-hive-honey [animation-delay:-0.15s]" />
        <span className="h-1 w-1 animate-bounce rounded-full bg-hive-honey" />
      </span>
      {assetCount && (
        <span className="text-hive-text-secondary">
          evaluating {assetCount} {assetCount === 1 ? 'asset' : 'assets'}…
        </span>
      )}
    </div>
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
