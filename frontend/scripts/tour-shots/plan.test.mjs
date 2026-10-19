import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FRAME_ASPECT as GUIDE_ASPECT,
  TUTORIAL_SCREENS,
} from '../../app/components/welcome-tutorial/welcome-tutorial-screens';
import {
  clipFor,
  FRAME_ASPECT,
  inPool,
  kebab,
  localesFromConfig,
  outputWidth,
  parseArgs,
  resolveLocales,
  steadyJson,
} from './plan.mjs';
import { buildSteps } from './steps.mjs';

// Tests run from frontend/.
const configSource = readFileSync(path.join(process.cwd(), 'intlayer.config.ts'), 'utf8');

describe('guide screenshot plan', () => {
  it('reads flags and values from the command line', () => {
    expect(parseArgs(['--locale=ru,de', '--theme=dark', '--dry', 'stray'])).toEqual({
      locale: 'ru,de',
      theme: 'dark',
      dry: true,
    });
  });

  it('reads every locale of the intlayer config', () => {
    const locales = localesFromConfig(configSource);
    expect(locales).toHaveLength(35);
    expect(locales.slice(0, 2)).toEqual(['ru', 'en']);
    expect(locales).toContain('hsb');
  });

  it('resolves all, a list or nothing to locales, and refuses unknown ones', () => {
    const configured = ['ru', 'en', 'de'];
    expect(resolveLocales(undefined, configured)).toEqual(['en']);
    expect(resolveLocales('all', configured)).toEqual(['ru', 'en', 'de']);
    expect(resolveLocales('de,ru', configured)).toEqual(['de', 'ru']);
    expect(() => resolveLocales('en,xx', configured)).toThrow('xx');
  });

  it('names files after the page in kebab case', () => {
    expect(kebab('taxDeclaration')).toBe('tax-declaration');
    expect(kebab('roi')).toBe('roi');
  });

  it('cuts a fragment from the union of its boxes to its frame proportions', () => {
    const boxes = [
      { x: 100, y: 200, right: 400, bottom: 260 },
      { x: 120, y: 280, right: 500, bottom: 300 },
    ];
    expect(clipFor(boxes, { frame: 'pair' })).toEqual({ x: 84, y: 184, width: 432, height: 279 });
    expect(clipFor(boxes, { frame: 'side', width: 448, pad: 0 })).toEqual({
      x: 100,
      y: 200,
      width: 448,
      height: 200,
    });
  });

  it('keeps a fragment inside the page bounds', () => {
    const boxes = [{ x: 60, y: 10, right: 900, bottom: 50 }];
    const bounds = { x: 80, y: 0, right: 700, bottom: 2000 };
    expect(clipFor(boxes, { frame: 'hero', bounds })).toEqual({
      x: 80,
      y: 0,
      width: 620,
      height: 400,
    });
  });

  it('saves no more pixels than one and a half times the drawn frame', () => {
    expect(outputWidth('hero', 1480)).toBe(990);
    expect(outputWidth('side', 1200)).toBe(690);
    expect(outputWidth('pair', 600)).toBe(600);
  });

  it('settles timestamps after the anchor and drops generated avatars', () => {
    const now = new Date('2026-09-28T12:00:00Z');
    const json = {
      items: [
        { createdAt: '2026-10-18T10:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
        { user: { avatarUrl: 'https://api.dicebear.com/x?seed=1', name: 'Alex' } },
      ],
      date: '2026-10-18',
    };
    expect(steadyJson(json, now)).toEqual({
      items: [
        { createdAt: '2026-09-28T09:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' },
        { user: { avatarUrl: null, name: 'Alex' } },
      ],
      date: '2026-10-18',
    });
  });

  it('runs no more tasks at once than the limit', async () => {
    let running = 0;
    let peak = 0;
    const done = [];
    await inPool([1, 2, 3, 4, 5], 2, async item => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise(resolve => setTimeout(resolve, 5));
      done.push(item);
      running -= 1;
    });
    expect(peak).toBe(2);
    expect(done.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('uses the guide frame proportions', () => {
    expect(FRAME_ASPECT).toEqual(GUIDE_ASPECT);
  });

  it('captures exactly the fragments the guide shows, in its frames', () => {
    const steps = buildSteps({ month: '2026-09' });
    const captured = Object.fromEntries(
      steps.map(step => [step.id, step.fragments.map(({ id, frame }) => ({ id, frame }))]),
    );
    expect(captured).toEqual(TUTORIAL_SCREENS);
  });
});
