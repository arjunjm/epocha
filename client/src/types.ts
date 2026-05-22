export interface TimelineEvent {
  date: string;
  sortYear?: number;
  title: string;
  summary: string;
  details?: string;
  significance: string;
  figures?: string[];
  location?: string;
  tags?: string[];
}

export interface TimelineData {
  topic: string;
  period: string;
  description: string;
  events: TimelineEvent[];
  relatedTopics?: string[];
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

export interface SavedTimeline {
  id: string;
  userId: string;
  topic: string;
  startYear: string;
  endYear: string;
  title: string;
  description: string;
  savedAt: string;
  collectionName: string;
}

export interface CustomTopicItem {
  label: string;
  topic: string;
  start: string;
  end: string;
}

export interface CustomTopic {
  id: string;
  userId: string;
  name: string;
  icon: string;
  items: CustomTopicItem[];
  createdAt: string;
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
}

export const LEVEL_THRESHOLDS = [
  0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200,
  4000, 5000, 6200, 7600, 9200, 11000, 13000, 15500, 18500, 22000,
];

export function xpToLevel(xp: number): number {
  let level = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return Math.min(level, 20);
}

export function xpForNextLevel(level: number): number {
  if (level >= 20) return LEVEL_THRESHOLDS[19];
  return LEVEL_THRESHOLDS[level] ?? LEVEL_THRESHOLDS[19];
}

export type LoadingStatus = { loading: true; message: string };
export type IdleStatus = { loading: false; error?: string };
export type AppStatus = LoadingStatus | IdleStatus;

export type AppPage = 'home' | 'marketplace' | 'saved' | 'discover' | 'paths' | 'admin';
