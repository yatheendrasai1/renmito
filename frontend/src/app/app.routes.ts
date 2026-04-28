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
];
