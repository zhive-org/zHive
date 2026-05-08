import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  updateAgentConfig,
  updateAgentSoul,
  updateAgentStrategy,
  updateAgentCredentials,
} from '../lib/api';
import type {
  AgentTimeframe,
  Sentiment,
  WebState,
} from '../lib/types';

interface SettingsViewProps {
  state: WebState;
  onClose: () => void;
}

const SENTIMENTS: Sentiment[] = ['very-bullish', 'bullish', 'neutral', 'bearish', 'very-bearish'];
const TIMEFRAMES: AgentTimeframe[] = ['4h', '24h', '7d'];

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
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          <WatchlistSection state={state} />
          <ProfileSection state={state} />
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

function WatchlistSection({ state }: { state: WebState }) {
  const queryClient = useQueryClient();
  const [coins, setCoins] = useState<string[]>(state.watchlist);
  const [draft, setDraft] = useState('');
  const mutation = useMutation({
    mutationFn: (next: string[]) => updateAgentConfig({ watchList: next }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['state'] });
    },
  });

  const addCoin = (): void => {
    const trimmed = draft.trim();
    if (!trimmed || coins.includes(trimmed)) return;
    setCoins([...coins, trimmed]);
    setDraft('');
  };

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
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addCoin();
        }}
        className="flex items-center gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="add coin (e.g. BTC, xyz:TSLA)"
          className="flex-1 border border-hive-border bg-hive-black px-2 py-1 font-mono text-xs text-hive-text-primary placeholder:text-hive-text-dim focus:border-hive-honey focus:outline-none"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="border border-hive-border bg-transparent px-2 py-1 font-mono text-xs text-hive-text-secondary transition-colors hover:border-hive-honey hover:text-hive-honey disabled:cursor-not-allowed disabled:opacity-40"
        >
          add
        </button>
      </form>
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

// ─── Profile (bio, sectors, sentiment, timeframes) ────

function ProfileSection({ state }: { state: WebState }) {
  const queryClient = useQueryClient();
  const [bio, setBio] = useState(state.bio ?? '');
  const [sectors, setSectors] = useState<string[]>(state.sectors);
  const [sectorDraft, setSectorDraft] = useState('');
  const [sentiment, setSentiment] = useState<Sentiment>(state.sentiment);
  const [timeframes, setTimeframes] = useState<AgentTimeframe[]>(state.timeframes);

  const mutation = useMutation({
    mutationFn: () => updateAgentConfig({ bio, sectors, sentiment, timeframes }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['state'] });
      void queryClient.invalidateQueries({ queryKey: ['agent-profile'] });
    },
  });

  const toggleTimeframe = (tf: AgentTimeframe): void => {
    setTimeframes(
      timeframes.includes(tf) ? timeframes.filter((x) => x !== tf) : [...timeframes, tf],
    );
  };

  const addSector = (): void => {
    const trimmed = sectorDraft.trim();
    if (!trimmed || sectors.includes(trimmed)) return;
    setSectors([...sectors, trimmed]);
    setSectorDraft('');
  };

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

      <div className="flex flex-col gap-1 font-mono text-xs">
        <span className="uppercase tracking-wider text-hive-text-dim">sentiment</span>
        <div className="flex flex-wrap gap-2">
          {SENTIMENTS.map((s) => (
            <label key={s} className="flex items-center gap-1">
              <input
                type="radio"
                name="sentiment"
                checked={sentiment === s}
                onChange={() => setSentiment(s)}
                className="accent-hive-honey"
              />
              <span className="text-hive-text-secondary">{s}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1 font-mono text-xs">
        <span className="uppercase tracking-wider text-hive-text-dim">timeframes</span>
        <div className="flex flex-wrap gap-2">
          {TIMEFRAMES.map((tf) => (
            <label key={tf} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={timeframes.includes(tf)}
                onChange={() => toggleTimeframe(tf)}
                className="accent-hive-honey"
              />
              <span className="text-hive-text-secondary">{tf}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 font-mono text-xs">
        <span className="uppercase tracking-wider text-hive-text-dim">sectors</span>
        <div className="flex flex-wrap gap-2">
          {sectors.length === 0 ? (
            <span className="text-hive-text-dim">none</span>
          ) : (
            sectors.map((sector) => (
              <span
                key={sector}
                className="flex items-center gap-2 border border-hive-border bg-hive-black px-2 py-0.5 text-hive-text-secondary"
              >
                {sector}
                <button
                  type="button"
                  onClick={() => setSectors(sectors.filter((s) => s !== sector))}
                  aria-label={`remove ${sector}`}
                  className="text-hive-text-dim hover:text-hive-bearish"
                >
                  ×
                </button>
              </span>
            ))
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addSector();
          }}
          className="flex items-center gap-2"
        >
          <input
            value={sectorDraft}
            onChange={(e) => setSectorDraft(e.target.value)}
            placeholder="add sector (e.g. crypto, stock)"
            className="flex-1 border border-hive-border bg-hive-black px-2 py-1 text-hive-text-primary placeholder:text-hive-text-dim focus:border-hive-honey focus:outline-none"
          />
          <button
            type="submit"
            disabled={!sectorDraft.trim()}
            className="border border-hive-border bg-transparent px-2 py-1 text-hive-text-secondary transition-colors hover:border-hive-honey hover:text-hive-honey disabled:cursor-not-allowed disabled:opacity-40"
          >
            add
          </button>
        </form>
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
