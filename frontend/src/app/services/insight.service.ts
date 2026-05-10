import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { InsightCard, InsightDetail } from '../models/insight.model';

@Injectable({ providedIn: 'root' })
export class InsightService {
  private readonly base = `${environment.apiBase}/insights`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<InsightCard[]> {
    return this.http.get<InsightCard[]>(this.base);
  }

  getById(insightId: string): Observable<InsightDetail> {
    return this.http.get<InsightDetail>(`${this.base}/${insightId}`);
  }

  createUserInsight(payload: {
    label:    string;
    name:     string;
    model?:   string;
    type?:    string;
    promptId?: string;
  }): Observable<InsightDetail> {
    return this.http.post<InsightDetail>(this.base, payload);
  }

  update(insightId: string, patch: {
    type?:     string;
    model?:    string;
    promptId?: string;
    enabled?:  boolean;
  }): Observable<InsightDetail> {
    return this.http.patch<InsightDetail>(`${this.base}/${insightId}`, patch);
  }

  analyze(
    insightId: string,
    period: 'today' | 'yesterday' | 'last7days' | 'custom',
    startDate?: string,
    endDate?: string
  ): Observable<AnalyzeResult> {
    const body: Record<string, string> = { period };
    if (startDate) body['startDate'] = startDate;
    if (endDate)   body['endDate']   = endDate;
    return this.http.post<AnalyzeResult>(`${this.base}/${insightId}/analyze`, body);
  }
}

export interface AnalyzeLogSummary {
  title:       string;
  logTypeName: string;
  startAt:     string;
  endAt:       string | null;
  entryType:   string;
}

export interface AnalyzeResult {
  period:       string;
  startDate:    string;
  endDate:      string;
  foodLogCount: number;
  logs:         AnalyzeLogSummary[];
  text:         string;
}
