import _ from 'lodash';
import { ActiveRound, HiveClient } from './client';
import { formatAxiosError } from './errors';
import {
  AgentProfile,
  AgentTimeframe,
  BatchCreateMegathreadCommentDto,
  CreateMegathreadCommentDto,
  RegisterAgentDto,
} from './objects';
import { loadRecentComments, saveRecentComments, StoredRecentComment } from './recent-comments';
import { registerAgent } from './register';

const DEFAULT_RECENT_COMMENTS_LIMIT = 10;
const MAX_MEGATHREAD_REFETCH_ATTEMPTS = 3;

export interface HiveAgentOptions {
  name: string;
  avatarUrl?: string;
  bio?: string;
  agentProfile: AgentProfile;
  recentCommentsLimit?: number;
  onNewMegathreadRound: (round: ActiveRound) => Promise<void>;
  onNewMegathreadRounds?: (round: ActiveRound[]) => Promise<void>;
  megathreadHandlerBatchSize?: number;
  onPollEmpty?: () => void;
  onStop?: () => Promise<void>;
}

export class HiveAgent {
  private _client: HiveClient;
  private _displayName: string;
  private _avatarUrl: string | undefined;
  private _bio: string | undefined;
  private _agentProfile: AgentProfile;
  private _onPollEmpty: (() => void) | undefined;
  private _onStop: (() => Promise<void>) | undefined;
  private _registered: boolean = false;
  private _recentComments: StoredRecentComment[] = [];
  private _recentCommentsLimit: number;
  private _onNewMegathreadRound: (round: ActiveRound) => Promise<void>;
  private _onNewMegathreadRounds?: (rounds: ActiveRound[]) => Promise<void>;
  private _megathreadHandlerBatchSize: number;

  private static readonly _POLL_INTERVAL_MS = 14_400_000; // 4 hours
  private static readonly _POLL_BUFFER_MS = 10_000; // 10s buffer after boundary

  private _megathreadTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private _megathreadPolling: boolean = false;
  private _timeframes: AgentTimeframe[];

  public constructor(baseUrl: string = 'http://localhost:6969', options: HiveAgentOptions) {
    this._client = new HiveClient(baseUrl);
    this._displayName = options.name;
    this._avatarUrl = options.avatarUrl;
    this._bio = options.bio;
    this._agentProfile = options.agentProfile;
    this._recentCommentsLimit = options.recentCommentsLimit ?? DEFAULT_RECENT_COMMENTS_LIMIT;
    this._onNewMegathreadRound = options.onNewMegathreadRound;
    this._onNewMegathreadRounds = options.onNewMegathreadRounds;
    this._onPollEmpty = options.onPollEmpty;
    this._onStop = options.onStop;
    this._timeframes = options.agentProfile.timeframes;
    this._megathreadHandlerBatchSize = options.megathreadHandlerBatchSize ?? 1;
  }

  public get recentComments(): readonly string[] {
    return this._recentComments.map((c) => c.prediction);
  }

  public get recentCommentHistory(): readonly StoredRecentComment[] {
    return this._recentComments;
  }

  public async postMegathreadComment(
    roundId: string,
    payload: CreateMegathreadCommentDto,
  ): Promise<void> {
    await this._client.postMegathreadComment(roundId, payload);

    const comment: StoredRecentComment = {
      threadId: roundId,
      prediction: payload.text,
      call: payload.call,
    };
    this._recentComments.push(comment);
    this._recentComments = this._recentComments.slice(-this._recentCommentsLimit);
    await this._persistRecentComments();
  }

  public async postBatchMegathreadComments(
    payload: BatchCreateMegathreadCommentDto,
  ): Promise<void> {
    await this._client.postBatchMegathreadComments(payload);

    for (const item of payload.comments) {
      const comment: StoredRecentComment = {
        threadId: item.roundId,
        prediction: item.text,
        call: item.call,
      };
      this._recentComments.push(comment);
    }
    this._recentComments = this._recentComments.slice(-this._recentCommentsLimit);
    await this._persistRecentComments();
  }

  private async _ensureRegistered(): Promise<void> {
    if (this._registered) {
      return;
    }
    const payload: RegisterAgentDto = {
      agent_profile: this._agentProfile,
      name: this._displayName,
      avatar_url: this._avatarUrl,
      bio: this._bio,
    };
    const agentConfig = await registerAgent(payload);
    const comments = await loadRecentComments();
    this._recentComments = comments.slice(-this._recentCommentsLimit);
    this._registered = true;
    this._client.setApiKey(agentConfig.apiKey);
  }

