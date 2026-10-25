import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSettingsTour } from './settings-tour';

type TourTextPayload = Parameters<typeof createSettingsTour>[0];

const readSource = (...segments: string[]) =>
  readFileSync(path.join(process.cwd(), ...segments), 'utf8');

describe('createSettingsTour', () => {
  const texts = {
    name: 'Workspace Tour',
    description: 'Manage workspace profile and defaults',
    steps: {
      welcome: { title: 'Welcome', description: 'Welcome description' },
      sidePanel: { title: 'Side panel', description: 'Side panel description' },
      workspaceName: { title: 'Name', description: 'Name description' },
      workspaceCurrency: { title: 'Currency', description: 'Currency description' },
      workspaceBackground: { title: 'Background', description: 'Background description' },
      completed: { title: 'Done', description: 'Done description' },
    },
  };

  it('uses the workspace overview route and current selector set', () => {
    const tour = createSettingsTour(texts as TourTextPayload);

    expect(tour.page).toBe('/workspaces/overview');
    expect(tour.autoStart).toBe(false);
    expect(tour.name).toBe('Workspace Tour');
    expect(tour.steps.map(step => step.selector)).toEqual([
      'body',
      '[data-tour-id="workspace-side-panel"]',
      '[data-tour-id="workspace-name"]',
      '[data-tour-id="workspace-currency"]',
      '[data-tour-id="workspace-background"]',
      'body',
    ]);
  });

  it('supports legacy intlayer step keys from stale generated dictionaries', () => {
    const legacyTexts = {
      name: 'Workspace Tour',
      description: 'Manage workspace profile and defaults',
      steps: {
        welcome: { title: 'Welcome', description: 'Welcome description' },
        completed: { title: 'Done', description: 'Done description' },
      },
    };

    const tour = createSettingsTour(legacyTexts as TourTextPayload);

    expect(tour.steps[1]?.title).toBe('Workspace Navigation');
    expect(tour.steps[2]?.title).toBe('Workspace Name');
    expect(tour.steps[3]?.title).toBe('Workspace Currency');
    expect(tour.steps[4]?.title).toBe('Workspace Background');
  });

  it('keeps only the current workspace overview content keys', () => {
    const source = readSource('app', 'tours', 'settings-tour.content.ts');

    expect(source).toContain('welcome: {');
    expect(source).toContain('sidePanel: {');
    expect(source).toContain('workspaceName: {');
    expect(source).toContain('workspaceCurrency: {');
    expect(source).toContain('workspaceBackground: {');
    expect(source).toContain('completed: {');

    expect(source).not.toContain('members: {');
    expect(source).not.toContain('inviteForm: {');
    expect(source).not.toContain('pendingInvitations: {');
    expect(source).toContain('ru:');
    expect(source).toContain('en:');
    expect(source).toContain('kk:');
  });

  it('keeps workspace overview anchors aligned with the current source', () => {
    const pageSource = readSource('app', '(main)', 'workspaces', 'overview', 'page.tsx');
    const viewSource = readSource(
      'app',
      '(main)',
      'workspaces',
      'components',
      'WorkspaceOverviewView.tsx',
    );

    expect(viewSource).toContain('data-tour-id="workspace-name"');
    expect(viewSource).toContain('data-tour-id="workspace-currency"');
    // The background card is a SettingsSection, which renders its tourId as the anchor.
    expect(viewSource).toContain('tourId="workspace-background"');
    expect(
      readSource('app', '(main)', 'workspaces', 'components', 'SettingsSection.tsx'),
    ).toContain('data-tour-id={tourId}');
    expect(pageSource).toContain('activeItem="overview"');
  });
});
