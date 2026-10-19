#!/usr/bin/env node
// Captures the screenshot fragments of the guide (welcome tutorial) from a demo workspace and
// writes them as public/tour/<locale>/<step>-<fragment>-<light|dark>.webp, where the guide
// loads them from. CI runs it on a fresh stack (.github/workflows/tour-screenshots.yml, account
// from scripts/tour-shots-setup.mjs); it works the same against a local stand:
//
//   TUTORIAL_SHOTS_EMAIL=... TUTORIAL_SHOTS_PASSWORD=... TUTORIAL_SHOTS_ANCHOR_DATE=2026-09-28 \
//     node scripts/capture-tutorial-screenshots.mjs [--locale=en|ru,de|all] [--theme=dark]
//       [--only=dashboard,budgets] [--concurrency=3]
//
// Env: TUTORIAL_SHOTS_BASE_URL (default http://localhost:3000, the API under /api/v1 of it),
// TUTORIAL_SHOTS_WORKSPACE_ID (default: the account's demo workspace, made if missing and
// then named TUTORIAL_SHOTS_DEMO_NAME),
// TUTORIAL_SHOTS_ANCHOR_DATE (or DEMO_DATA_ANCHOR_DATE: the day the demo data ends on; the
// browser's clock is set to its noon UTC, and the backend's should be too — see
// scripts/tour-shots/fake-now.cjs), TUTORIAL_SHOTS_OUT (default public/tour),
// CHROME_PATH (default /usr/bin/chromium), TUTORIAL_SHOTS_DEBUG (a folder: a full-page
// screenshot of every failed attempt lands there).
// Needs playwright-core and sharp (both in the frontend's dependencies).
//
// Nothing is saved server-side by the capture itself. Theme, locale and the "seen" flags are
// swapped in the answers the browser receives, so the account's own settings stay as they are.

import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { apiSession } from './tour-shots/api.mjs';
import {
  clipFor,
  inPool,
  kebab,
  localesFromConfig,
  outputWidth,
  parseArgs,
  resolveLocales,
  steadyJson,
} from './tour-shots/plan.mjs';
import { buildSteps, MAIN } from './tour-shots/steps.mjs';

const env = process.env;
const here = path.dirname(fileURLToPath(import.meta.url));
const baseUrl = env.TUTORIAL_SHOTS_BASE_URL ?? 'http://localhost:3000';
const args = parseArgs(process.argv.slice(2));
const outRoot = path.resolve(env.TUTORIAL_SHOTS_OUT ?? path.join(here, '../public/tour'));
const only = typeof args.only === 'string' ? args.only.split(',') : null;
const themes = typeof args.theme === 'string' ? [args.theme] : ['light', 'dark'];
const concurrency = Number(args.concurrency ?? 3);

const anchorDate = env.TUTORIAL_SHOTS_ANCHOR_DATE ?? env.DEMO_DATA_ANCHOR_DATE;
if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDate ?? '')) {
  throw new Error('TUTORIAL_SHOTS_ANCHOR_DATE (or DEMO_DATA_ANCHOR_DATE) must be YYYY-MM-DD');
}
const now = new Date(`${anchorDate}T12:00:00Z`);

const VIEWPORT = { width: 1440, height: 900 };
// Captured at three times the CSS size and scaled down to the picture, so text stays crisp
// on a high-density screen.
const SCALE = 3;
const TIME_ZONE = 'Europe/Berlin';

// The guide itself: the welcome window and the guide page a first visit opens
// (welcome-tutorial/guide-pages.ts), told they were closed long ago. Pages are keyed like
// the guide's steps; review and forecast are pages the guide may cover later.
const SEEN_AT = '2026-01-01T00:00:00.000Z';
const SEEN_VERSION = 1000;
const OTHER_PAGES = ['review', 'forecast'];

// Dev-only overlays, toasts and the text caret never belong in a screenshot.
const HIDE_CSS = `
nextjs-portal, #react-scan-root, [data-react-scan], [data-rht-toaster] { display: none !important; }
* { caret-color: transparent !important; scrollbar-width: none !important; }
`;

