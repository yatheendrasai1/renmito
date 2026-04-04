import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { LogEntry, CreateLogEntry } from '../models/log.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class LogService {
  private readonly apiBase = `${environment.apiBase}/logs`;

  constructor(private http: HttpClient) {}

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  getLogsForDate(date: Date): Observable<LogEntry[]> {
    const dateStr = this.formatDate(date);
    return this.http.get<LogEntry[]>(`${this.apiBase}/${dateStr}`).pipe(
      catchError(err => {
        console.error('Failed to fetch logs:', err);
        return of([]);
      })
    );
  }

  createLog(date: Date, entry: CreateLogEntry): Observable<LogEntry> {
    const dateStr = this.formatDate(date);
    return this.http.post<LogEntry>(`${this.apiBase}/${dateStr}`, entry);
  }

  updateLog(date: Date, id: string, entry: Partial<CreateLogEntry>): Observable<LogEntry> {
    const dateStr = this.formatDate(date);
    return this.http.put<LogEntry>(`${this.apiBase}/${dateStr}/${id}`, entry);
  }

  deleteLog(date: Date, id: string): Observable<{ message: string }> {
    const dateStr = this.formatDate(date);
    return this.http.delete<{ message: string }>(`${this.apiBase}/${dateStr}/${id}`);
  }
}
