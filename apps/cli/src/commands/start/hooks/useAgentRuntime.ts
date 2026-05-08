import { useCallback, useState } from 'react';
import { AgentRuntime, initializeAgentRuntime } from '../../../shared/agent/runtime';

export interface UseAgentRuntime {
  runtime: AgentRuntime | undefined;
  /** Reload the *current* agent's runtime in place (after a config edit, etc).
   * No-op when no agent is selected. */
  reloadRuntime: () => Promise<void>;
  /** Replace the active runtime. Pass `undefined` to clear (used by exitAgent). */
  setRuntime: (runtime: AgentRuntime | undefined) => void;
}

export const useAgentRuntime = (): UseAgentRuntime => {
  const [runtime, setRuntime] = useState<AgentRuntime | undefined>();

  const reloadRuntime = useCallback(async (): Promise<void> => {
    const next = await initializeAgentRuntime();
    setRuntime(next);
  }, []);

  return { runtime, reloadRuntime, setRuntime };
};