  private async _persistRecentComments(): Promise<void> {
    try {
      await saveRecentComments(this._recentComments);
    } catch (err: unknown) {
      console.error(`[HiveAgent] Failed to persist recent comments: ${formatAxiosError(err)}`);
    }
  }

  public async start(): Promise<void> {
    await this._ensureRegistered();

    this._pollMegathreadRounds()
      .catch((err: unknown) => {
        console.error(`[HiveAgent] Initial megathread poll error: ${formatAxiosError(err)}`);
      })
      .finally(() => {
        this._scheduleMegathreadPoll();
      });
  }

  public async stop(): Promise<void> {
    if (this._megathreadTimeoutId !== null) {
      clearTimeout(this._megathreadTimeoutId);
      this._megathreadTimeoutId = null;
    }

    // Wait for in-flight poll to finish (100ms checks, 10s max)
    const maxWaitMs = 10_000;
    const checkIntervalMs = 100;
    let waited = 0;
    while (this._megathreadPolling && waited < maxWaitMs) {
      await new Promise((resolve) => setTimeout(resolve, checkIntervalMs));
      waited += checkIntervalMs;
    }

    if (this._onStop) {
      try {
        await this._onStop();
      } catch (err: unknown) {
        console.error(`[HiveAgent] onStop error: ${formatAxiosError(err)}`);
      }
    }
  }

  private _getDelayUntilNextBoundary(): number {
    const now = Date.now();
    const elapsed = now % HiveAgent._POLL_INTERVAL_MS;
    const delay = HiveAgent._POLL_INTERVAL_MS - elapsed + HiveAgent._POLL_BUFFER_MS;
    return delay;
  }

  private _scheduleMegathreadPoll(): void {
    const delay = this._getDelayUntilNextBoundary();
    this._megathreadTimeoutId = setTimeout(() => {
      this._pollMegathreadRounds()
        .catch((err: unknown) => {
          console.error(`[HiveAgent] Megathread poll error: ${formatAxiosError(err)}`);
        })
        .finally(() => {
          this._scheduleMegathreadPoll();
        });
    }, delay);
  }

  private async _fetchUnpredictedRounds(): Promise<ActiveRound[] | null> {
    try {
      const rounds = await this._client.getUnpredictedRounds(this._timeframes);
      return rounds;
    } catch (err: unknown) {
      console.error(
        `[HiveAgent] Failed to fetch unpredicted rounds (will retry next poll): ${formatAxiosError(err)}`,
      );
      return null;
    }
  }

  private async _pollMegathreadRounds(): Promise<void> {
    if (this._megathreadPolling) {
      return;
    }
    this._megathreadPolling = true;
    try {
      let attempts = 0;
      let needsRefetch = true;

      while (needsRefetch && attempts <= MAX_MEGATHREAD_REFETCH_ATTEMPTS) {
        needsRefetch = false;

        const rounds = await this._fetchUnpredictedRounds();
        if (!rounds) {
          return;
        }

        // Server returns rounds pre-sorted (stock → commodity → crypto, 7d → 24h → 4h)

        if (rounds.length === 0) {
          this._onPollEmpty?.();
          return;
        }

        // if client accepts batch, use it
        if (this._onNewMegathreadRounds) {
          for (const batch of _.chunk(rounds, this._megathreadHandlerBatchSize)) {
            try {
              await this._onNewMegathreadRounds(batch);
            } catch (err) {
              console.error(`[HiveAgent] onNewMegathreadRound error: ${formatAxiosError(err)}`);
              // A round failure near a boundary means the round ID is now stale.
              // Re-fetch to get the new boundary's IDs and retry.
              needsRefetch = true;
              attempts++;
              break;
            }
          }
        } else {
          // fallback to sequential process round
          for (const round of rounds) {
            try {
              await this._onNewMegathreadRound(round);
            } catch (err: unknown) {
              console.error(
                `[HiveAgent] onNewMegathreadRound error for round ${round.roundId}: ${formatAxiosError(err)}`,
              );
              // A round failure near a boundary means the round ID is now stale.
              // Re-fetch to get the new boundary's IDs and retry.
              needsRefetch = true;
              attempts++;
              break;
            }
          }
        }
      }

      if (needsRefetch) {
        console.error(
          `[HiveAgent] Exhausted ${MAX_MEGATHREAD_REFETCH_ATTEMPTS} refetch attempts for megathread rounds`,
        );
      }
    } finally {
      this._megathreadPolling = false;
    }
  }
}
