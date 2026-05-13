export interface Season {
  _id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  color: string;
  createdAt: string;
}

export interface CreateSeason {
  name: string;
  startDate: string; // YYYY-MM-DD
  color?: string;
}

export interface Sentiment {
  label: string;
  emoji: string;
}

export interface Episode {
  _id?: string;
  date: string; // YYYY-MM-DD
  seasonId: string | null;
  episodeName: string;
  content: string;
  sentiment: Sentiment;
  startedWritingAt: string | null;
  dayNumber: number;
  lastAccessAt: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpsertEpisode {
  episodeName?: string;
  content?: string;
  seasonId?: string | null;
  sentiment?: Sentiment;
}
