import type { TourConfig } from './types';

/**
 * Integrations Tour
 */
export function createIntegrationsTour(texts: {
  name?: string;
  description?: string;
  steps: {
    welcome: { title: string; description: string };
    search?: { title: string; description: string };
    available?: { title: string; description: string };
    completed: { title: string; description: string };
  };
}): TourConfig {
  return {
    id: 'integrations-tour',
    name: texts.name ?? 'Integrations Tour',
    description: texts.description ?? 'Connecting external services',
    page: '/integrations',
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
        title: texts.steps.search?.title ?? 'Search Integrations',
        description:
          texts.steps.search?.description ??
          'Search integrations by name to quickly find the service you want to connect.',
        selector: '[data-tour-id="integrations-search"]',
        side: 'bottom',
        align: 'start',
      },
      {
        title: texts.steps.available?.title ?? 'Available Integrations',
        description:
          texts.steps.available?.description ??
          'Browse the available integration cards and compare the services you can connect.',
        selector: '[data-tour-id="integrations-available"]',
        side: 'top',
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
