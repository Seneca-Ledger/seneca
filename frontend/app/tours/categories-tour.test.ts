import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createCategoriesTour } from './categories-tour';

type TourTextPayload = Parameters<typeof createCategoriesTour>[0];

const readSource = (...segments: string[]) =>
  readFileSync(path.join(process.cwd(), ...segments), 'utf8');

describe('createCategoriesTour', () => {
  const texts = {
    name: 'Categories Tour',
    description: 'Organize transactions and files',
    steps: {
      welcome: { title: 'Welcome', description: 'Welcome description' },
      addButton: { title: 'Add', description: 'Add description' },
      search: { title: 'Search', description: 'Search description' },
      categoriesList: { title: 'List', description: 'List description' },
      categoryToggle: { title: 'Toggle', description: 'Toggle description' },
      completed: { title: 'Done', description: 'Done description' },
    },
  };

  it('uses the current categories route and selector set', () => {
    const tour = createCategoriesTour(texts as TourTextPayload);

    expect(tour.page).toBe('/categories');
    expect(tour.steps.map(step => step.selector)).toEqual([
      'body',
      '[data-tour-id="categories-add-button"]',
      '[data-tour-id="categories-search"]',
      '[data-tour-id="categories-list"]',
      '[data-tour-id="category-toggle"]',
      'body',
    ]);
  });

  it('supports legacy intlayer step keys from stale generated dictionaries', () => {
    const legacyTexts = {
      name: 'Categories Tour',
      description: 'Organize transactions and files',
      steps: {
        welcome: { title: 'Welcome', description: 'Welcome description' },
        createButton: { title: 'Add', description: 'Add description' },
        categoriesList: { title: 'List', description: 'List description' },
        completed: { title: 'Done', description: 'Done description' },
      },
    };

    const tour = createCategoriesTour(legacyTexts as TourTextPayload);

    expect(tour.steps[1]?.title).toBe('Add');
    expect(tour.steps[2]?.title).toBe('Search');
    expect(tour.steps[4]?.title).toBe('Category Toggle');
  });

  it('keeps only the current categories content keys', () => {
    const source = readSource('app', 'tours', 'categories-tour.content.ts');

    expect(source).toContain('welcome: {');
    expect(source).toContain('addButton: {');
    expect(source).toContain('search: {');
    expect(source).toContain('categoriesList: {');
    expect(source).toContain('categoryToggle: {');
    expect(source).toContain('completed: {');

    expect(source).not.toContain('createButton: {');
    expect(source).not.toContain('colorPicker: {');
    expect(source).not.toContain('iconPicker: {');
    expect(source).toContain('ru:');
    expect(source).toContain('en:');
    expect(source).toContain('kk:');
  });

  it('keeps categories page anchors aligned with the categories page', () => {
    const source = readSource('app', '(main)', 'categories', 'page.tsx');

    expect(source).toContain('data-tour-id="categories-add-button"');
    expect(source).toContain('data-tour-id="categories-search"');
    expect(source).toContain('data-tour-id="categories-list"');
    expect(source).toContain("data-tour-id={tourAnchor ? 'category-toggle' : undefined}");
  });
});