function required(name) {
  const value = env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

/** Logs in once; every browser context starts with this session. */
async function openSession() {
  const api = apiSession(`${baseUrl}/api/v1`);
  await api.request('POST', '/auth/login', {
    email: required('TUTORIAL_SHOTS_EMAIL'),
    password: required('TUTORIAL_SHOTS_PASSWORD'),
  });
  let workspaceId = env.TUTORIAL_SHOTS_WORKSPACE_ID;
  if (!workspaceId) {
    const name = env.TUTORIAL_SHOTS_DEMO_NAME ?? 'Morgan Design Studio';
    workspaceId = (await api.request('POST', '/workspaces/demo', { name })).id;
  }
  const inWorkspace = { 'x-workspace-id': workspaceId };
  // The advice is computed when someone first opens Advice, and the strip of things to do
  // above every page grows with it. Computed once up front, every page of every language
  // starts from the same strip, so the same screen comes out byte for byte.
  await api.request('POST', '/insights/refresh?locale=en', undefined, inWorkspace);
  const tables = await api.request('GET', '/custom-tables', undefined, inWorkspace);
  const table = tables.items.find(item => item.name === 'Client projects') ?? tables.items[0];
  return { api, workspaceId, tableId: table?.id };
}

/** The profile carries theme, locale and the seen flags, so the profile is what gets swapped. */
function patchProfile(json, settings) {
  const { theme, locale, workspaceId } = settings;
  return {
    ...json,
    themePreference: theme,
    reduceMotion: true,
    locale,
    lastWorkspaceId: workspaceId,
    welcomeTutorialSeenAt: json.welcomeTutorialSeenAt ?? SEEN_AT,
    pageHintsSeen: Object.fromEntries(
      [...settings.stepIds, ...OTHER_PAGES].map(page => [page, SEEN_VERSION]),
    ),
  };
}

/**
 * The API allows 500 requests a minute per address, and every browser of the run shares
 * one; an answer over the limit, or a dropped connection, is asked again after a pause
 * instead of breaking the page.
 */
async function fetchPatiently(route) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await route.fetch();
      if (response.status() !== 429 || attempt === 6) {
        return response;
      }
    } catch (error) {
      if (attempt === 6) {
        throw error;
      }
    }
    await new Promise(resolve => setTimeout(resolve, 5000 * attempt));
  }
}

async function routeApi(context, settings) {
  await context.route('**/api/v1/**', async route => {
    try {
      await route.fulfill(await answerFor(route, settings));
    } catch {
      // The page was closed meanwhile, or the API stayed unreachable: the page shows that.
      await route.abort('failed').catch(() => undefined);
    }
  });
}

/** What the browser is told for one API request (see steadyJson and patchProfile). */
async function answerFor(route, settings) {
  const response = await fetchPatiently(route);
  if (!(response.headers()['content-type'] ?? '').includes('application/json')) {
    return { response };
  }
  const text = await response.text();
  if (!text) {
    return { response };
  }
  const { pathname } = new URL(route.request().url());
  let json = steadyJson(JSON.parse(text), now);
  if (pathname.endsWith('/auth/me')) {
    json = patchProfile(json, settings);
  }
  return { response, json };
}

async function newContext(browser, session, steps, { locale, theme }) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    locale,
    timezoneId: TIME_ZONE,
    reducedMotion: 'reduce',
    colorScheme: theme,
  });
  // The demo's "today": the anchor day, flowing on from noon.
  await context.clock.install({ time: now });
  await context.addCookies([
    ...session.api.cookies().map(cookie => ({ ...cookie, url: baseUrl })),
    { name: 'INTLAYER_LOCALE', value: locale, url: baseUrl },
    { name: 'intlayer-locale', value: locale, url: baseUrl },
  ]);
  await context.addInitScript(
    ([id, preference]) => {
      localStorage.setItem('currentWorkspaceId', id);
      const stored = JSON.parse(localStorage.getItem('user') ?? '{}');
      localStorage.setItem('user', JSON.stringify({ ...stored, themePreference: preference }));
    },
    [session.workspaceId, theme],
  );
  const settings = {
    theme,
    locale,
    workspaceId: session.workspaceId,
    stepIds: steps.map(step => step.id),
  };
  await routeApi(context, settings);
  return { context, settings };
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
          '.MuiSkeleton-root, .MuiCircularProgress-root, [role="progressbar"]:not(.MuiLinearProgress-determinate)',
        ),
      null,
      { timeout: 30_000 },
    )
    .catch(() => undefined);
  await page.evaluate(() => document.fonts.ready);
  // Transitions and animations the page started (cards fading in, bars filling) have ended.
  await page
    .waitForFunction(
      () => document.getAnimations().every(animation => animation.playState !== 'running'),
      null,
      { timeout: 10_000 },
    )
    .catch(() => undefined);
  // Charts draw after their data arrives; there is no event to wait for.
  await page.waitForTimeout(1500);
}

