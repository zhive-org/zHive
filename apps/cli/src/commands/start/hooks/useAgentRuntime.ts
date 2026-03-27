import { useCallback, useState, useEffect } from 'react';
import { AgentRuntime, initializeAgentRuntime } from '../../../shared/agent/runtime';

export const useAgentRuntime = () => {
  const [runtime, setAgentRuntime] = useState<AgentRuntime | undefined>();

  const reloadRuntime = useCallback(async (): Promise<void> => {
    const runtime = await initializeAgentRuntime();
    setAgentRuntime(runtime);
  }, []);

  useEffect(() => {
    reloadRuntime();
  }, [reloadRuntime]);

  return { runtime, reloadRuntime };
};
