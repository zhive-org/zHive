import { useCallback, useState } from 'react';
import { MegathreadResult, PollActivityItem } from './types.js';

const MAX_ITEM = 50;

export const usePollActivity = () => {
  const [pollActivityQueues, setPollActivityQueues] = useState<{
    active: PollActivityItem[];
    settled: PollActivityItem[];
  }>({
    active: [],
    settled: [],
  });

  // idle, online, error
  const addLog = useCallback(
    (item: Extract<PollActivityItem, { type: 'idle' | 'online' | 'error' }>) => {
      setPollActivityQueues((prev) => {
        const { active, settled } = prev;
        let updated = [...settled, item];
        if (updated.length > MAX_ITEM) {
          updated = updated.slice(updated.length - MAX_ITEM);
        }

        return { active, settled: updated };
      });
    },
    [setPollActivityQueues],
  );

  const addMegathreadActivity = useCallback(
    (item: Extract<PollActivityItem, { type: 'megathread'; status: 'analyzing' }>) => {
      setPollActivityQueues((prev) => {
        const { active, settled } = prev;
        let updated = [...active, item];
        return { active: updated, settled };
      });
    },
    [setPollActivityQueues],
  );

  const finalizeMegathreadActivity = useCallback(
    (roundId: string, updates: MegathreadResult) => {
      setPollActivityQueues(({ active, settled }) => {
        const idx = active.findIndex((item) => item.type === 'megathread' && item.id === roundId);
        if (idx === -1) return { active, settled };
        const tmp = active[idx];

        const updated = { ...tmp, ...updates };

        const updatedSettle = [...settled, updated];
        const updatedActive = [...active.slice(0, idx), ...active.slice(idx + 1)];

        return { active: updatedActive, settled: updatedSettle };
      });
    },
    [setPollActivityQueues],
  );

  return {
    activePollActivities: pollActivityQueues.active,
    settledPollActivities: pollActivityQueues.settled,
    addLog,
    addMegathreadActivity,
    finalizeMegathreadActivity,
  };
};