async function boxOf(page, locator) {
  // Not scrolled to: the screenshot covers the full page anyway, and on the dashboard a
  // scroll to an element did not settle in some languages.
  await locator.first().waitFor({ state: 'visible', timeout: 30_000 });
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

/**
 * A fragment near the end of a short page runs past it, and the screenshot stops at the
 * page's edge; the rest is filled with the page's own background, so the image keeps its
 * frame's proportions.
 */
async function padToFrame(png, height) {
  const { height: actual } = await sharp(png).metadata();
  if (actual >= height) {
    return png;
  }
  const { data } = await sharp(png)
    .extract({ left: 0, top: actual - 1, width: 1, height: 1 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return sharp(png)
    .extend({ bottom: height - actual, background: { r: data[0], g: data[1], b: data[2] } })
    .png()
    .toBuffer();
}

async function capture(page, fragment, file) {
  const boxes = [];
  for (const locator of [fragment.target(page)].flat()) {
    boxes.push(await boxOf(page, locator));
  }
  const bounds = fragment.clamp === false ? null : await boxOf(page, page.locator(MAIN));
  const clip = clipFor(boxes, {
    frame: fragment.frame,
    width: fragment.width,
    pad: fragment.pad,
    bounds,
  });
  const png = await padToFrame(
    await page.screenshot({ clip, fullPage: true, animations: 'disabled' }),
    clip.height * SCALE,
  );
  // Fixed encoder settings and no metadata: an unchanged screen gives identical bytes.
  const webp = await sharp(png)
    .resize({ width: outputWidth(clip.width * SCALE) })
    .webp({ quality: 72, effort: 6, smartSubsample: true })
    .toBuffer();
  await writeFile(file, webp);
  return webp.length;
}

async function open(page, step, target, css) {
  await page.goto(`${baseUrl}${target}`, { waitUntil: 'load', timeout: 120_000 });
  await settle(page, css);
  if (step.prepare) {
    await step.prepare(page);
    await settle(page, css);
  }
}

async function saveDebugShot(page, file, attempt) {
  if (env.TUTORIAL_SHOTS_DEBUG) {
    await page.screenshot({
      path: path.join(env.TUTORIAL_SHOTS_DEBUG, `${path.basename(file)}-${attempt}.png`),
      fullPage: true,
    });
  }
}

/** A step's picture, tried twice. */
async function captureStep({ context }, step, locale, theme) {
  const page = await context.newPage();
  if (step.viewport) {
    await page.setViewportSize(step.viewport);
  }
  const { fragment } = step;
  const file = path.join(outRoot, locale, `${kebab(step.id)}-${fragment.id}-${theme}.webp`);
  try {
    for (let attempt = 1; ; attempt += 1) {
      try {
        await open(page, step, step.path, step.css);
        if (fragment.prepare) {
          await fragment.prepare(page);
          await settle(page, step.css);
        }
        // Once more just before the shot: a late re-render of the head can drop the first tag.
        await page.addStyleTag({ content: `${HIDE_CSS}${step.css ?? ''}` });
        await page.waitForTimeout(300);
        return { file, size: await capture(page, fragment, file) };
      } catch (error) {
        await saveDebugShot(page, file, attempt);
        if (attempt >= 2) {
          return { file, error: error.message.split('\n')[0] };
        }
      }
    }
  } finally {
    await page.close();
  }
}

/** Every step in one locale and theme; one browser context of its own. */
async function captureRun(browser, session, steps, locale, theme) {
  const started = Date.now();
  await mkdir(path.join(outRoot, locale), { recursive: true });
  const handle = await newContext(browser, session, steps, { locale, theme });
  const results = [];
  for (const step of steps) {
    results.push(await captureStep(handle, step, locale, theme));
  }
  await handle.context.close();
  const bytes = results.reduce((sum, result) => sum + (result.size ?? 0), 0);
  const seconds = Math.round((Date.now() - started) / 1000);
  console.log(`${locale} ${theme}: ${Math.round(bytes / 1024)} KB in ${seconds} s`);
  return results;
}

/**
 * After a full run of a locale, the files no step wrote any more (a fragment renamed, or one
 * the guide no longer draws) are deleted. A locale with a failed fragment is left as it was.
 */
async function pruneStale(locales, written, failures) {
  for (const locale of locales) {
    const dir = path.join(outRoot, locale);
    if (failures.some(failure => path.dirname(failure.file) === dir)) {
      continue;
    }
    for (const name of await readdir(dir)) {
      const file = path.join(dir, name);
      if (name.endsWith('.webp') && !written.has(file)) {
        await rm(file);
        console.log(`removed stale ${path.relative(outRoot, file)}`);
      }
    }
  }
}

async function main() {
  const configured = localesFromConfig(
    await readFile(path.join(here, '../intlayer.config.ts'), 'utf8'),
  );
  const locales = resolveLocales(args.locale, configured);
  const session = await openSession();
  const steps = buildSteps({ month: anchorDate.slice(0, 7), tableId: session.tableId }).filter(
    step => !only || only.includes(step.id) || only.includes(kebab(step.id)),
  );
  const browser = await chromium.launch({ executablePath: env.CHROME_PATH ?? '/usr/bin/chromium' });
  const started = Date.now();
  const results = [];
  const runs = locales.flatMap(locale => themes.map(theme => ({ locale, theme })));
  await inPool(runs, concurrency, async ({ locale, theme }) => {
    results.push(...(await captureRun(browser, session, steps, locale, theme)));
  });
  await browser.close();
  const failures = results.filter(result => result.error);
  for (const failure of failures) {
    console.error(`FAILED ${path.relative(outRoot, failure.file)}: ${failure.error}`);
  }
  const written = new Set(results.filter(result => !result.error).map(result => result.file));
  const total = results.reduce((sum, result) => sum + (result.size ?? 0), 0);
  if (!only && themes.length === 2) {
    await pruneStale(locales, written, failures);
  }
  const minutes = ((Date.now() - started) / 60_000).toFixed(1);
  console.log(`${runs.length} runs, ${Math.round(total / 1024)} KB, ${minutes} min`);
  if (failures.length) {
    console.error(`${failures.length} fragment(s) failed`);
    process.exitCode = 1;
  }
}

await main();
