#!/usr/bin/env node
// Keyboard focus audit. Walks the Tab order of key pages in headless Chromium and reports
// focus stops that are invisible, whose focus ring is clipped by an overflow ancestor or the
// viewport, or whose ring is painted over by another positioned element.
//
//   FOCUS_AUDIT_EMAIL=demo@seneca.dev FOCUS_AUDIT_PASSWORD=... npm run audit:focus
//
// Env: FOCUS_AUDIT_BASE_URL (default http://localhost:3002), FOCUS_AUDIT_ROUTES (comma list),
// FOCUS_AUDIT_VIEWPORTS (desktop,mobile), FOCUS_AUDIT_MAX_TABS (default 120),
// FOCUS_AUDIT_OUT (default .focus-audit), CHROME_PATH (browser binary, optional).
// Exits with 1 when anything was found.

import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const DEFAULT_ROUTES = [
  '/dashboard',
  '/statements',
  '/custom-tables',
  '/workspaces',
  '/storage',
  '/reports',
  '/budgets',
  '/goals',
  '/subscriptions',
  '/settings/profile',
];

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

const env = process.env;
const baseUrl = env.FOCUS_AUDIT_BASE_URL ?? 'http://localhost:3002';
const routes = env.FOCUS_AUDIT_ROUTES?.split(',').filter(Boolean) ?? DEFAULT_ROUTES;
const viewports = (env.FOCUS_AUDIT_VIEWPORTS ?? 'desktop,mobile').split(',');
const maxTabs = Number(env.FOCUS_AUDIT_MAX_TABS ?? 120);
const outDir = path.resolve(env.FOCUS_AUDIT_OUT ?? '.focus-audit');

