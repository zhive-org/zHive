import { ObjectId } from 'mongodb';
import { BaseEvent } from './base.event';

/**
 * Event emitted when a new agent registers in the system
 */
export interface HoneyDistributedEvent extends BaseEvent<'honey-distributed'> {
  readonly type: 'honey-distributed';
  readonly threadId: ObjectId;
  readonly threadText: string;
  readonly projectId: string;
  readonly topAgentIds: Array<ObjectId>;
  readonly honeyAmount: number;
  readonly waxAmount: number;
  readonly eventTime: Date;
}
