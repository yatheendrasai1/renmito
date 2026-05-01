import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface ParsedLog {
  logTypeId:   string;
  logTypeName: string;
  domain:      string;
  entryType:   'range' | 'point';
  pointTime:   string | null;
  startTime:   string | null;
  endTime:     string | null;
  title:       string;
}

export interface ChatResponse {
  type: 'logs' | 'answer';
  text?: string;
  logs?: ParsedLog[];
}

export interface RenniMessage {
  from:      'user' | 'renni';
  text?:     string;
  logs?:     ParsedLog[];
  thinking?: boolean;
  confirmed?: boolean;
  saving?:   boolean;
  error?:    string;
  isError?:  boolean;
  errorCode?: string;
}

export type AiErrorCode =
  | 'NO_API_KEY'
  | 'GEMINI_API_ERROR'
  | 'PARSE_ERROR'
  | 'EMPTY_RESPONSE'
  | 'UNRECOGNISED_TYPE'
  | 'NETWORK_ERROR'
  | 'INVALID_INPUT'
  | 'UNKNOWN';

export interface AiError {
  message: string;
  code: AiErrorCode;
  status: number;
}

@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly apiBase = `${environment.apiBase}/ai`;

  constructor(private http: HttpClient) {}

  parseLog(prompt: string, date: string): Observable<ParsedLog[]> {
    return this.http.post<ParsedLog[]>(`${this.apiBase}/parse-log`, { prompt, date }).pipe(
      catchError(this._handleError)
    );
  }

  chat(message: string, date: string): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(`${this.apiBase}/chat`, { message, date }).pipe(
      catchError(this._handleError)
    );
  }

  private _handleError(err: HttpErrorResponse): Observable<never> {
    const code: AiErrorCode = err.error?.code || (err.status === 0 ? 'NETWORK_ERROR' : 'UNKNOWN');
    const message: string =
      err.status === 0
        ? 'Could not reach the server. Check your connection.'
        : err.error?.error || err.message || 'Something went wrong. Please try again.';

    console.error(`[AI] HTTP ${err.status} [${code}]:`, message);
    return throwError(() => ({ message, code, status: err.status } as AiError));
  }
}
