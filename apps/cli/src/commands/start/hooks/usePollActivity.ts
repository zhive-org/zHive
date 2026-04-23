import { useCallback, useState } from 'react';
import { MegathreadResult, PollActivityItem } from './types';

const MAX_ITEM = 50;

export const usePollActivity = () => {
  const [pollActivityQueues, setPollActivityQueues] = useState<{
    active: PollActivityItem[];
    settled: PollActivityItem[];
  }>({
    active: [],
    settled: [],
  });

  // idle, online, error, decision
  const addLog = useCallback(
    (item: Extract<PollActivityItem, { type: 'message' | 'online' | 'error' | 'decision' }>) => {
      setPollActivityQueues((prev) => {
        const { active, settled } = prev;
        let updated = [...active, item];
        if (updated.length > MAX_ITEM) {
          updated = updated.slice(updated.length - MAX_ITEM);
        }

        return { active: updated, settled };
      });
    },
    [],
  );

  const addMegathreadActivity = useCallback(
    (item: Extract<PollActivityItem, { type: 'megathread'; status: 'analyzing' }>) => {
      setPollActivityQueues((prev) => {
        const { active, settled } = prev;
        let updated = [...active, item];
        if (updated.length > MAX_ITEM) {
          updated = updated.slice(updated.length - MAX_ITEM);
        }
        return { active: updated, settled };
      });
    },
    [],
  );

  const updateMegathreadActivity = useCallback(
    (roundId: string, updates: Partial<MegathreadResult>) => {
      setPollActivityQueues(({ active, settled }) => {
        const idx = active.findIndex((item) => item.type === 'megathread' && item.id === roundId);
        if (idx === -1) return { active, settled };
        const updated = { ...active[idx], ...updates } as PollActivityItem;
        const updatedActive = [...active.slice(0, idx), updated, ...active.slice(idx + 1)];
        return { active: updatedActive, settled };
      });
    },
    [],
  );

  const finalizeMegathreadActivity = useCallback((roundId: string, updates: MegathreadResult) => {
    setPollActivityQueues(({ active, settled }) => {
      const idx = active.findIndex((item) => item.type === 'megathread' && item.id === roundId);
      if (idx === -1) return { active, settled };
      const tmp = active[idx];

      const updated = { ...tmp, ...updates };

      const updatedSettle = [...settled, updated];
      const updatedActive = [...active.slice(0, idx), ...active.slice(idx + 1)];

      return { active: updatedActive, settled: updatedSettle };
    });
  }, []);

  return {
    activePollActivities: pollActivityQueues.active,
    settledPollActivities: pollActivityQueues.settled,
    addLog,
    addMegathreadActivity,
    updateMegathreadActivity,
    finalizeMegathreadActivity,
  };
};
