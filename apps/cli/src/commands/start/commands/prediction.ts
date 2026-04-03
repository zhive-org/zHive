import { HIVE_API_URL } from '../../../shared/config/constant';
import { extractErrorMessage } from '../../../shared/megathread/utils';
import type { Result } from '../../../shared/types';
import { styled } from '../../shared/theme';
import { loadConfig } from '@zhive/sdk';

interface PredictionResponse {
  id: string;
  project_id: string;
  round_id: string;
  conviction: number;
  call?: string;
  honey: number;
  wax: number;
  text: string;
  created_at: string;
  resolved_at: string;
  duration_ms?: number;
}

interface PaginatedResponse {
  data: PredictionResponse[];
  nextCursor: string | null;
}

export async function fetchMyPredictions(
  apiKey: string,
  limit: number = 10,
): Promise<Result<PredictionResponse[]>> {
  try {
    const url = `${HIVE_API_URL}/megathread-comment/me?limit=${limit}&onlyResolved=true`;
    const response = await fetch(url, {
      headers: { 'x-api-key': apiKey },
    });
    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }
    const result = (await response.json()) as PaginatedResponse;
    return { success: true, data: result.data };
  } catch (error) {
    const message = extractErrorMessage(error);
    return { success: false, error: message };
  }
}

export function formatPredictions(predictions: PredictionResponse[]) {
  if (predictions.length === 0) {
    return 'No resolved predictions yet. Make some predictions and wait for them to resolve!';
  }
  const rows = predictions.map((pred) => {
    const callLabel = pred.call?.toUpperCase() ?? (pred.conviction >= 0 ? 'UP' : 'DOWN');
    const outcome = getOutcomeStr(pred);
    const date = new Date(pred.created_at).toLocaleDateString();
    const durationMs = pred.duration_ms ?? 0;
    const duration = { 14400000: '4h', 86400000: '24h', 604800000: '7d' }[durationMs] || '??';
    return { name: pred.project_id, duration, callLabel, outcome, date };
  });
  const maxName = Math.max(...rows.map((r) => r.name.length));
  const maxOutcome = Math.max(...rows.map((r) => r.outcome.length));
  const lines = [styled.honeyBold('Your Recent Predictions:'), ''];
  for (const r of rows) {
    const name = r.name.padEnd(maxName);
    const call = r.callLabel.padStart(4);
    const paddedOutcome = r.outcome.padEnd(maxOutcome);
    const tag = r.outcome.includes('WIN') ? styled.green(paddedOutcome) : styled.red(paddedOutcome);
    lines.push(`  ${name}  ${r.duration.padStart(3)}  ${call}  ${tag}  ${r.date}`);
  }
  return lines.join('\n');
}

function getOutcomeStr(pred: PredictionResponse): string {
  if (pred.honey > 0) {
    return `[WIN] +${pred.honey.toFixed(2)} Honey`;
  }

  if (pred.wax > 0) {
    return `[LOSS] +${pred.wax.toFixed(2)} Wax`;
  }

  return '[LOSS]';
}

export async function predictionSlashCommand(
  agentName: string,
  callbacks: {
    onFetchStart?: () => void;
    onSuccess?: (output: string) => void;
    onError?: (error: string) => void;
  },
): Promise<void> {
  const credentials = await loadConfig();

  if (!credentials?.apiKey) {
    callbacks.onError?.('Agent not registered yet. Wait for agent to start.');
    return;
  }

  callbacks.onFetchStart?.();

  const result = await fetchMyPredictions(credentials.apiKey, 10);

  if (!result.success) {
    callbacks.onError?.(result.error);
    return;
  }

  const formatted = formatPredictions(result.data);
  callbacks.onSuccess?.(formatted);
}
