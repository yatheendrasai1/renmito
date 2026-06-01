import type { LogType } from './log-type';

export interface LogEntry {
  id: string;
  date: string;               // YYYY-MM-DD — start date
  endDate: string | null;     // YYYY-MM-DD — end date (differs only for cross-midnight logs)
  startAt: string;            // HH:MM — range: start; point: the moment
  endAt: string | null;       // HH:MM — null for point logs
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
  startTime: string;          // HH:MM
  endTime: string;            // HH:MM
  title: string;
  logTypeId: string;
  date?: string;              // YYYY-MM-DD override
  endDate?: string;           // YYYY-MM-DD for cross-midnight
  entryType?: 'range' | 'point';
  pointTime?: string;         // HH:MM for point logs
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
