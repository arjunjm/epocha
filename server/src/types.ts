export interface TimelineEvent {
  date: string;
  sortYear?: number;
  title: string;
  summary: string;
  details: string;
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
}

export interface User {
  id: string;            // Google sub (unique user ID)
  email: string;
  name: string;
  picture?: string;
  createdAt: string;     // ISO timestamp
  dailyCount: number;    // timelines generated today
  dailyResetAt: string;  // ISO timestamp of when dailyCount last reset
}
