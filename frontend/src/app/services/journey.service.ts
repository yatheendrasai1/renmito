import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, shareReplay } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Journey, CreateJourney, JourneyEntry, CreateJourneyEntry } from '../models/journey.model';
import { environment } from '../../environments/environment';

const devLog = (...args: unknown[]) => { if (!environment.production) console.error(...args); };

@Injectable({ providedIn: 'root' })
export class JourneyService {
  private readonly apiBase = `${environment.apiBase}/journeys`;

  private journeys$: Observable<Journey[]> | null = null;
  private entries$: Map<string, Observable<JourneyEntry[]>> = new Map();

  constructor(private http: HttpClient) {}

  listJourneys(): Observable<Journey[]> {
    if (!this.journeys$) {
      this.journeys$ = this.http.get<Journey[]>(this.apiBase).pipe(
        shareReplay(1),
        catchError(err => { devLog('Failed to fetch journeys:', err); return of([]); })
      );
    }
    return this.journeys$;
  }

  getJourney(id: string): Observable<Journey | null> {
    return this.http.get<Journey>(`${this.apiBase}/${id}`).pipe(
      catchError(err => { devLog('Failed to fetch journey:', err); return of(null); })
    );
  }

  createJourney(payload: CreateJourney): Observable<Journey> {
    return this.http.post<Journey>(this.apiBase, payload).pipe(
      tap(() => this.clearJourneysCache())
    );
  }

  updateJourney(id: string, patch: Partial<Pick<Journey, 'name' | 'status' | 'span' | 'endDate' | 'config' | 'derivedFrom'>>): Observable<Journey> {
    return this.http.put<Journey>(`${this.apiBase}/${id}`, patch).pipe(
      tap(() => this.clearJourneysCache())
    );
  }

  deleteJourney(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiBase}/${id}`).pipe(
      tap(() => { this.clearJourneysCache(); this.entries$.delete(id); })
    );
  }

  listEntries(journeyId: string): Observable<JourneyEntry[]> {
    if (!this.entries$.has(journeyId)) {
      const entries$ = this.http.get<JourneyEntry[]>(`${this.apiBase}/${journeyId}/entries`).pipe(
        shareReplay(1),
        catchError(err => { devLog('Failed to fetch entries:', err); return of([]); })
      );
      this.entries$.set(journeyId, entries$);
    }
    return this.entries$.get(journeyId)!;
  }

  addEntry(journeyId: string, payload: CreateJourneyEntry): Observable<JourneyEntry> {
    return this.http.post<JourneyEntry>(`${this.apiBase}/${journeyId}/entries`, payload).pipe(
      tap(() => this.entries$.delete(journeyId))
    );
  }

  updateEntry(journeyId: string, entryId: string, patch: Partial<CreateJourneyEntry>): Observable<JourneyEntry> {
    return this.http.put<JourneyEntry>(`${this.apiBase}/${journeyId}/entries/${entryId}`, patch).pipe(
      tap(() => this.entries$.delete(journeyId))
    );
  }

  deleteEntry(journeyId: string, entryId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiBase}/${journeyId}/entries/${entryId}`).pipe(
      tap(() => this.entries$.delete(journeyId))
    );
  }

  resyncJourney(journeyId: string): Observable<JourneyEntry[]> {
    return this.http.post<JourneyEntry[]>(`${this.apiBase}/${journeyId}/resync`, {}).pipe(
      tap(() => this.entries$.delete(journeyId))
    );
  }

  clearJourneysCache(): void {
    this.journeys$ = null;
  }

  clearAllCaches(): void {
    this.journeys$ = null;
    this.entries$.clear();
  }
}
