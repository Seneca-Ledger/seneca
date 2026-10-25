import type { TourConfig } from './types';

/**
 * Admin Panel Tour
 */
export function createAdminTour(texts: {
  name?: string;
  description?: string;
  steps: {
    welcome: { title: string; description: string };
    auditFilters?: { title: string; description: string };
    auditLog?: { title: string; description: string };
    completed: { title: string; description: string };
  };
}): TourConfig {
  const auditFiltersStep = texts.steps.auditFilters ?? texts.steps.auditLog;

  return {
    id: 'admin-tour',
    name: texts.name ?? 'Admin Panel Tour',
    description: texts.description ?? 'System management and monitoring',
    page: '/admin',
    autoStart: false,
    steps: [
      {
        title: texts.steps.welcome.title,
        description: texts.steps.welcome.description,
        selector: 'body',
        side: 'bottom',
        align: 'center',
      },
      {
        title: auditFiltersStep?.title ?? 'Audit Filters',
        description:
          auditFiltersStep?.description ??
          'Use the audit filters to narrow activity history to the events you need to inspect.',
        selector: '[data-tour-id="admin-audit-filters"]',
        side: 'left',
        align: 'center',
      },
      {
        title: texts.steps.completed.title,
        description: texts.steps.completed.description,
        selector: 'body',
        side: 'bottom',
        align: 'center',
      },
    ],
  };
}
