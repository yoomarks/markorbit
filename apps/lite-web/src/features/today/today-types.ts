export type TodayBusyState = 'prepare' | 'confirm' | 'visual-brief' | 'visual-request' | '';

export type TodaySelection = {
  recommendationId: string;
  preparedActionId: string;
  contentPickId: string;
};
