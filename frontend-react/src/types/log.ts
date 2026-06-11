import type { LogType } from './log-type';

export interface LogEntry {
  id: string;
  date: string;               // YYYY-MM-DD — start date (derived from startAt)
  endDate: string | null;     // YYYY-MM-DD — end date (derived from endAt)
  startAt: string;            // ISO datetime — range: start; point: the moment
  endAt: string | null;       // ISO datetime — null for point logs
  title: string;
  durationMins: number | null;
  logType: LogType | null;
  logTypeSource: 'DefaultLogType' | 'LogType' | null;
  entryType: 'range' | 'point';
  status?: 'running' | 'completed' | 'cancelled';
  ticketId?: string;
  priority?: 'High' | 'Medium' | 'Low' | null;
  collaborators?: string[];
  satisfactoryScore?: number | null;
  crucialPerson?: 'Yes' | 'No' | 'Shared' | null;
  source?: 'manual' | 'auto' | 'imported' | 'ai';
  updatedAt: string | null;   // ISO
  jiraTicketId?:      string | null;
  jiraTicketKey?:     string | null;   // e.g. ENG-1234
  jiraTicketSummary?: string | null;   // cached title
}

export interface CreateLogEntry {
  // Preferred write path: full UTC ISO strings (avoids timezone ambiguity)
  startAtISO?: string;        // UTC ISO — preferred over startTime
  endAtISO?: string;          // UTC ISO — preferred over endTime
  pointAtISO?: string;        // UTC ISO — preferred over pointTime
  // Legacy HH:MM fields (still accepted by the backend as fallback)
  startTime?: string;         // HH:MM
  endTime?: string;           // HH:MM
  pointTime?: string;         // HH:MM for point logs
  title: string;
  logTypeId: string;
  date?: string;              // YYYY-MM-DD override (for legacy toDate fallback)
  endDate?: string;           // YYYY-MM-DD for cross-midnight (legacy)
  entryType?: 'range' | 'point';
  ticketId?: string;
  priority?: 'High' | 'Medium' | 'Low' | null;
  collaborators?: string[];
  satisfactoryScore?: number | null;
  crucialPerson?: 'Yes' | 'No' | 'Shared' | null;
  source?: 'manual' | 'ai';
  jiraTicketId?:      string | null;
  jiraTicketKey?:     string | null;
  jiraTicketSummary?: string | null;
}
