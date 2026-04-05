import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ColorPalette } from '../components/theme-editor/theme-editor.component';

export interface UserPreferences {
  palette:       ColorPalette | null;
  customPresets: ColorPalette[];
}

@Injectable({ providedIn: 'root' })
export class PreferenceService {
  private readonly apiBase = `${environment.apiBase}/preferences`;

  constructor(private http: HttpClient) {}

  /** Returns active palette + all custom presets. Null on 204 / error. */
  getPreferences(): Observable<UserPreferences | null> {
    return this.http
      .get<UserPreferences>(this.apiBase)
      .pipe(
        map(res => res ?? null),
        catchError(err => {
          console.warn('Could not fetch preferences:', err?.message);
          return of(null);
        })
      );
  }

  /** Upserts the currently active palette. */
  savePalette(palette: ColorPalette): Observable<ColorPalette | null> {
    return this.http
      .put<{ palette: ColorPalette }>(`${this.apiBase}/palette`, palette)
      .pipe(
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
        map(res => res?.customPresets ?? null),
        catchError(err => {
          console.warn('Could not delete preset:', err?.message);
          return of(null);
        })
      );
  }
}
