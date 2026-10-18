#!/usr/bin/env node
// Captures the screenshot fragments of the welcome tutorial from a workspace with demo data
// (the "Keller Design Studio" showcase workspace in the dev database) and writes them as
// public/tour/<locale>/<step>-<fragment>-<light|dark>.webp, where the guide loads them from.
//
//   TUTORIAL_SHOTS_EMAIL=... TUTORIAL_SHOTS_PASSWORD=... TUTORIAL_SHOTS_WORKSPACE_ID=... \
//     node scripts/capture-tutorial-screenshots.mjs [--only=dashboard,budgets] [--theme=dark] [--locale=en]
//
// Env: TUTORIAL_SHOTS_BASE_URL (default http://localhost:3002), TUTORIAL_SHOTS_OUT (default
// the locale's folder above), CHROME_PATH (default /usr/bin/chromium).
// Uses playwright-core (a devDependency) and sharp (installed with next).
//
// Nothing is saved server-side. Theme, locale and the owner's display name are swapped in the
// API responses the browser receives, so the account's own settings stay as they are.

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const env = process.env;
const baseUrl = env.TUTORIAL_SHOTS_BASE_URL ?? 'http://localhost:3002';
const workspaceId = required('TUTORIAL_SHOTS_WORKSPACE_ID');
const args = Object.fromEntries(
  process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=')),
);
// Only the output folder follows it so far: the app itself is still shown in English.
const locale = args.locale ?? 'en';
const outDir = path.resolve(
  env.TUTORIAL_SHOTS_OUT ??
    path.join(path.dirname(fileURLToPath(import.meta.url)), '../public/tour', locale),
);
const only = args.only?.split(',');
const themes = args.theme ? [args.theme] : ['light', 'dark'];

const DISPLAY_NAME = 'Anna Keller';
const DISPLAY_EMAIL = 'anna@kellerdesign.studio';
const MAIN = '.lumio-shell__content > main';

// Dev-only overlays, toasts and the text caret never belong in a screenshot.
const HIDE_CSS = `
nextjs-portal, #react-scan-root, [data-react-scan], [data-rht-toaster] { display: none !important; }
* { caret-color: transparent !important; scrollbar-width: none !important; }
`;

// Pages that are one column of cards anyway are captured narrower, the width they would have in
// a smaller window, so that a card fills its tutorial frame. Pages with grids keep their layout.
const narrow = width => `${MAIN} > * { max-width: ${width}px; }`;

// Frame proportions of the tutorial step layout (welcome-tutorial-steps.ts): with three fragments
// the first is the large frame and the other two share the column beside it; with two, both
// frames are alike. A fragment is cut to its frame's proportions, so the frame shows all of it.
const ASPECT = { hero: 1.55, side: 2.24, pair: 1.55 };

