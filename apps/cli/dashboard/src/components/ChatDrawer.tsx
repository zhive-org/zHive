import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postChat, postCommand } from '../lib/api';
import { HexAvatar } from './primitives/HexAvatar';
import type { WebEvent } from '../lib/types';

interface ChatDrawerProps {
  events: WebEvent[];
  agentName: string | undefined;
}

const SLASH_COMMANDS = ['/skills', '/clear', '/positions', '/memory', '/watchlist', '/help'];

const ROLE_LABEL: Record<string, { label: string; color: string }> = {
  user: { label: 'you ›', color: 'text-hive-text-primary' },
  agent: { label: '', color: 'text-hive-honey' },
  error: { label: '⚠', color: 'text-hive-bearish' },
  tool: { label: '⚙', color: 'text-hive-text-dim' },
};

type ChatEvent = Extract<WebEvent, { type: 'chat' }>;

export function ChatDrawer({ events, agentName }: ChatDrawerProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = useMemo<ChatEvent[]>(
    () => events.filter((e): e is ChatEvent => e.type === 'chat'),
    [events],
  );

  const last = messages[messages.length - 1];

  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [open, messages.length]);

  const command = useMutation({
    mutationFn: postCommand,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['state'] });
    },
  });
  const chat = useMutation({ mutationFn: postChat });

  const isSlash = text.trim().startsWith('/');
  const showSuggestions = isSlash && text.trim().length > 0 && !text.includes(' ');
  const matches = showSuggestions
    ? SLASH_COMMANDS.filter((cmd) => cmd.startsWith(text.trim().toLowerCase()))
    : [];

  const isPending = command.isPending || chat.isPending;
  const error = command.error?.message ?? chat.error?.message ?? null;

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    if (trimmed.startsWith('/')) {
      const name = trimmed.split(/\s+/)[0];
      await command.mutateAsync(name);
    } else {
      await chat.mutateAsync(trimmed);
    }
    setText('');
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4">
      <div className="pointer-events-auto w-full max-w-[1400px] border border-b-0 border-hive-border bg-hive-near-black transition-all duration-300">
        {/* Drawer handle / toggle */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-4 border-b border-hive-border px-4 py-2.5 transition-colors hover:bg-hive-black"
        >
          <div className="flex items-center gap-3">
            <HexAvatar
              initial={(agentName ?? 'h').slice(0, 1).toLowerCase()}
              size={22}
              pulse={!open}
            />
            <span className="font-mono text-xs uppercase tracking-[0.22em] text-hive-text-secondary">
              chat with {agentName ?? 'agent'}
            </span>
            {!open && last && (
              <span className="hidden font-mono text-xs text-hive-text-dim md:inline">
                — {last.text.slice(0, 60)}
                {last.text.length > 60 ? '…' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-hive-text-dim">
              {open ? 'collapse ↓' : 'expand ↑'}
            </span>
          </div>
        </button>

        {open && (
          <div className="flex flex-col">
            <div
              ref={scrollRef}
              className="max-h-[260px] min-h-[180px] overflow-y-auto px-5 py-4 font-mono text-sm"
            >
              {messages.length === 0 && (
                <p className="text-hive-text-dim">No messages yet. Start typing below.</p>
              )}
              {messages.map((m) => {
                const style = ROLE_LABEL[m.role] ?? ROLE_LABEL.agent;
                const labelText =
                  style.label || (m.role === 'agent' ? `${agentName ?? 'agent'} ›` : '');
                return (
                  <div key={m.seq} className="mb-3 last:mb-0">
                    {labelText && (
                      <span className={`mr-2 font-semibold ${style.color}`}>{labelText}</span>
                    )}
                    <span
                      className={`whitespace-pre-wrap ${
                        m.role === 'user'
                          ? 'text-hive-text-primary'
                          : m.role === 'agent'
                            ? 'text-hive-text-secondary'
                            : style.color
                      }`}
                    >
                      {m.text}
                    </span>
                  </div>
                );
              })}
            </div>

            {error && (
              <div className="border-t border-hive-border px-5 py-2 font-mono text-xs text-hive-bearish">
                {error}
              </div>
            )}
            {matches.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-hive-border bg-hive-black px-5 py-2 text-xs">
                {matches.map((cmd) => (
                  <button
                    key={cmd}
                    type="button"
                    onClick={() => setText(cmd)}
                    className="border border-hive-border bg-hive-near-black px-2 py-0.5 font-mono text-hive-text-secondary transition-colors hover:border-hive-honey hover:text-hive-honey"
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            )}
            <form
              onSubmit={submit}
              className="flex items-center gap-3 border-t border-hive-border bg-hive-black px-5 py-3"
            >
              <span className="select-none font-mono text-sm text-hive-text-dim">
                {isSlash ? 'cmd' : 'chat'} ›
              </span>
              <input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  isSlash
                    ? 'slash command (try /help)'
                    : 'message the agent, or start with / for a command'
                }
                disabled={isPending}
                className="flex-1 bg-transparent font-mono text-sm text-hive-text-primary placeholder:text-hive-text-dim focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isPending || !text.trim()}
                className="border border-hive-border bg-transparent px-3 py-1 font-mono text-xs uppercase tracking-wider text-hive-text-secondary transition-colors hover:border-hive-honey hover:text-hive-honey disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isPending ? 'sending…' : isSlash ? 'run' : 'send'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
