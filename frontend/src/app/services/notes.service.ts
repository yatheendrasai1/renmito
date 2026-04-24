import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface NoteItem {
  _id: string;
  content: string;
}

export interface DayNotes {
  date: string;
  notes: NoteItem[];
}

@Injectable({ providedIn: 'root' })
export class NotesService {
  private readonly apiBase = `${environment.apiBase}/notes`;

  // Session-persistent cache — never invalidated; cleared automatically on page reload.
  private cache = new Map<string, DayNotes>();

  constructor(private http: HttpClient) {}

  getNotes(date: string): Observable<DayNotes> {
    const hit = this.cache.get(date);
    if (hit) return of(hit);
    return this.http.get<DayNotes>(`${this.apiBase}/${date}`).pipe(
      tap(d => this.cache.set(date, d)),
      catchError(() => of({ date, notes: [] }))
    );
  }

  addNote(date: string): Observable<NoteItem> {
    return this.http.post<NoteItem>(`${this.apiBase}/${date}/notes`, {}).pipe(
      tap(n => {
        const cached = this.cache.get(date);
        if (cached) cached.notes.push(n);
      }),
      catchError(() => of({ _id: `tmp-${Date.now()}`, content: '' }))
    );
  }

  deleteNote(date: string, noteId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiBase}/${date}/notes/${noteId}`).pipe(
      tap(() => {
        const cached = this.cache.get(date);
        if (cached) cached.notes = cached.notes.filter(x => x._id !== noteId);
      }),
      catchError(() => of(undefined))
    );
  }

  updateNote(date: string, noteId: string, content: string): Observable<NoteItem> {
    return this.http.put<NoteItem>(`${this.apiBase}/${date}/notes/${noteId}`, { content }).pipe(
      tap(n => {
        const cached = this.cache.get(date);
        if (cached) {
          const idx = cached.notes.findIndex(x => x._id === noteId);
          if (idx !== -1) cached.notes[idx].content = n.content;
        }
      }),
      catchError(() => of({ _id: noteId, content }))
    );
  }
}
