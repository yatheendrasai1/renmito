import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppLayout from '@/layouts/AppLayout';
import LoginPage from '@/pages/LoginPage';

// ── Route-level lazy loading ──────────────────────────────────────────────────
// Each `lazy` fn imports the page module on demand and returns { Component }.
// React Router shows nothing while the chunk loads — no explicit <Suspense> needed.

const lazyPage = (importFn: () => Promise<{ default: ComponentType }>) =>
  async () => {
    const mod = await importFn();
    return { Component: mod.default };
  };

export const router = createBrowserRouter([
  // ── Public ────────────────────────────────────────────────────────────────
  {
    path: '/login',
    element: <LoginPage />,
  },

  // ── Protected (all under AppLayout auth gate) ─────────────────────────────
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/logger" replace /> },

      { path: 'logger',      lazy: lazyPage(() => import('@/pages/LoggerPage')) },
      { path: 'timeline',    lazy: lazyPage(() => import('@/pages/TimelinePage')) },
      { path: 'journeys',    lazy: lazyPage(() => import('@/pages/JourneysPage')) },
      { path: 'report',      lazy: lazyPage(() => import('@/pages/ReportPage')) },
      { path: 'configuration', lazy: lazyPage(() => import('@/pages/ConfigurationPage')) },
      { path: 'intelligence',  lazy: lazyPage(() => import('@/pages/IntelligencePage')) },
      { path: 'eagle-view',    lazy: lazyPage(() => import('@/pages/EagleViewPage')) },
      { path: 'diary',         lazy: lazyPage(() => import('@/pages/DiaryPage')) },
      {
        path: 'expense-guide',
        children: [
          { path: 'configuration', lazy: lazyPage(() => import('@/pages/ExpenseGuideConfigPage')) },
          { path: 'expenses',      lazy: lazyPage(() => import('@/pages/ExpenseGuideExpensesPage')) },
        ],
      },
      {
        path: 'external-configs',
        children: [
          { path: 'jira', lazy: lazyPage(() => import('@/pages/JiraConfigPage')) },
        ],
      },
    ],
  },

  // ── Catch-all ─────────────────────────────────────────────────────────────
  { path: '*', element: <Navigate to="/" replace /> },
]);
