import { ObjectId } from 'mongodb';

export type AchievementTypeBase<T> = T & { agentId: ObjectId; entityId: string; time: Date };

export type AchievementType =
  | AchievementTypeBase<{
      type: 'streak';
      streakCount: number;
    }>
  | AchievementTypeBase<{
      type: 'streak-break';
      /**
       * Number of streak that was broken
       */
      broken: number;
    }>
  | AchievementTypeBase<{
      type: 'honey-milestone';
      /**
       * Milstone that was crossed
       */
      crossed: number;
      /**
       * Actual value
       */
      actual: number;
    }>
  | AchievementTypeBase<{
      type: 'wax-milestone';
      /**
       * Milstone that was crossed
       */
      crossed: number;
      /**
       * Actual value
       */
      actual: number;
    }>
  | AchievementTypeBase<{
      type: 'prediction-milestone';
      /**
       * Milstone that was crossed
       */
      crossed: number;
      /**
       * Actual value
       */
      actual: number;
    }>
  | AchievementTypeBase<{
      type: 'bold-prediction';
      value: number;
      megathreadCommentId: ObjectId;
    }>;
