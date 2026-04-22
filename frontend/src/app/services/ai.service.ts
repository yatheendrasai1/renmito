import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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

@Injectable({ providedIn: 'root' })
export class AiService {
  private readonly apiBase = `${environment.apiBase}/ai`;

  constructor(private http: HttpClient) {}

  parseLog(prompt: string, date: string): Observable<ParsedLog[]> {
    return this.http.post<ParsedLog[]>(`${this.apiBase}/parse-log`, { prompt, date });
  }
}
