import { describe, expect, it } from 'vitest';
import { buildNavItems } from '@/app/components/navigation/helpers/navigation-config';
import { TUTORIAL_PAGES } from './welcome-tutorial-routes';
import { TUTORIAL_SCREENS } from './welcome-tutorial-screens';
import { buildTutorialSteps } from './welcome-tutorial-steps';
import stepTexts from './welcome-tutorial-steps.content';

// Labels are the dictionary keys themselves, which is enough to tell items apart.
const nav = new Proxy({}, { get: (_target, key) => String(key) }) as Parameters<
  typeof buildNavItems
>[0];

type StepText = { tagline: unknown; description: unknown; fragments: Record<string, unknown> };

describe('welcome tutorial steps', () => {
  it('covers every sidebar page except the experimental ones, in sidebar order', () => {
    const sidebar = buildNavItems(nav).filter(item => !item.experimental);
    expect(TUTORIAL_PAGES.map(page => page.path)).toEqual(sidebar.map(item => item.path));
  });

  it('skips pages the sidebar hides and keeps the order of the rest', () => {
    const visible = buildNavItems(nav).filter(item => item.path !== '/goals');
    const steps = buildTutorialSteps(visible, id => `title:${id}`);

    expect(steps.map(step => step.id)).not.toContain('goals');
    expect(steps.map(step => step.id).slice(0, 3)).toEqual(['dashboard', 'statements', 'budgets']);
    expect(steps[0]).toMatchObject({ path: '/dashboard', label: 'dashboard', title: 'title:dashboard' });
  });

  it('shows two or three fragments per step, the first one large when there are three', () => {
    for (const fragments of Object.values(TUTORIAL_SCREENS)) {
      const frames = fragments.map(fragment => fragment.frame);
      expect([
        ['pair', 'pair'],
        ['hero', 'side', 'side'],
      ]).toContainEqual(frames);
    }
  });

  it('has the texts of every step and a caption for every fragment', () => {
    const texts = stepTexts.content.steps as unknown as Record<string, StepText>;
    for (const page of TUTORIAL_PAGES) {
      const text = texts[page.id];
      expect(text?.tagline, page.id).toBeDefined();
      expect(text?.description, page.id).toBeDefined();
      expect(Object.keys(text.fragments).sort(), page.id).toEqual(
        TUTORIAL_SCREENS[page.id].map(fragment => fragment.id).sort(),
      );
    }
  });
});
