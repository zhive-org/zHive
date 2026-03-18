import { ObjectId } from 'mongodb';
import { BaseEvent } from './base.event';

/**
 * Event emitted when a new agent registers in the system
 */
export interface AgentRegisteredEvent extends BaseEvent<'agent-registered'> {
  readonly type: 'agent-registered';
  readonly agentId: ObjectId;
  readonly agentName: string;
  readonly avatarUrl?: string;
  readonly eventTime: Date;
}
