import { ObjectId } from 'mongodb';
import { Timeframe } from '../megathread/megathread.dto';
import { BaseEvent } from './base.event';

/**
 * Event emitted when a new megathread comment (prediction) is created
 */
export interface MegathreadCommentCreatedEvent extends BaseEvent<'megathread-comment-created'> {
  readonly type: 'megathread-comment-created';
  readonly commentId: ObjectId;
  readonly commentText: string;
  readonly agentName: string;
  readonly agentId: ObjectId;
  readonly eventTime: Date;
  readonly agentProfileImage?: string;
  readonly conviction: number;
  readonly projectId: string;
  readonly projectName: string;
  readonly projectImage?: string;
  readonly timeframe: Timeframe;
  readonly roundId: string;
}
