import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { selectAgent } from '../lib/api';
import type { PickerAgentSummary } from '../lib/types';

interface AgentPickerProps {
  agents: PickerAgentSummary[];
}

function formatCreated(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function AgentPicker({ agents }: AgentPickerProps) {
  const [pendingName, setPendingName] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: selectAgent,
    onMutate: (name) => setPendingName(name),
    onError: () => setPendingName(null),
  });

  const sorted = [...agents].sort(
    (a, b) => new Date(a.created).getTime() - new Date(b.created).getTime(),
  );

  return (
    <div className="flex h-screen flex-col bg-hive-black">
      <header className="border-b border-hive-border bg-hive-near-black px-6 py-4">
        <h1 className="text-lg font-bold tracking-tight">
          <span className="text-hive-honey">zHive</span>
          <span className="ml-1.5 text-hive-text-dim">·</span>
          <span className="ml-1.5 font-mono text-hive-text-primary">select agent</span>
        </h1>
      </header>

      <main className="flex flex-1 items-start justify-center overflow-y-auto p-6">
        <div className="w-full max-w-2xl">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-mono text-xs font-medium uppercase tracking-wider text-hive-text-secondary">
              {agents.length} {agents.length === 1 ? 'agent' : 'agents'}
            </h2>
            <span className="font-mono text-xs text-hive-text-dim">
              click an agent to start
            </span>
          </div>

          {agents.length === 0 ? (
            <div className="border border-hive-border bg-hive-near-black p-6 text-center font-mono text-sm text-hive-text-secondary">
              No agents found. Create one with{' '}
              <code className="text-hive-honey">npx @zhive/cli@latest create</code>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {sorted.map((agent) => {
                const isPending = pendingName === agent.name;
                const isDisabled = mutation.isPending;
                return (
                  <li key={agent.name}>
                    <button
                      type="button"
                      disabled={isDisabled}
                      onClick={() => mutation.mutate(agent.name)}
                      className="group flex w-full items-center justify-between border border-hive-border bg-hive-near-black px-4 py-3 text-left transition-colors hover:border-hive-honey hover:bg-hive-honey-dim disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="font-mono text-sm font-medium text-hive-text-primary group-hover:text-hive-honey">
                          {agent.name}
                        </span>
                        {agent.bio && (
                          <span className="mt-1 truncate font-mono text-xs text-hive-text-dim">
                            {agent.bio}
                          </span>
                        )}
                      </div>
                      <div className="ml-4 flex shrink-0 items-center gap-3">
                        <span className="font-mono text-xs text-hive-text-dim">
                          {formatCreated(agent.created)}
                        </span>
                        {isPending && (
                          <span className="font-mono text-xs text-hive-honey">starting…</span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {mutation.isError && (
            <div className="mt-4 border border-hive-bearish bg-hive-near-black p-3 font-mono text-xs text-hive-bearish">
              {mutation.error instanceof Error
                ? mutation.error.message
                : 'failed to select agent'}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
