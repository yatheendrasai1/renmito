import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Journey, CreateJourney, JourneyEntry, CreateJourneyEntry } from '../models/journey.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class JourneyService {
  private readonly apiBase = `${environment.apiBase}/journeys`;

  constructor(private http: HttpClient) {}

  listJourneys(): Observable<Journey[]> {
    return this.http.get<Journey[]>(this.apiBase).pipe(
      catchError(err => { console.error('Failed to fetch journeys:', err); return of([]); })
    );
  }

  getJourney(id: string): Observable<Journey | null> {
    return this.http.get<Journey>(`${this.apiBase}/${id}`).pipe(
      catchError(err => { console.error('Failed to fetch journey:', err); return of(null); })
    );
  }

  createJourney(payload: CreateJourney): Observable<Journey> {
    return this.http.post<Journey>(this.apiBase, payload);
  }

  updateJourney(id: string, patch: Partial<Pick<Journey, 'name' | 'status' | 'span' | 'endDate' | 'config' | 'derivedFrom'>>): Observable<Journey> {
    return this.http.put<Journey>(`${this.apiBase}/${id}`, patch);
  }

  deleteJourney(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiBase}/${id}`);
  }

  listEntries(journeyId: string): Observable<JourneyEntry[]> {
    return this.http.get<JourneyEntry[]>(`${this.apiBase}/${journeyId}/entries`).pipe(
      catchError(err => { console.error('Failed to fetch entries:', err); return of([]); })
    );
  }

  addEntry(journeyId: string, payload: CreateJourneyEntry): Observable<JourneyEntry> {
    return this.http.post<JourneyEntry>(`${this.apiBase}/${journeyId}/entries`, payload);
  }

  updateEntry(journeyId: string, entryId: string, patch: Partial<CreateJourneyEntry>): Observable<JourneyEntry> {
    return this.http.put<JourneyEntry>(`${this.apiBase}/${journeyId}/entries/${entryId}`, patch);
  }

  deleteEntry(journeyId: string, entryId: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.apiBase}/${journeyId}/entries/${entryId}`);
  }

  resyncJourney(journeyId: string): Observable<JourneyEntry[]> {
    return this.http.post<JourneyEntry[]>(`${this.apiBase}/${journeyId}/resync`, {});
  }
}
