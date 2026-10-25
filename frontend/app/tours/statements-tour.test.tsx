// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createStatementsTour } from './statements-tour';

type StatementsTourPayload = Parameters<typeof createStatementsTour>[0];

const readSource = (...segments: string[]) =>
  readFileSync(path.join(process.cwd(), ...segments), 'utf8');

/** Every non-test .tsx under `dir`, relative to the frontend root. */
const tsxSources = (dir: string): string[] =>
  readdirSync(path.join(process.cwd(), dir), { recursive: true, encoding: 'utf8' })
    .filter(file => file.endsWith('.tsx') && !file.endsWith('.test.tsx'))
    .map(file => path.join(dir, file));

describe('createStatementsTour', () => {
  const texts = {
    name: { value: 'Statements Tour' },
    description: { value: 'Learn how to upload and manage bank statements' },
    steps: {
      welcome: {
        title: { value: 'Welcome' },
        description: { value: 'Welcome description' },
      },
      uploadTrigger: {
        title: { value: 'Upload actions' },
        description: { value: 'Open upload actions' },
      },
      searchBar: {
        title: { value: 'Search' },
        description: { value: 'Search the list' },
      },
      filters: {
        title: { value: 'Filters' },
        description: { value: 'Filter the list' },
      },
      statementsList: {
        title: { value: 'List' },
        description: { value: 'List description' },
      },
      statementRow: {
        title: { value: 'Row' },
        description: { value: 'Row description' },
      },
      completed: {
        title: { value: 'Done' },
        description: { value: 'Done description' },
      },
    },
  };

  it('uses the current statements submit route and updated step selectors', () => {
    const tour = createStatementsTour(texts);

    expect(tour.page).toBe('/statements/submit');
    expect(tour.steps.map(step => step.selector)).toEqual([
      'body',
      '[data-tour-id="statements-upload-trigger"]',
      '[data-tour-id="statements-filters"]',
      '[data-tour-id="statements-table"]',
      '[data-tour-id="statement-row-primary"]',
      'body',
    ]);
    expect(tour.steps[2]?.optional).toBe(true);
    expect(tour.steps[4]?.optional).toBe(true);
  });

  it('supports intlayer payloads with content-wrapped steps', () => {
    const tour = createStatementsTour({ content: texts } as StatementsTourPayload);

    expect(tour.name).toBe('Statements Tour');
    expect(tour.steps[1]?.title).toBe('Upload actions');
    expect(tour.steps[1]?.description).toBe('Open upload actions');
  });

  it('supports legacy intlayer step keys from stale generated dictionaries', () => {
    const legacyTexts = {
      content: {
        name: { value: 'Statements Tour' },
        description: { value: 'Learn how to upload and manage bank statements' },
        steps: {
          welcome: {
            title: { value: 'Welcome' },
            description: { value: 'Welcome description' },
          },
          uploadButton: {
            title: { value: 'Upload actions' },
            description: { value: 'Open upload actions' },
          },
          searchBar: {
            title: { value: 'Search' },
            description: { value: 'Search the list' },
          },
          statusFilter: {
            title: { value: 'Filters' },
            description: { value: 'Filter the list' },
          },
          statementsTable: {
            title: { value: 'List' },
            description: { value: 'List description' },
          },
          viewDetails: {
            title: { value: 'Row' },
            description: { value: 'Row description' },
          },
          completed: {
            title: { value: 'Done' },
            description: { value: 'Done description' },
          },
        },
      },
    };

    const tour = createStatementsTour(legacyTexts as StatementsTourPayload);

    expect(tour.steps[1]?.title).toBe('Upload actions');
    expect(tour.steps[2]?.title).toBe('Filters');
    expect(tour.steps[3]?.title).toBe('List');
    expect(tour.steps[4]?.title).toBe('Row');
  });

  it('ships the updated content keys for all locales', () => {
    const source = readSource('app', 'tours', 'statements-tour.content.ts');

    const stepKeys = [
      'welcome',
      'uploadTrigger',
      'searchBar',
      'filters',
      'statementsList',
      'statementRow',
      'completed',
    ];

    stepKeys.forEach(stepKey => {
      expect(source).toContain(`${stepKey}: {`);
      expect(source).toContain(`${stepKey}: {\n        title: t({`);
      expect(source).toContain(`${stepKey}: {\n        title: t({\n          ru:`);
      expect(source).toContain(`${stepKey}: {\n        title: t({\n          ru:`);
      expect(source).toContain('description: t({');
    });

    expect(source).not.toContain('uploadButton: {');
    expect(source).not.toContain('statusFilter: {');
    expect(source).not.toContain('statementsTable: {');
    expect(source).not.toContain('statusBadges: {');
    expect(source).not.toContain('actions: {');
    expect(source).not.toContain('pagination: {');
    expect(source).not.toContain('viewDetails: {');

    const localeOccurrences = {
      ru: (source.match(/\bru:/g) ?? []).length,
      en: (source.match(/\ben:/g) ?? []).length,
      kk: (source.match(/\bkk:/g) ?? []).length,
    };

    expect(localeOccurrences.ru).toBeGreaterThanOrEqual(stepKeys.length * 2);
    expect(localeOccurrences.en).toBeGreaterThanOrEqual(stepKeys.length * 2);
    expect(localeOccurrences.kk).toBeGreaterThanOrEqual(stepKeys.length * 2);
  });

  it('keeps the expected statements page anchors in the current source', () => {
    const component = (name: string) =>
      readSource('app', '(main)', 'statements', 'components', name);

    // The list view composes the header (filters) and the table (rows).
    expect(component('StatementsListHeader.tsx')).toContain('data-tour-id="statements-filters"');
    expect(component('StatementsListView.tsx')).toContain('data-tour-id="statements-table"');
    expect(component('StatementsListTable.tsx')).toContain(
      "dataTourId={index === 0 ? 'statement-row-primary' : undefined}",
    );
    expect(component('StatementsListItem.tsx')).toContain('data-tour-id={dataTourId}');
  });
});

describe('StatementsUploadButton', () => {
  it('is the single carrier of the upload tour anchor', () => {
    const buttonSource = readSource(
      'app',
      '(main)',
      'statements',
      'components',
      'StatementsUploadButton.tsx',
    );

    expect(buttonSource).toContain('data-tour-id="statements-upload-trigger"');

    // One trigger, rendered in the page header of every statements view: no
    // placement variants left to pick an anchor between.
    const anchors = tsxSources('app').filter(file =>
      readSource(file).includes('data-tour-id="statements-upload-trigger"'),
    );

    expect(anchors).toEqual(['app/(main)/statements/components/StatementsUploadButton.tsx']);
  });
});
