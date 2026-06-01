import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface JiraConfig {
  baseUrl:  string;
  email:    string;
  apiToken: string; // always '••••••••' when read from server
}

export interface JiraTicket {
  id:      string;
  key:     string;
  summary: string;
  status:  string;
  url:     string;
}

@Injectable({ providedIn: 'root' })
export class JiraService {
  private readonly base = `${environment.apiBase}/jira`;

  constructor(private http: HttpClient) {}

  getConfig(): Observable<JiraConfig | null> {
    return this.http.get<JiraConfig>(`${this.base}/config`).pipe(
      catchError(err => {
        if (err.status === 204 || err.status === 404) return of(null);
        throw err;
      })
    );
  }

  saveConfig(config: { baseUrl: string; email: string; apiToken: string }): Observable<JiraConfig> {
    return this.http.put<JiraConfig>(`${this.base}/config`, config);
  }

  deleteConfig(): Observable<void> {
    return this.http.delete<void>(`${this.base}/config`);
  }

  testConnection(): Observable<{ displayName: string; accountId: string }> {
    return this.http.post<{ displayName: string; accountId: string }>(`${this.base}/test`, {});
  }

  searchTickets(jql: string, maxResults = 3): Observable<JiraTicket[]> {
    return this.http.post<JiraTicket[]>(`${this.base}/search`, { jql, maxResults });
  }
}
