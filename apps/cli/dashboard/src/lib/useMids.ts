import { useEffect, useState } from 'react';
import { hyperliquidClient, type WsStatus } from './hyperliquid';

export interface MidsSnapshot {
  mids: Map<string, number>;
  status: WsStatus;
  tick: number;
}

export function useMids(): MidsSnapshot {
  const [snapshot, setSnapshot] = useState<MidsSnapshot>({
    mids: new Map(),
    status: 'connecting',
    tick: 0,
  });

  useEffect(() => {
    const client = hyperliquidClient();
    client.start();
    return client.subscribe((mids, status) => {
      setSnapshot((prev) => ({ mids: new Map(mids), status, tick: prev.tick + 1 }));
    });
  }, []);

  return snapshot;
}
