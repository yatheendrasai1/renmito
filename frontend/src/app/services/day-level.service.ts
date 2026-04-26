import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, shareReplay } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export type DayType = 'working' | 'holiday' | 'paid_leave' | 'sick_leave' | 'wfh';

export interface ImportantLogEntry {
  logId:        string | null;
  time:         string | null;  // HH:MM
  date:         string | null;  // YYYY-MM-DD
  logUpdatedAt: string | null;  // ISO
}

export interface ImportantLogs {
  wokeUp:    ImportantLogEntry | null;
  breakfast: ImportantLogEntry | null;
  lunch:     ImportantLogEntry | null;
  dinner:    ImportantLogEntry | null;
  sleep:     ImportantLogEntry | null;
}

export interface DayMetadata {
  date:          string;
  dayType:       DayType;
  importantLogs: ImportantLogs;
  capturedAt:    string | null; // ISO
}

export interface DaySettings {
  wakeTarget:      string;
  breakfastTarget: string;
  lunchTarget:     string;
  dinnerTarget:    string;
  workStart:       string;
  workEnd:         string;
  commuteStart:    string;
  officeReach:     string;
  officeLeave:     string;
  homeReach:       string;
  bedtimeTarget:   string;
}

@Injectable({ providedIn: 'root' })
export class DayLevelService {
  private readonly apiBase = `${environment.apiBase}/day-metadata`;

  private metaCache$: Map<string, Observable<DayMetadata | null>> = new Map();
  private monthCache$: Map<string, Observable<Record<string, string>>> = new Map();

  constructor(private http: HttpClient) {}

  /** Loads (or creates) the day metadata for the given YYYY-MM-DD date. */
  getMetadata(date: string): Observable<DayMetadata | null> {
    if (!this.metaCache$.has(date)) {
      const obs$ = this.http.get<DayMetadata>(`${this.apiBase}/${date}`).pipe(
        shareReplay(1),
        map(res => res ?? null),
        catchError(err => {
          console.warn('Could not fetch day metadata:', err?.message);
          return of(null);
        })
      );
      this.metaCache$.set(date, obs$);
    }
    return this.metaCache$.get(date)!;
  }

  /** Sets the day type flag for the given date. */
  setDayType(date: string, dayType: DayType): Observable<DayMetadata | null> {
    return this.http.put<DayMetadata>(`${this.apiBase}/${date}/day-type`, { dayType }).pipe(
      tap(() => this.invalidateDate(date)),
      map(res => res ?? null),
      catchError(err => {
        console.warn('Could not set day type:', err?.message);
        return of(null);
      })
    );
  }

  /** Triggers the backend to capture the current important-log snapshot. */
  capture(date: string): Observable<DayMetadata | null> {
    return this.http.post<DayMetadata>(`${this.apiBase}/${date}/capture`, {}).pipe(
      tap(() => this.invalidateDate(date)),
      map(res => res ?? null),
      catchError(err => {
        console.warn('Could not capture important logs:', err?.message);
        return of(null);
      })
    );
  }

  /**
   * Returns a map of { "YYYY-MM-DD": dayType } for all persisted records in
   * the given month. Dates not in the map have no explicit override.
   */
  getMonthDayTypes(year: number, month: number): Observable<Record<string, string>> {
    const key = `${year}-${month}`;
    if (!this.monthCache$.has(key)) {
      const obs$ = this.http
        .get<Record<string, string>>(`${this.apiBase}/month/${year}/${month}`)
        .pipe(
          shareReplay(1),
          catchError(() => of({}))
        );
      this.monthCache$.set(key, obs$);
    }
    return this.monthCache$.get(key)!;
  }

  invalidateDate(date: string): void {
    this.metaCache$.delete(date);
    const [y, m] = date.split('-');
    this.monthCache$.delete(`${y}-${parseInt(m, 10)}`);
  }

  clearAllCaches(): void {
    this.metaCache$.clear();
    this.monthCache$.clear();
  }
}
