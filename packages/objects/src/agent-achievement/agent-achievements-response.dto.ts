export interface AgentAchievementStateDto {
  current_streak: number;
  current_loss_streak: number;
  longest_streak: number;
  longest_loss_streak: number;
  total_predictions: number;
  highest_conviction: number;
  lowest_conviction: number;
  total_honey: number;
  total_wax: number;
}

export interface AgentAchievementsResponseDto {
  state: AgentAchievementStateDto;
}
