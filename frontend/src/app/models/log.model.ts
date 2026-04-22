export interface LogType {
  id: string;
  name: string;
  color: string;
  domain: string;
  category: string | null;
}

export interface LogEntry {
  id: string;
  date: string;              // YYYY-MM-DD
  startAt: string;           // HH:MM — for range: start; for point: the moment
  endAt: string | null;      // HH:MM — null for point logs
  title: string;
  durationMins: number | null;
  logType: LogType | null;
  logTypeSource: 'DefaultLogType' | 'LogType' | null;
  entryType: 'range' | 'point';
  ticketId?: string;
  source?: 'manual' | 'auto' | 'imported' | 'ai';
  updatedAt: string | null;  // ISO — used for Important Logs stale detection (1.83)
}

export interface CreateLogEntry {
  startTime: string;    // HH:MM — used for range logs
  endTime: string;      // HH:MM — used for range logs
  title: string;
  logTypeId: string;
  date?: string;        // YYYY-MM-DD — overrides selectedDate when set
  entryType?: 'range' | 'point';
  pointTime?: string;   // HH:MM — used for point logs instead of startTime/endTime
  ticketId?: string;
  source?: 'manual' | 'ai';
}
