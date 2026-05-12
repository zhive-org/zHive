import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AgentPicker } from './components/AgentPicker';
import { Dashboard } from './components/Dashboard';
import { SettingsView } from './components/SettingsView';
import { fetchApiState } from './lib/api';
import { resetAgentScopedClientState } from './lib/resetAgentScopedClientState';

export function App() {
  const queryClient = useQueryClient();
  // 'dashboard' | 'settings'. Only meaningful when phase === 'ready' — the
  // other phases force their own full-screen views (picker, splash). Reset
  // to 'dashboard' on every agent boundary so settings doesn't leak across
  // agents.
  const [view, setView] = useState<'dashboard' | 'settings'>('dashboard');
  const stateQuery = useQuery({
    queryKey: ['state'],
    queryFn: fetchApiState,
    // Picker → starting → ready: poll every second so the dashboard hops in
    // as soon as the runtime is ready. Once 'ready', drop to 5s — that's the
    // server-side POSITIONS_TTL_MS, so it's the fastest the data could
    // possibly change. The terminal layout shows positions front-and-center,
    // so a 30s cadence here meant a position could take half a minute to
    // appear after opening.
    refetchInterval: (query) => (query.state.data?.phase === 'ready' ? 5_000 : 1_000),
    staleTime: (query) => (query.state.data?.phase === 'ready' ? 5_000 : 0),
    retry: true,
    retryDelay: 500,
  });

  const data = stateQuery.data;

  // Detect transitions that warrant client-side state cleanup. Specifically:
  // ready → (selecting | starting) means the user exited an agent, so any
  // module-level state tied to that agent's symbols/prices must be dropped
  // before the next agent's session begins.
  const prevPhaseRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const phase = data?.phase;
    const prev = prevPhaseRef.current;
    if (prev === 'ready' && (phase === 'selecting' || phase === 'starting')) {
      resetAgentScopedClientState(queryClient);
      // Settings view doesn't survive an agent boundary — the form fields
      // would still hold agent A's values and silently overwrite agent B's
      // config on save.
      setView('dashboard');
    }
    prevPhaseRef.current = phase;
  }, [data?.phase, queryClient]);

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center bg-hive-black font-mono text-sm text-hive-text-secondary">
        {stateQuery.isError ? 'connection lost — retrying…' : 'connecting…'}
      </div>
    );
  }

  if (data.phase === 'selecting') {
    return <AgentPicker agents={data.agents} />;
  }

  if (data.phase === 'starting') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-hive-black font-mono text-sm text-hive-text-secondary">
        <span className="text-hive-honey">starting agent…</span>
        <span className="text-xs text-hive-text-dim">loading runtime, model, and positions</span>
      </div>
    );
  }

  if (view === 'settings') {
    return <SettingsView state={data} onClose={() => setView('dashboard')} />;
  }

  return (
    <Dashboard state={data} onOpenSettings={() => setView('settings')} />
  );
}
