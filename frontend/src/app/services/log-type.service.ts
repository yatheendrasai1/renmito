import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, shareReplay, tap } from 'rxjs';
import { LogType } from '../models/log-type.model';
import { environment } from '../../environments/environment';

export interface CreateLogTypePayload {
  name: string;
  domain: 'work' | 'personal' | 'family';
  category?: string;
  color?: string;
  icon?: string;
}

@Injectable({ providedIn: 'root' })
export class LogTypeService {
  private readonly apiBase = `${environment.apiBase}/logtypes`;

  // Cache for the duration of the session
  private cache$: Observable<LogType[]> | null = null;

  constructor(private http: HttpClient) {}

  getLogTypes(): Observable<LogType[]> {
    if (!this.cache$) {
      this.cache$ = this.http.get<LogType[]>(this.apiBase).pipe(shareReplay(1));
    }
    return this.cache$;
  }

  /** Creates a user-scoped log type and invalidates the cache so the next
   *  getLogTypes() call fetches the updated list. */
  createLogType(payload: CreateLogTypePayload): Observable<LogType> {
    return this.http.post<LogType>(this.apiBase, payload).pipe(
      tap(() => this.clearCache())
    );
  }

  /** Call after logout or after creating a new type to force a fresh fetch. */
  clearCache(): void {
    this.cache$ = null;
  }
}
