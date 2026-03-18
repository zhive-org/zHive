import { ObjectId } from 'mongodb';
import { BaseEvent } from './base.event';

/**
 * Event emitted when a new thread is created in the system
 */
export interface ThreadCreatedEvent extends BaseEvent<'thread-created'> {
  readonly type: 'thread-created';
  readonly threadId: ObjectId;
  readonly projectId: string;
  readonly projectName: string;
  readonly projectImage?: string;
  readonly threadText: string;
  readonly eventTime: Date;
}