// Runs in the page: describes document.activeElement and what is wrong with its focus ring.
function inspectActiveElement() {
  const active = document.activeElement;
  if (!active || active === document.body || active === document.documentElement) {
    return { kind: 'body' };
  }
  // The app has no shadow DOM of its own: a focused shadow host is dev tooling
  // (the Next.js dev indicator).
  if (active.shadowRoot || active.tagName.includes('-')) {
    return { kind: 'devtool', label: active.tagName.toLowerCase() };
  }
  window.__focusAuditSeen ??= new WeakSet();
  if (window.__focusAuditSeen.has(active)) {
    return { kind: 'repeat' };
  }
  window.__focusAuditSeen.add(active);

  const describe = node => {
    const parts = [];
    for (let n = node; n && n !== document.body && parts.length < 4; n = n.parentElement) {
      const cls = [...n.classList].filter(c => !c.startsWith('css-')).slice(0, 2);
      parts.unshift(
        n.tagName.toLowerCase() + (n.id ? `#${n.id}` : '') + cls.map(c => `.${c}`).join(''),
      );
    }
    return parts.join(' > ');
  };
  const text = (
    active.getAttribute('aria-label') ??
    active.getAttribute('title') ??
    active.textContent ??
    ''
  )
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 50);

  // Visually hidden native inputs (MUI Checkbox/Radio/Switch) show focus on their wrapper.
  let target = active;
  const activeStyle = getComputedStyle(active);
  if (active.tagName === 'INPUT' && Number(activeStyle.opacity) === 0) {
    target = active.closest('.MuiButtonBase-root, label') ?? active;
  }
  // MUI text fields signal focus with the notched outline of the input root.
  const isMuiField = Boolean(active.closest('.MuiInputBase-root'));
  if (isMuiField) {
    target = active.closest('.MuiInputBase-root');
  }

  const issues = [];
  const rect = target.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const visible = target.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  if (!visible) {
    issues.push('invisible: hidden by css');
  } else if (rect.width < 1 || rect.height < 1) {
    issues.push('invisible: zero size');
  } else if (rect.right <= 0 || rect.bottom <= 0 || rect.left >= vw || rect.top >= vh) {
    issues.push('invisible: off-screen');
  }

  const related = node => node.contains(target) || target.contains(node);
  // Outermost positioned element between `node` and `ancestor` (exclusive).
  const branchTop = (node, ancestor) => {
    let found = null;
    for (let n = node; n && n !== ancestor; n = n.parentElement) {
      if (getComputedStyle(n).position !== 'static') {
        found = n;
      }
    }
    return found;
  };
  const zOf = node => Number.parseInt(getComputedStyle(node).zIndex, 10) || 0;
  // Whether anything between the hit element and `top` paints an opaque surface there.
  const paintsOpaque = (hit, top) => {
    for (let n = hit; n; n = n.parentElement) {
      const s = getComputedStyle(n);
      const alpha = s.backgroundColor.match(/[\d.]+/g)?.[3];
      if (s.backgroundImage !== 'none') {
        return true;
      }
      if (s.backgroundColor !== 'transparent' && (alpha === undefined || Number(alpha) > 0.5)) {
        return true;
      }
      if (n === top) {
        return false;
      }
    }
    return false;
  };
  // The element painted over `target` at the hit-tested point, if any. Approximates paint
  // order: a positioned branch wins over a static one, then z-index, then document order.
  const coveringElement = hit => {
    if (!hit || related(hit)) {
      return null;
    }
    let common = hit;
    while (common && !common.contains(target)) {
      common = common.parentElement;
    }
    const cover = branchTop(hit, common);
    if (!(cover && paintsOpaque(hit, cover))) {
      return null;
    }
    const self = branchTop(target, common);
    if (!self) {
      return cover;
    }
    const dz = zOf(cover) - zOf(self);
    if (dz !== 0) {
      return dz > 0 ? cover : null;
    }
    return self.compareDocumentPosition(cover) & Node.DOCUMENT_POSITION_FOLLOWING ? cover : null;
  };

  if (issues.length === 0) {
    const cover = coveringElement(
      document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2),
    );
    if (cover) {
      issues.push(`invisible: under ${describe(cover)}`);
    }
  }

  const style = getComputedStyle(target);
  const ringWidth = style.outlineStyle === 'none' ? 0 : Number.parseFloat(style.outlineWidth);
  const reach = ringWidth + Number.parseFloat(style.outlineOffset || '0');
  if (issues.length === 0 && !isMuiField) {
    if (ringWidth === 0 && style.boxShadow === 'none') {
      issues.push('no focus ring');
    } else if (ringWidth > 0) {
      const ring = {
        left: rect.left - reach,
        top: rect.top - reach,
        right: rect.right + reach,
        bottom: rect.bottom + reach,
      };
      for (let a = target.parentElement; a; a = a.parentElement) {
        const s = getComputedStyle(a);
        const clipX = s.overflowX !== 'visible';
        const clipY = s.overflowY !== 'visible';
        if (!(clipX || clipY)) {
          continue;
        }
        if (a === document.documentElement || a === document.body) {
          continue;
        }
        const r = a.getBoundingClientRect();
        const left = r.left + a.clientLeft;
        const top = r.top + a.clientTop;
        const sides = [];
        if (clipX && ring.left < left - 0.5) {
          sides.push('left');
        }
        if (clipX && ring.right > left + a.clientWidth + 0.5) {
          sides.push('right');
        }
        if (clipY && ring.top < top - 0.5) {
          sides.push('top');
        }
        if (clipY && ring.bottom > top + a.clientHeight + 0.5) {
          sides.push('bottom');
        }
        if (sides.length) {
          issues.push(`clipped ${sides.join('/')} by ${describe(a)}`);
          break;
        }
      }
      const viewportSides = [];
      if (ring.left < 0) {
        viewportSides.push('left');
      }
      if (ring.right > vw) {
        viewportSides.push('right');
      }
      if (ring.top < 0) {
        viewportSides.push('top');
      }
      if (ring.bottom > vh) {
        viewportSides.push('bottom');
      }
      if (viewportSides.length) {
        issues.push(`clipped ${viewportSides.join('/')} by viewport`);
      }

      // Sample the middle of the ring line along each edge.
      const mid = reach - ringWidth / 2;
      const points = [];
      for (const f of [0.25, 0.5, 0.75]) {
        const x = rect.left + rect.width * f;
        const y = rect.top + rect.height * f;
        points.push(
          [x, rect.top - mid],
          [x, rect.bottom + mid],
          [rect.left - mid, y],
          [rect.right + mid, y],
        );
      }
      for (const [x, y] of points) {
        if (x < 0 || y < 0 || x >= vw || y >= vh) {
          continue;
        }
        const cover = coveringElement(document.elementFromPoint(x, y));
        if (cover) {
          issues.push(`covered by ${describe(cover)}`);
          break;
        }
      }
    }
  }

  return {
    kind: 'element',
    element: describe(target),
    text,
    issues,
    clip: { x: rect.left - 24, y: rect.top - 24, width: rect.width + 48, height: rect.height + 48 },
  };
}

