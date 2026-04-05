import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ColorPalette } from '../components/theme-editor/theme-editor.component';

@Injectable({ providedIn: 'root' })
export class PreferenceService {
  private readonly apiBase = `${environment.apiBase}/preferences`;

  constructor(private http: HttpClient) {}

  /**
   * Fetches the user's stored palette from the DB.
   * Returns null if none has been saved yet (HTTP 204) or on error.
   */
  getPalette(): Observable<ColorPalette | null> {
    return this.http
      .get<{ palette: ColorPalette } | null>(this.apiBase)
      .pipe(
        map(res => res?.palette ?? null),
        catchError(err => {
          // 204 No Content comes through as a successful null body — handled by map above.
          // Any real error (network, 5xx) is swallowed so the app still loads.
          console.warn('Could not fetch palette preference:', err?.message);
          return of(null);
        })
      );
  }

  /**
   * Upserts the palette in the DB.
   * Errors are swallowed — localStorage remains the reliable local cache.
   */
  savePalette(palette: ColorPalette): Observable<ColorPalette | null> {
    return this.http
      .put<{ palette: ColorPalette }>(`${this.apiBase}/palette`, palette)
      .pipe(
        map(res => res?.palette ?? null),
        catchError(err => {
          console.warn('Could not save palette preference:', err?.message);
          return of(null);
        })
      );
  }

  /**
   * Clears the stored palette (resets to app default).
   */
  deletePalette(): Observable<void> {
    return this.http
      .delete<void>(`${this.apiBase}/palette`)
      .pipe(
        catchError(err => {
          console.warn('Could not delete palette preference:', err?.message);
          return of(undefined);
        })
      );
  }
}
