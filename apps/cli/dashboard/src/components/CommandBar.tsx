import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { postChat, postCommand } from '../lib/api';

const SLASH_COMMANDS = ['/skills', '/clear', '/positions', '/memory', '/watchlist', '/help'];

export function CommandBar() {
  const [text, setText] = useState('');
  const queryClient = useQueryClient();

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
    <div className="border-t border-hive-border bg-hive-near-black px-6 py-3">
      {error && <div className="mb-2 font-mono text-xs text-hive-bearish">{error}</div>}
      {matches.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2 text-xs">
          {matches.map((cmd) => (
            <button
              key={cmd}
              type="button"
              onClick={() => setText(cmd)}
              className="border border-hive-border bg-hive-black px-2 py-0.5 font-mono text-hive-text-secondary transition-colors hover:border-hive-honey hover:text-hive-honey"
            >
              {cmd}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={submit} className="flex items-center gap-3">
        <span className="font-mono text-sm text-hive-text-dim select-none">
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
  );
}