async function login(browser) {
  const context = await browser.newContext({ viewport: VIEWPORTS.desktop });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/login`);
  await page.fill('input[name="email"]', env.FOCUS_AUDIT_EMAIL);
  await page.fill('input[name="password"]', env.FOCUS_AUDIT_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 30_000 });
  const state = await context.storageState();
  await context.close();
  return state;
}

async function auditRoute(page, route, viewportName) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  // Start the walk from the top of the document: focus and drop a throwaway element, so the
  // browser's sequential focus starting point is not wherever the page put focus on load.
  await page.evaluate(() => {
    const start = document.createElement('div');
    start.tabIndex = -1;
    document.body.prepend(start);
    start.focus();
    start.remove();
    window.scrollTo(0, 0);
  });

  const findings = [];
  let stops = 0;
  for (let i = 0; i < maxTabs; i += 1) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(inspectActiveElement);
    if (info.kind === 'body' || info.kind === 'repeat') {
      break;
    }
    if (info.kind === 'devtool') {
      continue;
    }
    stops += 1;
    if (info.issues.length === 0) {
      continue;
    }

    const finding = { stop: stops, element: info.element, text: info.text, issues: info.issues };
    const vp = VIEWPORTS[viewportName];
    const clip = {
      x: Math.max(0, info.clip.x),
      y: Math.max(0, info.clip.y),
      width: Math.min(vp.width, info.clip.x + info.clip.width) - Math.max(0, info.clip.x),
      height: Math.min(vp.height, info.clip.y + info.clip.height) - Math.max(0, info.clip.y),
    };
    if (clip.width > 4 && clip.height > 4) {
      const file = `${viewportName}${route.replaceAll('/', '_')}-${stops}.png`;
      await page.screenshot({ path: path.join(outDir, file), clip });
      finding.screenshot = file;
    }
    findings.push(finding);
  }
  return { route, viewport: viewportName, stops, findings };
}

async function main() {
  if (!(env.FOCUS_AUDIT_EMAIL && env.FOCUS_AUDIT_PASSWORD)) {
    console.error('Set FOCUS_AUDIT_EMAIL and FOCUS_AUDIT_PASSWORD (a dev account).');
    process.exit(2);
  }
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const browser = await chromium.launch({ executablePath: env.CHROME_PATH || undefined });
  const results = [];
  try {
    const storageState = await login(browser);
    for (const viewportName of viewports) {
      const context = await browser.newContext({
        viewport: VIEWPORTS[viewportName],
        storageState,
        reducedMotion: 'reduce',
      });
      // Onboarding tours trap focus by design; report them as "shown just now" so they
      // don't auto-start over the page under audit (see TourAutoStarter's cooldown).
      await context.addInitScript(() => {
        const getItem = Storage.prototype.getItem;
        Storage.prototype.getItem = function (key) {
          return String(key).startsWith('seneca_tour_last_shown:')
            ? String(Date.now())
            : getItem.call(this, key);
        };
      });
      const page = await context.newPage();
      for (const route of routes) {
        // A page that navigates away mid-walk (client redirect, auth bounce) is reported as a
        // finding instead of aborting the whole run.
        const result = await auditRoute(page, route, viewportName).catch(error => ({
          route,
          viewport: viewportName,
          stops: 0,
          findings: [
            { stop: 0, element: route, text: '', issues: [`audit failed: ${error.message}`] },
          ],
        }));
        results.push(result);
        console.log(
          `\n${viewportName} ${route}: ${result.stops} stops, ${result.findings.length} findings`,
        );
        for (const f of result.findings) {
          console.log(`  #${f.stop} ${f.element} "${f.text}"`);
          for (const issue of f.issues) {
            console.log(`      ${issue}`);
          }
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }

  await writeFile(path.join(outDir, 'report.json'), JSON.stringify(results, null, 2));
  const total = results.reduce((sum, r) => sum + r.findings.length, 0);
  console.log(`\n${total} findings. Report and screenshots: ${outDir}`);
  process.exit(total > 0 ? 1 : 0);
}

await main();
