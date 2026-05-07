import { useQuery } from '@tanstack/react-query';
import { AgentPicker } from './components/AgentPicker';
import { Dashboard } from './components/Dashboard';
import { fetchApiState } from './lib/api';

export function App() {
  const stateQuery = useQuery({
    queryKey: ['state'],
    queryFn: fetchApiState,
    // While we're in the picker → ready handoff (and the server briefly
    // restarts on the same port), poll fast so we hop into the dashboard
    // as soon as the runtime server is up. Once we're 'ready' we fall back
    // to the original 30s cadence.
    refetchInterval: (query) => (query.state.data?.phase === 'ready' ? 30_000 : 1_000),
    staleTime: (query) => (query.state.data?.phase === 'ready' ? 30_000 : 0),
    retry: true,
    retryDelay: 500,
  });

  const data = stateQuery.data;

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

  return <Dashboard state={data} connected={!stateQuery.isError} />;
}