// Cards on these pages are plain boxes, so the card around a text is found by its border.
async function card(page, text) {
  const mark = `shot-${text.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  const found = await page.evaluate(
    ([root, needle, id]) => {
      const scope = document.querySelector(root) ?? document.body;
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
      const lower = needle.toLowerCase();
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (!node.textContent.toLowerCase().includes(lower)) {
          continue;
        }
        for (let el = node.parentElement; el && el !== scope; el = el.parentElement) {
          const style = getComputedStyle(el);
          if (parseFloat(style.borderTopWidth) > 0 && parseFloat(style.borderTopLeftRadius) > 4) {
            el.setAttribute('data-shot', id);
            return true;
          }
        }
      }
      return false;
    },
    [MAIN, text, mark],
  );
  if (!found) {
    throw new Error(`No card around "${text}"`);
  }
  return page.locator(`[data-shot="${mark}"]`);
}
const dialog = page => page.locator('.MuiDialog-paper, .MuiDrawer-paper').last();
const heading = (page, text) => page.locator(MAIN).getByText(text, { exact: true }).first();

/**
 * One entry per sidebar page, in sidebar order. A fragment starts at the top-left corner of the
 * union of its `target` boxes (minus `pad`); it is `width` wide (default: the union's width) and
 * as tall as its frame's proportions allow. It stays inside the page unless `clamp` is false
 * (dialogs and drawers).
 */
const STEPS = [
  {
    id: 'dashboard',
    path: '/dashboard',
    fragments: [
      {
        id: 'categories',
        frame: 'hero',
        target: page =>
          page.locator('section.lumio-dashboard__card', { hasText: 'Top categories' }),
      },
      {
        id: 'month',
        frame: 'side',
        target: page => page.locator('.lumio-dashboard__month-chips'),
        width: 572,
      },
      {
        id: 'recent',
        frame: 'side',
        target: page =>
          page.locator('section.lumio-dashboard__card', { hasText: 'Recent transactions' }),
      },
    ],
  },
  {
    id: 'statements',
    path: '/statements/submit',
    fragments: [
      {
        id: 'list',
        frame: 'pair',
        target: page => page.locator('.lumio-stmt-list-view__header'),
        width: 600,
      },
      {
        id: 'upload',
        frame: 'pair',
        path: '/statements?upload=1',
        target: dialog,
        clamp: false,
        pad: 0,
      },
    ],
  },
  {
    id: 'tables',
    path: '/custom-tables',
    fragments: [
      {
        id: 'list',
        frame: 'pair',
        target: page => page.locator('[data-tour-id="tables-list"]'),
        width: 600,
      },
      {
        id: 'grid',
        frame: 'pair',
        path: '/custom-tables/f1948171-2bea-4840-b561-5ee3ebfcb8b4',
        target: page => page.locator('[role="grid"], table').first(),
        width: 600,
      },
    ],
  },
  {
    id: 'workspaces',
    path: '/workspaces/list',
    fragments: [
      {
        id: 'list',
        frame: 'hero',
        target: page => page.getByPlaceholder('Search workspaces'),
        width: 600,
      },
      {
        id: 'invitations',
        frame: 'side',
        path: '/workspaces/members',
        target: page => card(page, 'Pending invitations'),
        width: 520,
      },
      {
        id: 'categories',
        frame: 'side',
        path: '/workspaces/categories',
        target: page => card(page, 'Bank fees'),
        width: 520,
      },
    ],
  },
  {
    id: 'reports',
    path: '/reports',
    fragments: [
      {
        id: 'templates',
        frame: 'hero',
        target: page => page.locator('[data-tour-id="reports-templates-grid"]'),
        width: 588,
      },
      {
        id: 'history',
        frame: 'side',
        prepare: page => page.getByRole('tab', { name: 'History' }).click(),
        target: page => page.locator(`${MAIN} table`).first(),
        width: 520,
      },
      {
        id: 'schedules',
        frame: 'side',
        prepare: page => page.getByRole('tab', { name: 'Schedules' }).click(),
        target: page => card(page, 'Schedule a report'),
        width: 520,
      },
    ],
  },
  {
    id: 'tax-declaration',
    path: '/tax-declaration',
    css: narrow(720),
    fragments: [
      {
        id: 'draft',
        frame: 'hero',
        prepare: page => page.getByRole('tab', { name: 'Draft' }).click(),
        target: page => page.getByText('Anlage EÜR · Germany', { exact: false }).first(),
        width: 656,
      },
      {
        id: 'profile',
        frame: 'side',
        prepare: page => page.getByRole('tab', { name: 'Profile' }).click(),
        target: page => page.getByRole('tab', { name: 'Profile' }),
        width: 520,
      },
      {
        id: 'checks',
        frame: 'side',
        prepare: page => page.getByRole('tab', { name: 'Data check' }).click(),
        target: page => page.getByText('100', { exact: true }).first(),
        width: 520,
      },
    ],
  },
  {
    id: 'net-worth',
    path: '/net-worth',
    css: narrow(552),
    fragments: [
      {
        id: 'chart',
        frame: 'hero',
        prepare: page => page.getByRole('button', { name: '1Y', exact: true }).click(),
        target: page => card(page, 'over period'),
      },
      { id: 'allocation', frame: 'side', target: page => card(page, 'Asset allocation') },
      { id: 'risk', frame: 'side', target: page => card(page, 'Risk and capital role') },
    ],
  },
  {
    id: 'budgets',
    path: '/budgets',
    css: narrow(552),
    fragments: [
      { id: 'cards', frame: 'pair', target: page => card(page, 'IT services') },
      { id: 'over', frame: 'pair', target: page => card(page, 'Marketing and advertising') },
    ],
  },
  {
    id: 'advice',
    path: '/advice',
    css: narrow(552),
    fragments: [
      { id: 'forecast', frame: 'pair', target: page => heading(page, 'Advice'), width: 520 },
      { id: 'prices', frame: 'pair', target: page => card(page, 'Figma now costs') },
    ],
  },
  {
    id: 'goals',
    path: '/goals',
    css: narrow(552),
    fragments: [
      { id: 'list', frame: 'pair', target: page => heading(page, 'Savings goals'), width: 520 },
      { id: 'progress', frame: 'pair', target: page => card(page, 'Lisbon workation') },
    ],
  },
  {
    id: 'roi',
    path: '/roi',
    css: narrow(552),
    prepare: async page => {
      const inputs = page.locator(`${MAIN} input`);
      await inputs.nth(0).fill('50000');
      await inputs.nth(1).fill('350');
      await inputs.nth(1).blur();
    },
    fragments: [
      { id: 'chart', frame: 'hero', target: page => card(page, '30-year projection') },
      { id: 'inputs', frame: 'side', target: page => card(page, 'Annual return'), width: 470 },
      {
        id: 'table',
        frame: 'side',
        target: page => page.getByText('Year', { exact: true }),
        width: 488,
      },
    ],
  },
  {
    id: 'subscriptions',
    path: '/subscriptions',
    fragments: [
      // The page formats its dates with a fixed ru-RU locale, so the month header row and the
      // "Next charge" column stay out of the frame.
      {
        id: 'calendar',
        frame: 'hero',
        target: page => page.locator('.lumio-charge-calendar tbody'),
        width: 740,
        pad: 0,
      },
      { id: 'kpis', frame: 'side', target: page => heading(page, 'Subscriptions'), width: 464 },
      {
        id: 'list',
        frame: 'side',
        target: page => page.getByRole('columnheader', { name: 'Vendor' }).last(),
        width: 440,
      },
    ],
  },
  {
    id: 'crypto',
    path: '/crypto',
    css: narrow(552),
    fragments: [
      {
        id: 'portfolio',
        frame: 'pair',
        target: page => heading(page, 'Crypto wallets'),
        width: 520,
      },
      {
        id: 'connect',
        frame: 'pair',
        prepare: page => page.getByRole('button', { name: 'Connect wallet' }).click(),
        target: dialog,
        clamp: false,
        pad: 0,
      },
    ],
  },
];

function required(name) {
  const value = env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

async function logIn(browser) {
  const context = await browser.newContext();
  const response = await context.request.post(`${baseUrl}/api/v1/auth/login`, {
    data: {
      email: required('TUTORIAL_SHOTS_EMAIL'),
      password: required('TUTORIAL_SHOTS_PASSWORD'),
    },
    timeout: 120_000,
  });
  if (!response.ok()) {
    throw new Error(`Login failed: ${response.status()}`);
  }
  const state = await context.storageState();
  await context.close();
  return state;
}

// The page reads its theme and locale from the profile, so the profile is what gets swapped.
function patchJson(url, json, theme) {
  if (url.pathname.endsWith('/auth/me')) {
    return {
      ...json,
      themePreference: theme,
      reduceMotion: true,
      locale: 'en',
      lastWorkspaceId: workspaceId,
      welcomeTutorialSeenAt: json.welcomeTutorialSeenAt ?? '2026-01-01T00:00:00.000Z',
    };
  }
  // Warnings open a banner above every page; Advice itself only lists `info`.
  if (url.pathname.endsWith('/insights') && Array.isArray(json.items)) {
    return { ...json, items: json.items.filter(item => item.severity === 'info') };
  }
  return json;
}

async function routeApi(context, theme, owner) {
  await context.route('**/api/v1/**', async route => {
    const response = await route.fetch();
    if (!(response.headers()['content-type'] ?? '').includes('application/json')) {
      return route.fulfill({ response });
    }
    const body = (await response.text())
      .replaceAll(owner.name, DISPLAY_NAME)
      .replaceAll(owner.email, DISPLAY_EMAIL)
      .replaceAll(owner.timeZone, 'Europe/Berlin');
    const json = body ? JSON.parse(body) : body;
    const url = new URL(route.request().url());
    return route.fulfill({ response, json: json ? patchJson(url, json, theme) : json });
  });
}

async function newThemeContext(browser, state, theme, owner) {
  const context = await browser.newContext({
    storageState: state,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    locale: 'en-US',
    timezoneId: 'Europe/Berlin',
    reducedMotion: 'reduce',
    colorScheme: theme,
  });
  await context.addCookies([{ name: 'INTLAYER_LOCALE', value: 'en', url: baseUrl }]);
  await context.addInitScript(
    ([id, preference]) => {
      localStorage.setItem('currentWorkspaceId', id);
      const stored = JSON.parse(localStorage.getItem('user') ?? '{}');
      localStorage.setItem('user', JSON.stringify({ ...stored, themePreference: preference }));
    },
    [workspaceId, theme],
  );
  await routeApi(context, theme, owner);
  return context;
}

async function settle(page, css) {
  await page.addStyleTag({ content: `${HIDE_CSS}${css ?? ''}` });
  // Both waits are best effort: live-update polling can keep the network busy, and a page may
  // legitimately keep a spinner somewhere; the fixed pause below covers what is left.
  await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => undefined);
  await page
    .waitForFunction(
      () =>
        !document.querySelector(
          '.MuiSkeleton-root, .MuiCircularProgress-root, [role="progressbar"]',
        ),
      null,
      { timeout: 30_000 },
    )
    .catch(() => undefined);
  await page.evaluate(() => document.fonts.ready);
  // Charts draw after their data arrives; there is no event to wait for.
  await page.waitForTimeout(1500);
}

async function open(page, step, target) {
  await page.goto(`${baseUrl}${target}`, { waitUntil: 'load', timeout: 120_000 });
  await settle(page, step.css);
  if (step.prepare && target === step.path) {
    await step.prepare(page);
    await settle(page, step.css);
  }
}

async function boxOf(page, locator) {
  await locator.first().scrollIntoViewIfNeeded({ timeout: 15_000 });
  const box = await locator.first().boundingBox();
  if (!box) {
    throw new Error(`No box for ${locator}`);
  }
  const scrollY = await page.evaluate(() => window.scrollY);
  return {
    x: box.x,
    y: box.y + scrollY,
    right: box.x + box.width,
    bottom: box.y + box.height + scrollY,
  };
}

async function clipFor(page, fragment) {
  const boxes = [];
  for (const locator of [await fragment.target(page)].flat()) {
    boxes.push(await boxOf(page, locator));
  }
  const pad = fragment.pad ?? 16;
  const clamp = fragment.clamp !== false;
  const main = clamp ? await boxOf(page, page.locator(MAIN)) : null;
  const x = Math.max(Math.min(...boxes.map(b => b.x)) - pad, main?.x ?? 0);
  const y = Math.max(Math.min(...boxes.map(b => b.y)) - pad, main?.y ?? 0);
  const width = fragment.width ?? Math.max(...boxes.map(b => b.right)) + pad - x;
  const right = Math.min(x + width, main?.right ?? Number.POSITIVE_INFINITY);
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(right - x),
    height: Math.round((right - x) / ASPECT[fragment.frame]),
  };
}

async function capture(page, step, fragment, theme) {
  const png = await page.screenshot({
    clip: await clipFor(page, fragment),
    fullPage: true,
    animations: 'disabled',
  });
  const file = path.join(outDir, `${step.id}-${fragment.id}-${theme}.webp`);
  const image = sharp(png).resize({ width: 1440, withoutEnlargement: true });
  const { width, height, size } = await image.webp({ quality: 80, effort: 6 }).toFile(file);
  console.log(`${path.basename(file)}  ${width}x${height}  ${Math.round(size / 1024)} KB`);
}

async function captureStep(context, step, theme) {
  const page = await context.newPage();
  let current = null;
  for (const fragment of step.fragments) {
    const target = fragment.path ?? step.path;
    if (target !== current || fragment.prepare) {
      await open(page, step, target);
      current = target;
    }
    if (fragment.prepare) {
      await fragment.prepare(page);
      await settle(page, step.css);
    }
    await capture(page, step, fragment, theme);
  }
  await page.close();
}

async function ownerOf(browser, state) {
  const context = await browser.newContext({ storageState: state });
  const response = await context.request.get(`${baseUrl}/api/v1/auth/me`);
  const me = await response.json();
  await context.close();
  return { name: me.name, email: me.email, timeZone: me.timeZone ?? 'Europe/Berlin' };
}

async function main() {
  await mkdir(outDir, { recursive: true });
  // Dates are formatted with the browser's own locale, which follows the OS unless forced.
  const browser = await chromium.launch({
    executablePath: env.CHROME_PATH ?? '/usr/bin/chromium',
    args: ['--lang=en-US'],
    env: { ...env, LANG: 'en_US.UTF-8', LANGUAGE: 'en_US' },
  });
  const state = await logIn(browser);
  const owner = await ownerOf(browser, state);
  for (const theme of themes) {
    const context = await newThemeContext(browser, state, theme, owner);
    for (const step of STEPS.filter(s => !only || only.includes(s.id))) {
      await captureStep(context, step, theme);
    }
    await context.close();
  }
  await browser.close();
}

await main();
