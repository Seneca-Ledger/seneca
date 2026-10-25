import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createAdminTour } from './admin-tour';

type TourTextPayload = Parameters<typeof createAdminTour>[0];

const readSource = (...segments: string[]) =>
  readFileSync(path.join(process.cwd(), ...segments), 'utf8');

describe('createAdminTour', () => {
  const texts = {
    name: 'Admin Panel Tour',
    description: 'System management and monitoring',
    steps: {
      welcome: { title: 'Welcome', description: 'Welcome description' },
      auditFilters: { title: 'Audit', description: 'Audit description' },
      completed: { title: 'Done', description: 'Done description' },
    },
  };

  it('uses the current admin selector set', () => {
    const tour = createAdminTour(texts as TourTextPayload);

    expect(tour.page).toBe('/admin');
    expect(tour.steps.map(step => step.selector)).toEqual([
      'body',
      '[data-tour-id="admin-audit-filters"]',
      'body',
    ]);
  });

  it('supports legacy intlayer step keys from stale generated dictionaries', () => {
    const legacyTexts = {
      name: 'Admin Panel Tour',
      description: 'System management and monitoring',
      steps: {
        welcome: { title: 'Welcome', description: 'Welcome description' },
        auditLog: { title: 'Audit', description: 'Audit description' },
        completed: { title: 'Done', description: 'Done description' },
      },
    };

    const tour = createAdminTour(legacyTexts as TourTextPayload);

    expect(tour.steps[1]?.title).toBe('Audit');
  });

  it('keeps only the current admin content keys', () => {
    const source = readSource('app', 'tours', 'admin-tour.content.ts');

    expect(source).toContain('welcome: {');
    expect(source).toContain('auditFilters: {');
    expect(source).toContain('completed: {');

    expect(source).not.toContain('usersManagement: {');
    expect(source).not.toContain('workspacesOverview: {');
    expect(source).not.toContain('systemSettings: {');
    expect(source).not.toContain('monitoring: {');
    expect(source).not.toContain('auditLog: {');
    // The page is the audit log alone since April: no tabs, statements log or users link.
    expect(source).not.toContain('tabs: {');
    expect(source).not.toContain('statementsLog: {');
    expect(source).not.toContain('usersLink: {');
  });

  it('keeps admin page anchors aligned with the current source', () => {
    const source = readSource('app', 'admin', 'page.tsx');

    expect(source).toContain('data-tour-id="admin-audit-filters"');
  });
});
