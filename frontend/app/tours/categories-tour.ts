import type { TourConfig } from './types';

/**
 * Categories Tour
 */
export function createCategoriesTour(texts: {
  name?: string;
  description?: string;
  steps: {
    welcome: { title: string; description: string };
    addButton?: { title: string; description: string };
    createButton?: { title: string; description: string };
    search?: { title: string; description: string };
    categoriesList: { title: string; description: string };
    categoryToggle?: { title: string; description: string };
    completed: { title: string; description: string };
  };
}): TourConfig {
  const addButtonStep = texts.steps.addButton ?? texts.steps.createButton;

  return {
    id: 'categories-tour',
    name: texts.name ?? 'Categories Tour',
    description: texts.description ?? 'Organizing transactions and files',
    page: '/categories',
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
        title: addButtonStep?.title ?? 'Add Category',
        description:
          addButtonStep?.description ??
          'Create a new category when you need another way to group transactions or files.',
        selector: '[data-tour-id="categories-add-button"]',
        side: 'bottom',
        align: 'end',
      },
      {
        title: texts.steps.search?.title ?? 'Search',
        description:
          texts.steps.search?.description ??
          'Search existing categories to quickly find the one you want to edit or review.',
        selector: '[data-tour-id="categories-search"]',
        side: 'bottom',
        align: 'start',
      },
      {
        title: texts.steps.categoriesList.title,
        description: texts.steps.categoriesList.description,
        selector: '[data-tour-id="categories-list"]',
        side: 'top',
        align: 'center',
      },
      {
        title: texts.steps.categoryToggle?.title ?? 'Category Toggle',
        description:
          texts.steps.categoryToggle?.description ??
          'Use the first category row to inspect the enabled state and available actions.',
        selector: '[data-tour-id="category-toggle"]',
        optional: true,
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
