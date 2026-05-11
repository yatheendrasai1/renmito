export interface Season {
  _id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  createdAt: string;
}

export interface CreateSeason {
  name: string;
  startDate: string; // YYYY-MM-DD
}

export interface Episode {
  _id?: string;
  date: string; // YYYY-MM-DD
  seasonId: string | null;
  episodeName: string;
  content: string;
  lastAccessAt: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpsertEpisode {
  episodeName?: string;
  content?: string;
  seasonId?: string | null;
}
