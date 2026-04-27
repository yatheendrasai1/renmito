import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, shareReplay } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { LogEntry, CreateLogEntry } from '../models/log.model';
import { environment } from '../../environments/environment';

const devLog = (...args: unknown[]) => { if (!environment.production) console.error(...args); };

@Injectable({
  providedIn: 'root'
})
export class LogService {
  private readonly apiBase = `${environment.apiBase}/logs`;

  private dateCache$: Map<string, Observable<LogEntry[]>> = new Map();
  private monthCache$: Map<string, Observable<Record<string, number>>> = new Map();

  constructor(private http: HttpClient) {}

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  getLogsForDate(date: Date): Observable<LogEntry[]> {
    const dateStr = this.formatDate(date);
    if (!this.dateCache$.has(dateStr)) {
      const obs$ = this.http.get<LogEntry[]>(`${this.apiBase}/${dateStr}`).pipe(
        shareReplay(1),
        catchError(err => {
          devLog('Failed to fetch logs:', err);
          return of([]);
        })
      );
      this.dateCache$.set(dateStr, obs$);
    }
    return this.dateCache$.get(dateStr)!;
  }

  createLog(date: Date, entry: CreateLogEntry): Observable<LogEntry> {
    const dateStr = this.formatDate(date);
    return this.http.post<LogEntry>(`${this.apiBase}/${dateStr}`, entry).pipe(
      tap(() => this.invalidateDate(dateStr))
    );
  }

  updateLog(date: Date, id: string, entry: Partial<CreateLogEntry>): Observable<LogEntry> {
    const dateStr = this.formatDate(date);
    return this.http.put<LogEntry>(`${this.apiBase}/${dateStr}/${id}`, entry).pipe(
      tap(() => this.invalidateDate(dateStr))
    );
  }

  deleteLog(date: Date, id: string): Observable<{ message: string }> {
    const dateStr = this.formatDate(date);
    return this.http.delete<{ message: string }>(`${this.apiBase}/${dateStr}/${id}`).pipe(
      tap(() => this.invalidateDate(dateStr))
    );
  }

  /** Returns { "YYYY-MM-DD": workMinutes } for the given month (transit excluded). */
  getMonthWorkSummary(year: number, month: number): Observable<Record<string, number>> {
    const key = `${year}-${month}`;
    if (!this.monthCache$.has(key)) {
      const obs$ = this.http.get<Record<string, number>>(`${this.apiBase}/month/${year}/${month}`).pipe(
        shareReplay(1),
        catchError(() => of({}))
      );
      this.monthCache$.set(key, obs$);
    }
    return this.monthCache$.get(key)!;
  }

  /** Fetches all logs in [startDate, endDate] (YYYY-MM-DD), break/transit excluded. */
  getLogsForDateRange(startDate: string, endDate: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiBase}/range?startDate=${startDate}&endDate=${endDate}`);
  }

  /** Report-mode patch: updates title, ticketId, startAtISO, durationMins. */
  updateLogReport(
    id: string,
    body: { title?: string; ticketId?: string | null; startAtISO?: string; durationMins?: number },
    oldDateStr: string
  ): Observable<any> {
    return this.http.patch<any>(`${this.apiBase}/${id}/report`, body).pipe(
      tap(() => {
        this.invalidateDate(oldDateStr);
        if (body.startAtISO) {
          const newDate = body.startAtISO.slice(0, 10);
          if (newDate !== oldDateStr) this.invalidateDate(newDate);
        }
      })
    );
  }

  invalidateDate(dateStr: string): void {
    this.dateCache$.delete(dateStr);
    // Also clear month summary for the month containing this date
    const [y, m] = dateStr.split('-');
    this.monthCache$.delete(`${y}-${parseInt(m, 10)}`);
  }

  clearAllCaches(): void {
    this.dateCache$.clear();
    this.monthCache$.clear();
  }
}
