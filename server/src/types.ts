export interface QuizResult {
  id: string;
  userId: string;
  topic: string;
  startYear: string;
  endYear: string;
  score: number;
  total: number;
  xpEarned: number;
  takenAt: string;
}

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

export const XP_REWARDS = {
  VIEW_TIMELINE: 10,
  COMPLETE_QUIZ: 50,
  SAVE_TIMELINE: 5,
  DAILY_LOGIN: 5,
} as const;

export const THEMES = [
  { id: 'midnight', name: 'Midnight', description: 'The classic dark theme' },
  { id: 'sepia', name: 'Sepia', description: 'Warm vintage tones' },
  { id: 'neon', name: 'Neon', description: 'Vibrant cyberpunk palette' },
  { id: 'ocean', name: 'Ocean', description: 'Deep sea blues and teals' },
  { id: 'forest', name: 'Forest', description: 'Earthy greens and naturals' },
] as const;

export type ThemeId = typeof THEMES[number]['id'];

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  createdAt: string;
  dailyCount: number;
  dailyResetAt: string;
  xp: number;
  level: number;
  lastLoginAt: string;
  activeTheme: string;
  unlockedThemes: string[];
  savedTimelines?: SavedTimeline[];
  customTopics?: CustomTopic[];
}
