import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PromptDoc {
  _id:     string;
  content: string;
  type:    string;
}

export interface SystemPromptDoc {
  promptId: string;
  type:     string;
  content:  string;
}

@Injectable({ providedIn: 'root' })
export class PromptService {
  private readonly promptsBase      = `${environment.apiBase}/prompts`;
  private readonly sysPromptsBase   = `${environment.apiBase}/systemprompts`;

  constructor(private http: HttpClient) {}

  createCustomPrompt(payload: { content: string; insightId?: string }): Observable<PromptDoc> {
    return this.http.post<PromptDoc>(this.promptsBase, payload);
  }

  updateCustomPrompt(promptId: string, content: string): Observable<PromptDoc> {
    return this.http.patch<PromptDoc>(`${this.promptsBase}/${promptId}`, { content });
  }

  getSystemPrompt(promptId: string): Observable<SystemPromptDoc> {
    return this.http.get<SystemPromptDoc>(`${this.sysPromptsBase}/${promptId}`);
  }
}
