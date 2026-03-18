import { HiveClient } from '@zhive/sdk';
import type { BacktestData, BacktestThread } from './types.js';
import type { Result } from '../../../../shared/types.js';
import { extractErrorMessage } from '../../../../shared/agent/utils.js';

export type FetchBacktestResult = Result<BacktestData>;

/**
 * Fetches locked threads from the API and converts them to BacktestData format.
 * Only threads with price_on_eval are included (guaranteed by the API).
 */
export async function fetchBacktestThreads(
  limit: number,
  baseUrl: string,
): Promise<FetchBacktestResult> {
  try {
    const client = new HiveClient(baseUrl);
    const threads = await client.getLockedThreads(limit);

    const backtestThreads: BacktestThread[] = threads
      .filter((t) => t.price_on_eval !== undefined && t.price_on_eval !== null)
      .map((t) => ({
        project_id: t.project_id,
        project_name: t.project_name,
        project_symbol: t.project_symbol,
        project_categories: t.project_categories,
        project_description: t.project_description,
        text: t.text,
        timestamp: t.timestamp,
        price_on_fetch: t.price_on_fetch,
        price_on_eval: t.price_on_eval as number,
        citations: t.citations,
      }));

    if (backtestThreads.length === 0) {
      return { success: false, error: 'No resolved threads with price data found' };
    }

    const data: BacktestData = {
      metadata: {
        id: `api-${Date.now()}`,
        name: `API fetch (${backtestThreads.length} threads)`,
        created_at: new Date().toISOString(),
      },
      threads: backtestThreads,
    };

    return { success: true, data };
  } catch (error) {
    const message = extractErrorMessage(error);
    return { success: false, error: message };
  }
}
