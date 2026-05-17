import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface Expense {
  _id:           string;
  userId:        string;
  amount:        number;
  currency:      string;
  merchant:      string;
  category:      string;
  description:   string;
  date:          string;
  entryType:     'manual' | 'automatic';
  smsRaw:        string;
  smsSender:     string;
  paymentMethod: string;
  referenceId:   string;
  tags:          string[];
  createdAt:     string;
  updatedAt:     string;
}

export interface ExpenseListResult {
  items: Expense[];
  total: number;
  page:  number;
  limit: number;
}

export interface ExpenseGuideSettings {
  smsListenerEnabled:  boolean;
  notificationEnabled: boolean;
  testListenerEnabled: boolean;
  currency:            string;
  defaultCategory:     string;
}

export type CreateExpensePayload = Partial<Omit<Expense, '_id' | 'userId' | 'createdAt' | 'updatedAt'>>;

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private readonly api = `${environment.apiBase}/expenses`;
  private readonly prefsApi = `${environment.apiBase}/preferences`;

  constructor(private http: HttpClient) {}

  list(params: {
    startDate?: string;
    endDate?:   string;
    entryType?: 'manual' | 'automatic';
    page?:      number;
    limit?:     number;
  } = {}): Observable<ExpenseListResult> {
    let p = new HttpParams();
    if (params.startDate) p = p.set('startDate', params.startDate);
    if (params.endDate)   p = p.set('endDate',   params.endDate);
    if (params.entryType) p = p.set('entryType', params.entryType);
    if (params.page)      p = p.set('page',  String(params.page));
    if (params.limit)     p = p.set('limit', String(params.limit));

    return this.http.get<ExpenseListResult>(this.api, { params: p }).pipe(
      catchError(() => of({ items: [], total: 0, page: 1, limit: 50 }))
    );
  }

  get(id: string): Observable<Expense | null> {
    return this.http.get<Expense>(`${this.api}/${id}`).pipe(
      catchError(() => of(null))
    );
  }

  create(payload: CreateExpensePayload): Observable<Expense | null> {
    return this.http.post<Expense>(this.api, payload).pipe(
      catchError(() => of(null))
    );
  }

  update(id: string, payload: Partial<Expense>): Observable<Expense | null> {
    return this.http.put<Expense>(`${this.api}/${id}`, payload).pipe(
      catchError(() => of(null))
    );
  }

  delete(id: string): Observable<boolean> {
    return this.http.delete(`${this.api}/${id}`).pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }

  /** Send a batch of auto-parsed SMS expense entries to the backend. */
  bulkCreate(entries: CreateExpensePayload[]): Observable<{ created: number } | null> {
    return this.http.post<{ created: number }>(`${this.api}/bulk`, { entries }).pipe(
      catchError(() => of(null))
    );
  }

  getSettings(): Observable<ExpenseGuideSettings> {
    return this.http.get<any>(`${this.prefsApi}`).pipe(
      map(prefs => prefs?.expenseGuide ?? this.defaultSettings()),
      catchError(() => of(this.defaultSettings()))
    );
  }

  saveSettings(settings: Partial<ExpenseGuideSettings>): Observable<ExpenseGuideSettings | null> {
    return this.http.put<{ expenseGuide: ExpenseGuideSettings }>(
      `${this.prefsApi}/expense-guide`, settings
    ).pipe(
      map(res => res?.expenseGuide ?? null),
      catchError(() => of(null))
    );
  }

  private defaultSettings(): ExpenseGuideSettings {
    return { smsListenerEnabled: false, notificationEnabled: true, testListenerEnabled: false, currency: 'INR', defaultCategory: 'Uncategorized' };
  }
}
