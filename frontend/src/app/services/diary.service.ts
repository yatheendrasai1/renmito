import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, shareReplay } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Season, CreateSeason, Episode, UpsertEpisode } from '../models/diary.model';
import { environment } from '../../environments/environment';

const devLog = (...args: unknown[]) => { if (!environment.production) console.error(...args); };

@Injectable({ providedIn: 'root' })
export class DiaryService {
  private readonly seasonsBase  = `${environment.apiBase}/seasons`;
  private readonly episodesBase = `${environment.apiBase}/episodes`;

  private seasons$: Observable<Season[]> | null = null;
  private episodeCache = new Map<string, Episode>();

  constructor(private http: HttpClient) {}

  // ── Seasons ──────────────────────────────────────────────────────────────────

  listSeasons(): Observable<Season[]> {
    if (!this.seasons$) {
      this.seasons$ = this.http.get<Season[]>(this.seasonsBase).pipe(
        shareReplay(1),
        catchError(err => { devLog('Failed to fetch seasons:', err); return of([]); })
      );
    }
    return this.seasons$;
  }

  createSeason(payload: CreateSeason): Observable<Season> {
    return this.http.post<Season>(this.seasonsBase, payload).pipe(
      tap(() => { this.seasons$ = null; }),
      catchError(err => { devLog('Failed to create season:', err); throw err; })
    );
  }

  updateSeason(id: string, patch: Partial<CreateSeason>): Observable<Season> {
    return this.http.put<Season>(`${this.seasonsBase}/${id}`, patch).pipe(
      tap(() => { this.seasons$ = null; }),
      catchError(err => { devLog('Failed to update season:', err); throw err; })
    );
  }

  deleteSeason(id: string): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.seasonsBase}/${id}`).pipe(
      tap(() => { this.seasons$ = null; }),
      catchError(err => { devLog('Failed to delete season:', err); throw err; })
    );
  }

  // ── Episodes ─────────────────────────────────────────────────────────────────

  getEpisode(date: string): Observable<Episode> {
    const hit = this.episodeCache.get(date);
    if (hit) return of(hit);
    return this.http.get<Episode>(`${this.episodesBase}/${date}`).pipe(
      tap(ep => this.episodeCache.set(date, ep)),
      catchError(err => {
        devLog('Failed to fetch episode:', err);
        return of({ date, seasonId: null, episodeName: '', content: '', sentiment: { label: '', emoji: '' }, startedWritingAt: null, dayNumber: 1, lastAccessAt: null });
      })
    );
  }

  upsertEpisode(date: string, payload: UpsertEpisode): Observable<Episode> {
    return this.http.put<Episode>(`${this.episodesBase}/${date}`, payload).pipe(
      tap(ep => this.episodeCache.set(date, ep)),
      catchError(err => { devLog('Failed to save episode:', err); throw err; })
    );
  }

  deleteEpisode(date: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.episodesBase}/${date}`).pipe(
      tap(() => this.episodeCache.delete(date)),
      catchError(err => { devLog('Failed to delete episode:', err); throw err; })
    );
  }

  invalidateEpisodeCache(date: string): void {
    this.episodeCache.delete(date);
  }

  clearSeasonsCache(): void {
    this.seasons$ = null;
  }
}
