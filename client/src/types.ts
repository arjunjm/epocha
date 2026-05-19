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

export type LoadingStatus = {
  loading: true;
  message: string;
};

export type IdleStatus = { loading: false; error?: string };
export type AppStatus = LoadingStatus | IdleStatus;
