import { useEffect, useMemo, useRef } from 'react';
import type { WebEvent } from '../lib/types';

interface ChatPanelProps {
  events: WebEvent[];
  agentName: string | undefined;
}

const ROLE_STYLES: Record<string, { label: string; color: string }> = {
  user: { label: 'you', color: 'text-hive-text-primary' },
  agent: { label: '', color: 'text-hive-honey' },
  error: { label: '⚠', color: 'text-hive-bearish' },
  tool: { label: '⚙', color: 'text-hive-text-dim' },
};

export function ChatPanel({ events, agentName }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const visible = useMemo(
    () => events.filter((e): e is Extract<WebEvent, { type: 'chat' }> => e.type === 'chat'),
    [events],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [visible.length]);

  return (
    <section className="flex h-48 shrink-0 flex-col border border-hive-border bg-hive-near-black">
      <div className="border-b border-hive-border px-4 py-2">
        <h2 className="font-mono text-xs font-medium uppercase tracking-wider text-hive-text-secondary">
          Chat{agentName ? ` with ${agentName}` : ''}
        </h2>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 font-mono text-sm">
        {visible.length === 0 && (
          <p className="text-hive-text-dim">No messages yet. Start typing below.</p>
        )}
        {visible.map((event) => {
          const style = ROLE_STYLES[event.role] ?? ROLE_STYLES.agent;
          const labelText = style.label || (event.role === 'agent' ? `${agentName ?? 'agent'}:` : '');
          return (
            <div key={event.seq} className="mb-2 last:mb-0">
              {labelText && (
                <span className={`mr-2 font-semibold ${style.color}`}>{labelText}</span>
              )}
              <span className={`whitespace-pre-wrap ${style.color}`}>{event.text}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
