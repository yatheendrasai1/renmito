import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NoteItem {
  _id:           string;
  content:       string;
  type:          'regular' | 'tapper';
  timestamp?:    string;
  logTypeId?:    string | null;
  logTypeName?:  string | null;
  domain?:       string | null;
  logTypeColor?: string | null;
}

export interface DayNotes {
  date:  string;
  notes: NoteItem[];
}

// ── Query key ─────────────────────────────────────────────────────────────────

export const notesKey = (date: string) => ['notes', date] as const;

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchNotes(date: string): Promise<DayNotes> {
  const res = await api.get<DayNotes>(`/notes/${date}`);
  return res.data;
}

export function useNotes(date: string) {
  return useQuery({
    queryKey: notesKey(date),
    queryFn:  () => fetchNotes(date),
    enabled:  !!date,
    staleTime: 0,   // always fresh — notes change frequently
  });
}

// ── Add note ──────────────────────────────────────────────────────────────────

interface AddNotePayload {
  type?:    'regular' | 'tapper';
  content?: string;
}

export function useAddNote(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AddNotePayload = {}) =>
      api.post<NoteItem>(`/notes/${date}/notes`, payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKey(date) }),
  });
}

// ── Update note content ───────────────────────────────────────────────────────

export function useUpdateNote(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, content }: { noteId: string; content: string }) =>
      api.put<NoteItem>(`/notes/${date}/notes/${noteId}`, { content }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKey(date) }),
  });
}

// ── Update tapper log type ────────────────────────────────────────────────────

interface TapperLogTypePayload {
  logTypeId:    string;
  logTypeName:  string;
  domain:       string;
  logTypeColor: string;
}

export function useUpdateTapperLogType(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ noteId, ...data }: { noteId: string } & TapperLogTypePayload) =>
      api.patch<NoteItem>(`/notes/${date}/notes/${noteId}/logtype`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKey(date) }),
  });
}

// ── Delete note ───────────────────────────────────────────────────────────────

export function useDeleteNote(date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) =>
      api.delete(`/notes/${date}/notes/${noteId}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: notesKey(date) }),
  });
}
