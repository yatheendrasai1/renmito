import api from './api';

export interface JiraConfig {
  baseUrl:  string;
  email:    string;
  apiToken: string; // always '••••••••' when returned from server
}

export interface JiraTicket {
  id:          string;
  key:         string;
  summary:     string;
  status:      string;
  url:         string;
  assignee:    string | null;
  dueDate:     string | null;   // YYYY-MM-DD
  storyPoints: number | null;
  customer:    string | null;
}

export interface TicketQuery {
  _id:       string;
  name:      string;
  jql:       string;
  isValid:   boolean;
  sourceJql?: string; // only present on clone response — used to detect unmodified state
  createdAt: string;
  updatedAt: string;
}

export const jiraApi = {
  // ── Credentials ────────────────────────────────────────────────────────────
  getConfig: () =>
    api.get<JiraConfig>('/jira/config')
       .then(r => r.data)
       .catch(err => {
         if (err.response?.status === 204 || err.response?.status === 404) return null;
         throw err;
       }),

  saveConfig: (payload: { baseUrl: string; email: string; apiToken: string }) =>
    api.put<JiraConfig>('/jira/config', payload).then(r => r.data),

  deleteConfig: () =>
    api.delete('/jira/config'),

  testConnection: () =>
    api.post<{ displayName: string; accountId: string }>('/jira/test', {}).then(r => r.data),

  searchTickets: (jql: string) =>
    api.post<JiraTicket[]>('/jira/search', { jql }).then(r => r.data),

  // ── Stored Queries ─────────────────────────────────────────────────────────
  listQueries: () =>
    api.get<TicketQuery[]>('/jira/queries').then(r => r.data),

  createQuery: (name: string, jql: string) =>
    api.post<TicketQuery>('/jira/queries', { name, jql }).then(r => r.data),

  updateQuery: (id: string, name: string, jql: string) =>
    api.put<TicketQuery>(`/jira/queries/${id}`, { name, jql }).then(r => r.data),

  deleteQuery: (id: string) =>
    api.delete(`/jira/queries/${id}`),

  cloneQuery: (id: string) =>
    api.post<TicketQuery>(`/jira/queries/${id}/clone`).then(r => r.data),
};
