import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, shareReplay } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ColorPalette } from '../components/theme-editor/theme-editor.component';
import { DaySettings } from './day-level.service';

/** 1.82 — A single entry in the user's configured quick shortcuts bar. */
export interface QuickShortcut {
  logTypeId:   string;
  defaultMins: number;
}

/** 1.71 — A live running log stored in the backend so it syncs across devices. */
export interface ActiveLog {
  logTypeId:   string;
  title:       string;
  startedAt:   string;        // ISO date string — written by the server (avoids clock skew)
  plannedMins: number | null; // 1.72 — optional planned duration
}

export interface UserPreferences {
  palette:        ColorPalette | null;
  customPresets:  ColorPalette[];
  activeLog:      ActiveLog | null;
  quickShortcuts: QuickShortcut[];
  daySettings:    DaySettings | null;
}

export type { DaySettings };

@Injectable({ providedIn: 'root' })
export class PreferenceService {
  private readonly apiBase = `${environment.apiBase}/preferences`;

  private prefs$: Observable<UserPreferences | null> | null = null;

  constructor(private http: HttpClient) {}

  /** Returns active palette + all custom presets + running log. Null on 204 / error. */
  getPreferences(): Observable<UserPreferences | null> {
    if (!this.prefs$) {
      this.prefs$ = this.http
        .get<UserPreferences>(this.apiBase)
        .pipe(
          shareReplay(1),
          map(res => res ?? null),
          catchError(err => {
            console.warn('Could not fetch preferences:', err?.message);
            return of(null);
          })
        );
    }
    return this.prefs$;
  }

  clearPrefsCache(): void {
    this.prefs$ = null;
  }

  /** Upserts the currently active palette. */
  savePalette(palette: ColorPalette): Observable<ColorPalette | null> {
    return this.http
      .put<{ palette: ColorPalette }>(`${this.apiBase}/palette`, palette)
      .pipe(
        tap(() => this.clearPrefsCache()),
        map(res => res?.palette ?? null),
        catchError(err => {
          console.warn('Could not save palette:', err?.message);
          return of(null);
        })
      );
  }

  /** Clears the active palette. */
  deletePalette(): Observable<void> {
    return this.http
      .delete<void>(`${this.apiBase}/palette`)
      .pipe(
        tap(() => this.clearPrefsCache()),
        catchError(err => {
          console.warn('Could not delete palette:', err?.message);
          return of(undefined);
        })
      );
  }

  /** Adds a named custom preset (max 10 enforced by backend). */
  addPreset(preset: ColorPalette): Observable<ColorPalette[] | null> {
    return this.http
      .post<{ customPresets: ColorPalette[] }>(`${this.apiBase}/presets`, preset)
      .pipe(
        tap(() => this.clearPrefsCache()),
        map(res => res?.customPresets ?? null),
        catchError(err => {
          console.warn('Could not add preset:', err?.message);
          return of(null);
        })
      );
  }

  /** Deletes a custom preset by name. */
  deletePreset(name: string): Observable<ColorPalette[] | null> {
    return this.http
      .delete<{ customPresets: ColorPalette[] }>(
        `${this.apiBase}/presets/${encodeURIComponent(name)}`
      )
      .pipe(
        tap(() => this.clearPrefsCache()),
        map(res => res?.customPresets ?? null),
        catchError(err => {
          console.warn('Could not delete preset:', err?.message);
          return of(null);
        })
      );
  }

  /**
   * 1.71 — Starts a live running log.
   * The server writes startedAt to avoid cross-device clock skew.
   * Returns the saved activeLog record (with server timestamp).
   */
  startActiveLog(payload: {
    logTypeId:   string;
    title:       string;
    plannedMins: number | null;
  }): Observable<ActiveLog | null> {
    return this.http
      .put<{ activeLog: ActiveLog }>(`${this.apiBase}/active-log`, payload)
      .pipe(
        tap(() => this.clearPrefsCache()),
        map(res => res?.activeLog ?? null),
        catchError(err => {
          console.warn('Could not start active log:', err?.message);
          return of(null);
        })
      );
  }

  /** 1.71 — Clears the running log from the DB after the log entry has been saved. */
  stopActiveLog(): Observable<void> {
    return this.http
      .delete<void>(`${this.apiBase}/active-log`)
      .pipe(
        tap(() => this.clearPrefsCache()),
        catchError(err => {
          console.warn('Could not stop active log:', err?.message);
          return of(undefined);
        })
      );
  }

  /** Saves the user's ideal-day schedule targets. */
  updateDaySettings(settings: Partial<DaySettings>): Observable<DaySettings | null> {
    return this.http
      .put<{ daySettings: DaySettings }>(`${this.apiBase}/day-settings`, settings)
      .pipe(
        tap(() => this.clearPrefsCache()),
        map(res => res?.daySettings ?? null),
        catchError(err => {
          console.warn('Could not update day settings:', err?.message);
          return of(null);
        })
      );
  }

  /** 1.82 — Saves the user's quick shortcuts configuration. */
  updateQuickShortcuts(shortcuts: QuickShortcut[]): Observable<QuickShortcut[] | null> {
    return this.http
      .put<{ quickShortcuts: QuickShortcut[] }>(
        `${this.apiBase}/quick-shortcuts`,
        { shortcuts }
      )
      .pipe(
        tap(() => this.clearPrefsCache()),
        map(res => res?.quickShortcuts ?? null),
        catchError(err => {
          console.warn('Could not update quick shortcuts:', err?.message);
          return of(null);
        })
      );
  }
}
