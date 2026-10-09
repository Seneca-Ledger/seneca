import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createCustomTablesTour } from './custom-tables-tour';

type TourTextPayload = Parameters<typeof createCustomTablesTour>[0];

const readSource = (...segments: string[]) =>
  readFileSync(path.join(process.cwd(), ...segments), 'utf8');

describe('createCustomTablesTour', () => {
  const texts = {
    name: 'Custom Tables Tour',
    description: 'Build flexible data structures',
    steps: {
      welcome: { title: 'Welcome', description: 'Welcome description' },
      createExport: { title: 'Create export', description: 'Create export description' },
      search: { title: 'Search', description: 'Search description' },
      sourceFilter: { title: 'Source filter', description: 'Source filter description' },
      tablesList: { title: 'Tables list', description: 'Tables list description' },
      pagination: { title: 'Pagination', description: 'Pagination description' },
      completed: { title: 'Done', description: 'Done description' },
    },
  };

  it('uses the current custom tables selector set', () => {
    const tour = createCustomTablesTour(texts as TourTextPayload);

    expect(tour.page).toBe('/custom-tables');
    expect(tour.steps.map(step => step.selector)).toEqual([
      'body',
      '[data-tour-id="custom-tables-create-export"]',
      '[data-tour-id="search-bar"]',
      '[data-tour-id="custom-tables-source-filter"]',
      '[data-tour-id="tables-list"]',
      '[data-tour-id="pagination"]',
      'body',
    ]);
  });

  it('supports legacy intlayer step keys from stale generated dictionaries', () => {
    const legacyTexts = {
      name: 'Custom Tables Tour',
      description: 'Build flexible data structures',
      steps: {
        welcome: { title: 'Welcome', description: 'Welcome description' },
        fromStatement: { title: 'Create export', description: 'Create export description' },
        search: { title: 'Search', description: 'Search description' },
        tablesList: { title: 'Tables list', description: 'Tables list description' },
        completed: { title: 'Done', description: 'Done description' },
      },
    };

    const tour = createCustomTablesTour(legacyTexts as TourTextPayload);

    expect(tour.steps[1]?.title).toBe('Create export');
    expect(tour.steps[2]?.title).toBe('Search');
    expect(tour.steps[3]?.title).toBe('Source Filter');
    expect(tour.steps[5]?.title).toBe('Pagination');
  });

  it('keeps only the current custom tables content keys', () => {
    const source = readSource('app', 'tours', 'custom-tables-tour.content.ts');

    expect(source).toContain('welcome: {');
    expect(source).toContain('createExport: {');
    expect(source).toContain('search: {');
    expect(source).toContain('sourceFilter: {');
    expect(source).toContain('tablesList: {');
    expect(source).toContain('pagination: {');
    expect(source).toContain('completed: {');

    expect(source).not.toContain('tabsAll: {');
    expect(source).not.toContain('tabsManual: {');
    expect(source).not.toContain('createOptionEmpty: {');
    expect(source).not.toContain('createOptionFromStatement: {');
    expect(source).not.toContain('createDropdown: {');
    expect(source).toContain('ru:');
    expect(source).toContain('en:');
    expect(source).toContain('kk:');
  });

  it('keeps custom tables page anchors aligned with the current page source', () => {
    const pageSource = readSource('app', '(main)', 'custom-tables', 'page.tsx');

    expect(pageSource).toContain('data-tour-id="search-bar"');
    expect(pageSource).toContain('data-tour-id="tables-list"');
    expect(pageSource).toContain('data-tour-id="pagination"');
    expect(pageSource).toContain('data-tour-id="custom-tables-create-export"');
    expect(pageSource).toContain('data-tour-id="custom-tables-source-filter"');
  });
});
