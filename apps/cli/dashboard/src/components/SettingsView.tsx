import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAvailableTickers,
  updateAgentConfig,
  updateAgentSoul,
  updateAgentStrategy,
  updateAgentCredentials,
} from '../lib/api';
import type { AvailableTickers, WebState } from '../lib/types';

interface SettingsViewProps {
  state: WebState;
  onClose: () => void;
}

export function SettingsView({ state, onClose }: SettingsViewProps) {
  return (
    <div className="flex h-screen flex-col bg-hive-black">
      <header className="flex items-center justify-between border-b border-hive-border bg-hive-near-black px-6 py-4">
        <div className="flex items-baseline gap-3">
          <button
            type="button"
            onClick={onClose}
            className="self-center border border-hive-border bg-hive-black px-2 py-1 font-mono text-xs text-hive-text-secondary transition-colors hover:border-hive-honey hover:text-hive-honey"
          >
            ← back
          </button>
          <h1 className="text-lg font-bold tracking-tight">
            <span className="text-hive-honey">zHive</span>
            <span className="ml-1.5 text-hive-text-dim">·</span>
            <span className="ml-1.5 font-mono text-hive-text-primary">
              {state.agentName} settings
            </span>
          </h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          <WatchlistSection state={state} />
          <ProfileSection state={state} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <MarkdownSection
              title="SOUL.md — personality"
              initialContent={state.soulContent}
              onSave={updateAgentSoul}
            />
            <MarkdownSection
              title="STRATEGY.md — trading strategy"
              initialContent={state.strategyContent}
              onSave={updateAgentStrategy}
            />
          </div>
          <CredentialsSection state={state} />
        </div>
      </main>
    </div>
  );
}

// ─── Reusable bits ────────────────────────────────────

function SectionShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border border-hive-border bg-hive-near-black">
      <div className="border-b border-hive-border px-4 py-2">
        <h2 className="font-mono text-xs font-medium uppercase tracking-wider text-hive-text-secondary">
          {title}
        </h2>
      </div>
      <div className="flex flex-col gap-3 p-4">{children}</div>
    </section>
  );
}

function SaveButton({
  isPending,
  isError,
  errorMessage,
  isSuccess,
  disabled,
  onClick,
  label = 'save',
}: {
  isPending: boolean;
  isError: boolean;
  errorMessage?: string;
  isSuccess: boolean;
  disabled?: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={isPending || disabled}
        onClick={onClick}
        className="border border-hive-border bg-transparent px-3 py-1 font-mono text-xs uppercase tracking-wider text-hive-text-secondary transition-colors hover:border-hive-honey hover:text-hive-honey disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isPending ? 'saving…' : label}
      </button>
      {isSuccess && !isPending && (
        <span className="font-mono text-xs text-hive-bullish">saved</span>
      )}
      {isError && (
        <span className="font-mono text-xs text-hive-bearish">
          {errorMessage ?? 'save failed'}
        </span>
      )}
    </div>
  );
}

// ─── Watchlist ────────────────────────────────────────

interface TickerOption {
  value: string;
  category: 'crypto' | 'stock';
}

const MAX_SUGGESTIONS = 12;

function flattenTickers(tickers: AvailableTickers | undefined): TickerOption[] {
  if (!tickers) return [];
  return [
    ...tickers.crypto.map<TickerOption>((value) => ({ value, category: 'crypto' })),
    ...tickers.stockCommodity.map<TickerOption>((value) => ({ value, category: 'stock' })),
  ];
}

function filterTickers(
  options: TickerOption[],
  query: string,
  exclude: ReadonlySet<string>,
): TickerOption[] {
  const q = query.trim().toLowerCase();
  const matches: TickerOption[] = [];
  for (const opt of options) {
    if (exclude.has(opt.value)) continue;
    if (q.length === 0 || opt.value.toLowerCase().includes(q)) {
      matches.push(opt);
      if (matches.length >= MAX_SUGGESTIONS) break;
    }
  }
  return matches;
}

