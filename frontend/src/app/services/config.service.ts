import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AccountConfig {
  geminiConfigured: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly apiBase = `${environment.apiBase}/config`;

  constructor(private http: HttpClient) {}

  getConfig(): Observable<AccountConfig> {
    return this.http.get<AccountConfig>(this.apiBase);
  }

  saveGeminiKey(apiKey: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.apiBase}/gemini-key`,
      { apiKey }
    );
  }
}
