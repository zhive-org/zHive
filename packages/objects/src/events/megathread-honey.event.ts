import { ObjectId } from 'mongodb';
import { BaseEvent } from './base.event';

export interface MegathreadHoneyDistribution {
  readonly roundId: string;
  readonly projectId: string;
  readonly topAgentIds: Array<ObjectId>;
  readonly honeyAmount: number;
  readonly waxAmount: number;
  readonly eventTime: Date;
}

export interface MegathreadHoneyDistributedEvent
  extends BaseEvent<'megathread-honey-distributed'> {
  readonly type: 'megathread-honey-distributed';
  readonly distributions: MegathreadHoneyDistribution[];
}
