import { describe, expect, it } from 'vitest';
import {
  PAGE_HINT_IDS,
  PAGE_HINTS,
  pageHintsVersion,
  resolveHintPage,
  stepsNewerThan,
  unseenSteps,
} from './page-hints';
import content from './page-hints.content';

type Translation = { translation: Record<string, string> };
type StepTexts = { title: Translation; body: Translation };
const texts = content.content.pages as unknown as Record<string, Record<string, StepTexts>>;

const words = (text: string): number => text.trim().split(/\s+/).length;
// Sentence ends: a full stop, ! or ?, not counting the one that closes the text.
const sentences = (text: string): number => (text.match(/[.!?](?=\s|$)/g) ?? []).length;

describe('page hints registry', () => {
  it('gives every page one to three steps with unique ids', () => {
    for (const page of PAGE_HINT_IDS) {
      const ids = PAGE_HINTS[page].steps.map(step => step.id);
      expect(ids.length, page).toBeGreaterThanOrEqual(1);
      expect(ids.length, page).toBeLessThanOrEqual(3);
      expect(new Set(ids).size, page).toBe(ids.length);
    }
  });

  it('has a short title and exactly one sentence for every step, in English and Russian', () => {
    for (const page of PAGE_HINT_IDS) {
      for (const step of PAGE_HINTS[page].steps) {
        const text = texts[page]?.[step.id];
        expect(text, `${page}.${step.id}`).toBeDefined();
        for (const locale of ['en', 'ru']) {
          const title = text.title.translation[locale];
          const body = text.body.translation[locale];
          expect(words(title), `${page}.${step.id} title (${locale}): ${title}`).toBeLessThanOrEqual(6);
          expect(sentences(body), `${page}.${step.id} body (${locale}): ${body}`).toBe(1);
          expect(body, `${page}.${step.id} body (${locale})`).toMatch(/[.!?]$/);
        }
      }
    }
  });

  it('has no texts for steps that do not exist', () => {
    for (const [page, steps] of Object.entries(texts)) {
      const ids = PAGE_HINTS[page as keyof typeof PAGE_HINTS].steps.map(step => step.id);
      expect(Object.keys(steps).sort(), page).toEqual([...ids].sort());
    }
  });

  it('uses page ids the server accepts', () => {
    for (const page of PAGE_HINT_IDS) {
      expect(page).toMatch(/^[a-z][a-zA-Z0-9]{0,39}$/);
    }
  });

  it('resolves pages by path, and only the page itself', () => {
    expect(resolveHintPage('/dashboard')).toBe('dashboard');
    expect(resolveHintPage('/statements/submit')).toBe('statements');
    expect(resolveHintPage('/statements/123/edit')).toBeNull();
    expect(resolveHintPage('/custom-tables')).toBe('tables');
    expect(resolveHintPage('/custom-tables/abc')).toBeNull();
    expect(resolveHintPage('/workspaces/overview')).toBe('workspaces');
    expect(resolveHintPage('/onboarding')).toBeNull();
    expect(resolveHintPage('/invite/token')).toBeNull();
  });

  it('shows only the steps newer than the version seen on that page', () => {
    const steps = PAGE_HINTS.budgets.steps;
    expect(unseenSteps('budgets', {})).toEqual(steps);
    expect(unseenSteps('budgets', { budgets: pageHintsVersion('budgets') })).toEqual([]);
    expect(unseenSteps('budgets', { dashboard: 5 })).toEqual(steps);
  });

  it('shows only a step added in a later version to someone who saw the first', () => {
    const steps = [
      { id: 'limit', since: 1, anchor: '#limit' },
      { id: 'rollover', since: 2, anchor: '#rollover' },
    ];
    expect(stepsNewerThan(steps, 1).map(step => step.id)).toEqual(['rollover']);
    expect(stepsNewerThan(steps, 0).map(step => step.id)).toEqual(['limit', 'rollover']);
  });
});
