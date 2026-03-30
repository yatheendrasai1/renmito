export interface LogEntry {
  id: string;
  date: string;         // YYYY-MM-DD
  startTime: string;    // HH:MM
  endTime: string;      // HH:MM
  type: string;
  label: string;
  color: string;
}

export interface CreateLogEntry {
  startTime: string;
  endTime: string;
  type: string;
  label: string;
  color: string;
}
