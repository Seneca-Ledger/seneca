import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createIntegrationsTour } from './integrations-tour';

type TourTextPayload = Parameters<typeof createIntegrationsTour>[0];

const readSource = (...segments: string[]) =>
  readFileSync(path.join(process.cwd(), ...segments), 'utf8');

describe('createIntegrationsTour', () => {
  const texts = {
    name: 'Integrations Tour',
    description: 'Connect external services',
    steps: {
      welcome: { title: 'Welcome', description: 'Welcome description' },
      search: { title: 'Search', description: 'Search description' },
      available: { title: 'Available', description: 'Available description' },
      completed: { title: 'Done', description: 'Done description' },
    },
  };

  it('uses the current integrations selector set', () => {
    const tour = createIntegrationsTour(texts as TourTextPayload);

    expect(tour.page).toBe('/integrations');
    expect(tour.steps.map(step => step.selector)).toEqual([
      'body',
      '[data-tour-id="integrations-search"]',
      '[data-tour-id="integrations-available"]',
      'body',
    ]);
  });

  it('supports legacy intlayer step keys from stale generated dictionaries', () => {
    const legacyTexts = {
      name: 'Integrations Tour',
      description: 'Connect external services',
      steps: {
        welcome: { title: 'Welcome', description: 'Welcome description' },
        completed: { title: 'Done', description: 'Done description' },
      },
    };

    const tour = createIntegrationsTour(legacyTexts as TourTextPayload);

    expect(tour.steps[1]?.title).toBe('Search Integrations');
    expect(tour.steps[2]?.title).toBe('Available Integrations');
    expect(tour.steps[3]?.title).toBe('Done');
  });

  it('keeps only the current integrations content keys', () => {
    const source = readSource('app', 'tours', 'integrations-tour.content.ts');

    expect(source).toContain('welcome: {');
    expect(source).toContain('search: {');
    expect(source).toContain('available: {');
    expect(source).not.toContain('googleSheets: {');
    expect(source).toContain('completed: {');

    expect(source).not.toContain('apiKeys: {');
    expect(source).not.toContain('webhooks: {');
    expect(source).not.toContain('connectionStatus: {');
    expect(source).toContain('ru:');
    expect(source).toContain('en:');
    expect(source).toContain('kk:');
  });

  it('keeps integrations anchors aligned with the panel source', () => {
    const source = readSource('app', 'integrations', 'panel', 'IntegrationsListDrawer.tsx');

    expect(source).toContain('tourId="integrations-search"');
    expect(source).toContain('data-tour-id="integrations-available"');
    expect(source).toContain('`integration-card-${entry.key}`');
  });
});