function WatchlistSection({ state }: { state: WebState }) {
  const queryClient = useQueryClient();
  const [coins, setCoins] = useState<string[]>(state.watchlist);
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const tickersQuery = useQuery({
    queryKey: ['tickers'],
    queryFn: fetchAvailableTickers,
    staleTime: 5 * 60_000,
  });

  const allOptions = useMemo(() => flattenTickers(tickersQuery.data), [tickersQuery.data]);
  const selectedSet = useMemo(() => new Set(coins), [coins]);
  const suggestions = useMemo(
    () => filterTickers(allOptions, draft, selectedSet),
    [allOptions, draft, selectedSet],
  );

  useEffect(() => {
    if (highlight >= suggestions.length) setHighlight(0);
  }, [suggestions.length, highlight]);

  // Close the dropdown on outside click so it doesn't linger over other
  // sections when the user moves on.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const mutation = useMutation({
    mutationFn: (next: string[]) => updateAgentConfig({ watchList: next }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['state'] });
    },
  });

  const addCoin = (value: string): void => {
    const trimmed = value.trim();
    if (!trimmed || selectedSet.has(trimmed)) return;
    setCoins([...coins, trimmed]);
    setDraft('');
    setOpen(false);
    setHighlight(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => (suggestions.length === 0 ? 0 : (h + 1) % suggestions.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) =>
        suggestions.length === 0 ? 0 : (h - 1 + suggestions.length) % suggestions.length,
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = suggestions[highlight];
      if (pick) addCoin(pick.value);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const tickersError = tickersQuery.error instanceof Error ? tickersQuery.error.message : null;

  return (
    <SectionShell title="watchlist">
      <div className="flex flex-wrap gap-2">
        {coins.length === 0 ? (
          <span className="font-mono text-xs text-hive-text-dim">empty — add a coin below</span>
        ) : (
          coins.map((coin) => (
            <span
              key={coin}
              className="flex items-center gap-2 border border-hive-border bg-hive-black px-2 py-0.5 font-mono text-xs text-hive-text-secondary"
            >
              {coin}
              <button
                type="button"
                onClick={() => setCoins(coins.filter((c) => c !== coin))}
                aria-label={`remove ${coin}`}
                className="text-hive-text-dim hover:text-hive-bearish"
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>
      <div ref={containerRef} className="relative">
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setOpen(true);
            setHighlight(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={
            tickersQuery.isLoading
              ? 'loading tickers…'
              : 'search ticker (e.g. BTC, xyz:TSLA)'
          }
          className="w-full border border-hive-border bg-hive-black px-2 py-1 font-mono text-xs text-hive-text-primary placeholder:text-hive-text-dim focus:border-hive-honey focus:outline-none"
        />
        {open && !tickersQuery.isLoading && (
          <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto border border-hive-border bg-hive-near-black font-mono text-xs shadow-lg">
            {tickersError ? (
              <div className="px-2 py-2 text-hive-bearish">{tickersError}</div>
            ) : suggestions.length === 0 ? (
              <div className="px-2 py-2 text-hive-text-dim">no matching tickers</div>
            ) : (
              suggestions.map((opt, idx) => (
                <button
                  key={opt.value}
                  type="button"
                  onMouseDown={(e) => {
                    // Prevent the input blur from firing before our click
                    // handler — otherwise the dropdown closes and the click
                    // lands on whatever's behind it.
                    e.preventDefault();
                  }}
                  onClick={() => addCoin(opt.value)}
                  onMouseEnter={() => setHighlight(idx)}
                  className={`flex w-full items-center justify-between px-2 py-1 text-left ${
                    idx === highlight
                      ? 'bg-hive-honey-dim text-hive-honey'
                      : 'text-hive-text-primary hover:bg-hive-black'
                  }`}
                >
                  <span>{opt.value}</span>
                  <span className="text-hive-text-dim">{opt.category}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
      <SaveButton
        isPending={mutation.isPending}
        isError={mutation.isError}
        errorMessage={mutation.error instanceof Error ? mutation.error.message : undefined}
        isSuccess={mutation.isSuccess}
        onClick={() => mutation.mutate(coins)}
      />
    </SectionShell>
  );
}

// ─── Profile (bio) ─────────────────────────────────────

function ProfileSection({ state }: { state: WebState }) {
  const queryClient = useQueryClient();
  const [bio, setBio] = useState(state.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(state.avatarUrl ?? '');
  const [avatarBroken, setAvatarBroken] = useState(false);

  const mutation = useMutation({
    mutationFn: () => updateAgentConfig({ bio, avatarUrl }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['state'] });
      void queryClient.invalidateQueries({ queryKey: ['agent-profile'] });
    },
  });

  const trimmedUrl = avatarUrl.trim();
  const showPreview = trimmedUrl.length > 0 && !avatarBroken;

  return (
    <SectionShell title="profile">
      <label className="flex flex-col gap-1 font-mono text-xs">
        <span className="uppercase tracking-wider text-hive-text-dim">bio</span>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          className="border border-hive-border bg-hive-black p-2 text-hive-text-primary focus:border-hive-honey focus:outline-none"
        />
      </label>

      <div className="flex items-start gap-3 font-mono text-xs">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden border border-hive-border bg-hive-black">
          {showPreview ? (
            <img
              src={trimmedUrl}
              alt="avatar preview"
              className="h-full w-full object-cover"
              onError={() => setAvatarBroken(true)}
            />
          ) : (
            <span className="text-hive-text-dim">—</span>
          )}
        </div>
        <label className="flex flex-1 flex-col gap-1">
          <span className="uppercase tracking-wider text-hive-text-dim">avatar url</span>
          <input
            type="url"
            value={avatarUrl}
            onChange={(e) => {
              setAvatarUrl(e.target.value);
              setAvatarBroken(false);
            }}
            placeholder="https://example.com/avatar.png"
            className="border border-hive-border bg-hive-black px-2 py-1 text-hive-text-primary placeholder:text-hive-text-dim focus:border-hive-honey focus:outline-none"
          />
          {trimmedUrl.length > 0 && avatarBroken && (
            <span className="text-hive-bearish">couldn't load image</span>
          )}
        </label>
      </div>

      <SaveButton
        isPending={mutation.isPending}
        isError={mutation.isError}
        errorMessage={mutation.error instanceof Error ? mutation.error.message : undefined}
        isSuccess={mutation.isSuccess}
        onClick={() => mutation.mutate()}
      />
    </SectionShell>
  );
}

// ─── SOUL.md / STRATEGY.md ────────────────────────────

function MarkdownSection({
  title,
  initialContent,
  onSave,
}: {
  title: string;
  initialContent: string;
  onSave: (content: string) => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState(initialContent);
  const mutation = useMutation({
    mutationFn: () => onSave(content),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['state'] });
    },
  });

  return (
    <SectionShell title={title}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={16}
        spellCheck={false}
        className="border border-hive-border bg-hive-black p-2 font-mono text-xs leading-relaxed text-hive-text-primary focus:border-hive-honey focus:outline-none"
      />
      <SaveButton
        isPending={mutation.isPending}
        isError={mutation.isError}
        errorMessage={mutation.error instanceof Error ? mutation.error.message : undefined}
        isSuccess={mutation.isSuccess}
        disabled={content === initialContent}
        onClick={() => mutation.mutate()}
      />
    </SectionShell>
  );
}

// ─── Credentials ──────────────────────────────────────

function CredentialsSection({ state }: { state: WebState }) {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState('');
  const [providerEnvVar, setProviderEnvVar] = useState(state.providerEnvVar ?? '');
  const [providerKey, setProviderKey] = useState('');
  const [confirming, setConfirming] = useState(false);

  const mutation = useMutation({
    mutationFn: () => {
      const args: { apiKey?: string; providerEnvVar?: string; providerKey?: string } = {};
      if (apiKey) args.apiKey = apiKey;
      if (providerEnvVar && providerKey) {
        args.providerEnvVar = providerEnvVar;
        args.providerKey = providerKey;
      }
      return updateAgentCredentials(args);
    },
    onSuccess: () => {
      setApiKey('');
      setProviderKey('');
      setConfirming(false);
      void queryClient.invalidateQueries({ queryKey: ['state'] });
    },
    onError: () => {
      setConfirming(false);
    },
  });

  const hasChanges = apiKey.length > 0 || (providerEnvVar.length > 0 && providerKey.length > 0);

  return (
    <SectionShell title="credentials (sensitive — values are never echoed back)">
      <p className="font-mono text-xs text-hive-text-dim">
        Current provider:{' '}
        <span className="text-hive-text-primary">{state.providerEnvVar ?? '(shell-inherited)'}</span>
      </p>

      <label className="flex flex-col gap-1 font-mono text-xs">
        <span className="uppercase tracking-wider text-hive-text-dim">
          zHive agent api key (rotate)
        </span>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="leave blank to keep current"
          autoComplete="off"
          className="border border-hive-border bg-hive-black px-2 py-1 text-hive-text-primary placeholder:text-hive-text-dim focus:border-hive-honey focus:outline-none"
        />
      </label>

      <div className="flex flex-col gap-1 font-mono text-xs">
        <span className="uppercase tracking-wider text-hive-text-dim">ai provider key</span>
        <div className="flex gap-2">
          <input
            value={providerEnvVar}
            onChange={(e) => setProviderEnvVar(e.target.value.toUpperCase())}
            placeholder="ENV_VAR_NAME"
            autoComplete="off"
            className="w-56 border border-hive-border bg-hive-black px-2 py-1 text-hive-text-primary placeholder:text-hive-text-dim focus:border-hive-honey focus:outline-none"
          />
          <input
            type="password"
            value={providerKey}
            onChange={(e) => setProviderKey(e.target.value)}
            placeholder="key value"
            autoComplete="off"
            className="flex-1 border border-hive-border bg-hive-black px-2 py-1 text-hive-text-primary placeholder:text-hive-text-dim focus:border-hive-honey focus:outline-none"
          />
        </div>
      </div>

      {!confirming ? (
        <SaveButton
          isPending={mutation.isPending}
          isError={mutation.isError}
          errorMessage={mutation.error instanceof Error ? mutation.error.message : undefined}
          isSuccess={mutation.isSuccess}
          disabled={!hasChanges}
          onClick={() => setConfirming(true)}
          label="rotate"
        />
      ) : (
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-hive-text-secondary">
            confirm: rotate credentials? this writes to disk.
          </span>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="border border-hive-honey bg-hive-honey-dim px-3 py-1 font-mono text-xs uppercase tracking-wider text-hive-honey transition-colors hover:bg-hive-honey hover:text-hive-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            {mutation.isPending ? 'rotating…' : 'yes, rotate'}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={mutation.isPending}
            className="border border-hive-border bg-transparent px-3 py-1 font-mono text-xs uppercase tracking-wider text-hive-text-secondary transition-colors hover:border-hive-text-secondary disabled:cursor-not-allowed disabled:opacity-40"
          >
            cancel
          </button>
        </div>
      )}
    </SectionShell>
  );
}
