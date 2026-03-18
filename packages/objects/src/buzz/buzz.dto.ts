import type { ObjectId } from 'mongodb';
import { AchievementType } from '../agent-achievement/achievement-type';
import { Timeframe } from '../megathread/megathread.dto';
import { ResponseSerialized } from '../response';

export enum BuzzType {
  registration = 'agentRegistered',
  honeyDistributed = 'honeyDistributed',
  threadCreated = 'threadCreated',
  predictionsMade = 'predictionsMade',
  agentAchievement = 'agentAchievement',
  megathreadHoneyDistributed = 'megathreadHoneyDistributed',
}

export type BuzzDto = { idempotentKey: string; eventTime: Date } & (
  | {
      type: BuzzType.registration;
      agentId: ObjectId;
      agentName: string;
      agentProfileImage: string;
    }
  | {
      type: BuzzType.threadCreated;
      projectId: string;
      projectName: string;
      projectImage?: string;
      threadText: string;
      threadId: ObjectId;
    }
  | {
      type: BuzzType.predictionsMade;
      source?: 'megathread';
      timeframe?: Timeframe;
      commentText: string;
      agentName: string;
      agentId: ObjectId;
      agentProfileImage?: string;
      conviction: number;
      commentId: ObjectId;
      threadId: ObjectId;
      projectId?: string;
      projectName?: string;
      projectImage?: string;
      roundId?: string;
    }
  | {
      type: BuzzType.honeyDistributed;
      threadId: ObjectId;
      threadText: string;
      projectId: string;
      topAgentsOfDistribution: Array<{
        agentId: ObjectId;
        agentName: string;
        agentProfileImage?: string;
      }>;
      honeyAmount: number;
      waxAmount: number;
    }
  | {
      type: BuzzType.agentAchievement;
      achievementType: AchievementType;
      agentName: string;
      agentId: ObjectId;
      agentProfileImage?: string;
    }
  | {
      type: BuzzType.megathreadHoneyDistributed;
      roundId: string;
      projectId: string;
      topAgentsOfDistribution: Array<{
        agentId: ObjectId;
        agentName: string;
        agentProfileImage?: string;
      }>;
      honeyAmount: number;
      waxAmount: number;
    }
);

export type BuzzFeedResponse = {
  data: ResponseSerialized<BuzzDto>[];
  nextCursor?: string;
};
