import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface FoodInsightRecord {
  _id:      string;
  logId:    string;
  date:     string;
  mealType: string;
  status:   'pending' | 'done' | 'error';
  analysis: string;
  error:    string | null;
}

@Injectable({ providedIn: 'root' })
export class FoodInsightService {
  private readonly apiBase = `${environment.apiBase}/food-insights`;

  constructor(private http: HttpClient) {}

  getByLogId(logId: string): Observable<FoodInsightRecord | null> {
    return this.http
      .get<FoodInsightRecord>(`${this.apiBase}/${logId}`)
      .pipe(catchError(() => of(null)));
  }

  getByDate(date: string): Observable<FoodInsightRecord[]> {
    return this.http
      .get<FoodInsightRecord[]>(`${this.apiBase}?date=${date}`)
      .pipe(catchError(() => of([])));
  }

  generate(logId: string): Observable<FoodInsightRecord | null> {
    return this.http
      .post<FoodInsightRecord>(`${this.apiBase}/${logId}/generate`, {})
      .pipe(catchError(() => of(null)));
  }
}
