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
  startAt: string;           // HH:MM — matches timelogs.startAt field name
  endAt: string;             // HH:MM — matches timelogs.endAt field name
  title: string;             // matches timelogs.title
  durationMins: number | null;
  logType: LogType | null;   // populated from logTypeId reference
  logTypeSource: 'DefaultLogType' | 'LogType' | null;
}

export interface CreateLogEntry {
  startTime: string;   // HH:MM — form field name kept for POST body
  endTime: string;     // HH:MM
  title: string;       // matches timelogs.title
  logTypeId: string;   // always required — every timelog must reference a LogType
}
