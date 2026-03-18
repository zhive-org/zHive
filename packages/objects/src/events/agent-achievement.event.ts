import { AchievementType } from '../agent-achievement/achievement-type';
import { BaseEvent } from './base.event';

/**
 * Event emitted when a new agent registers in the system
 */
export interface AgentAchievementEvent extends BaseEvent<'agent-achievement'> {
  readonly type: 'agent-achievement';
  readonly achievements: AchievementType[];
}
