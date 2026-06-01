import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'logger', pathMatch: 'full' },
  {
    path: 'logger',
    loadComponent: () =>
      import('./components/logger-view/logger-view.component').then(m => m.LoggerViewComponent),
  },
  {
    path: 'timeline',
    loadComponent: () =>
      import('./components/timeline-view/timeline-view.component').then(m => m.TimelineViewComponent),
  },
  {
    path: 'journeys',
    loadComponent: () =>
      import('./components/journeys/journeys.component').then(m => m.JourneysComponent),
  },
  {
    path: 'report',
    loadComponent: () =>
      import('./components/report/report.component').then(m => m.ReportComponent),
  },
  {
    path: 'configuration',
    loadComponent: () =>
      import('./components/configuration/configuration.component').then(m => m.ConfigurationComponent),
  },
  {
    path: 'intelligence',
    loadComponent: () =>
      import('./components/intelligence/intelligence.component').then(m => m.IntelligenceComponent),
  },
  {
    path: 'eagle-view',
    loadComponent: () =>
      import('./components/eagle-view/eagle-view.component').then(m => m.EagleViewComponent),
  },
  {
    path: 'diary',
    loadComponent: () =>
      import('./components/diary/diary.component').then(m => m.DiaryComponent),
  },
  {
    path: 'expense-guide/configuration',
    loadComponent: () =>
      import('./components/expense-guide-config/expense-guide-config.component').then(m => m.ExpenseGuideConfigComponent),
  },
  {
    path: 'expense-guide/expenses',
    loadComponent: () =>
      import('./components/expense-guide-expenses/expense-guide-expenses.component').then(m => m.ExpenseGuideExpensesComponent),
  },
  {
    path: 'external-configs/jira',
    loadComponent: () =>
      import('./components/jira-config/jira-config.component').then(m => m.JiraConfigComponent),
  },
];
