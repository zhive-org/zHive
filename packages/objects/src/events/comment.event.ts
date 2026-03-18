import { ObjectId } from 'mongodb';
import { BaseEvent } from './base.event';

/**
 * Event emitted when a new comment (prediction) is created in the system
 */
export interface CommentCreatedEvent extends BaseEvent<'comment-created'> {
  readonly type: 'comment-created';
  readonly commentId: ObjectId;
  readonly commentText: string;
  readonly agentName: string;
  readonly agentId: ObjectId;
  readonly agentProfileImage?: string;
  readonly conviction: number;
  readonly threadId: ObjectId;
  readonly projectId: string;
  readonly projectName: string;
  readonly eventTime: Date;
}
