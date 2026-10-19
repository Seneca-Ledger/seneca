// What the guide shows of each page, captured from the demo workspace. The guide draws one
// picture per step, its first fragment (TUTORIAL_SCREENS in welcome-tutorial-screens.ts —
// same ids and frame, plan.test.mjs checks it); the other fragments are text only.
// Elements are found by `data-tour-shot` (and a few other data attributes, roles or
// positions), never by visible text, so the same steps work in every language.
//
// A fragment starts at the top-left corner of the union of its `target` boxes (minus `pad`,
// default 16); it is `width` wide (default: the union's width) and as tall as its frame's
// proportions allow. It stays inside the page's main area unless `clamp` is false (dialogs
// and drawers). `css` narrows a page so that one card fills the picture, `viewport` gives a
// page a smaller window. The picture is drawn up to PICTURE_WIDTH (plan.mjs) wide: keep a
// fragment well under that, around 520–600 px, so its text reads larger than on the page.

export const MAIN = '#main-content';

const shot = name => `[data-tour-shot="${name}"]`;
const narrow = width => `${MAIN} > * { max-width: ${width}px; }`;

/** The second text-tabs row on the net worth page is the range; '1y' is its fourth option. */
const NET_WORTH_YEAR_TAB = 3;

/**
 * @param {{ month: string, tableId: string }} demo the demo's anchor month (`YYYY-MM`) and
 *   its custom table
 */
export function buildSteps(demo) {
  return [
    {
      id: 'dashboard',
      path: `/dashboard?month=${demo.month}`,
      // Two columns of cards, each about as wide as the picture.
      viewport: { width: 1240, height: 900 },
      // The sections above it are hidden: their heights shift with the order rows come back
      // in, and the card moved with them by a fraction of a pixel, which changed every pixel.
      css: '[data-overview-section="budgets"], [data-overview-section^="kpi-"] { display: none; }',
      fragment: {
        id: 'categories',
        frame: 'hero',
        target: page => page.locator('[data-overview-section="top-categories"]'),
        pad: 0,
      },
    },
    {
      id: 'statements',
      path: '/statements',
      viewport: { width: 1180, height: 900 },
      fragment: {
        id: 'list',
        frame: 'pair',
        target: page => page.locator('[data-tour-id="statements-table"]'),
        width: 560,
      },
    },
    {
      id: 'budgets',
      path: '/budgets',
      css: narrow(520),
      // The second budget with room left: the first sits right above the one that is over.
      fragment: {
        id: 'cards',
        frame: 'pair',
        target: page => page.locator(shot('budgets-calm')).nth(1),
      },
    },
    {
      id: 'subscriptions',
      path: '/subscriptions',
      viewport: { width: 1180, height: 900 },
      fragment: {
        id: 'calendar',
        frame: 'hero',
        prepare: page => page.locator('button[value="matrix"]').click(),
        target: page => page.locator('.seneca-charge-calendar'),
        width: 600,
      },
    },
    {
      id: 'reports',
      path: '/reports',
      viewport: { width: 1024, height: 900 },
      // The three totals in one narrow row, the money-flow card's title under them.
      css: `${shot('reports-flow')} > :first-child { max-width: 600px; grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }`,
      fragment: {
        id: 'flow',
        frame: 'hero',
        target: page => page.locator(shot('reports-flow')),
        width: 632,
      },
    },
    {
      id: 'goals',
      path: '/goals',
      css: narrow(520),
      fragment: { id: 'list', frame: 'pair', target: page => page.locator(shot('goals-list')) },
    },
    {
      id: 'netWorth',
      path: '/net-worth',
      css: narrow(552),
      prepare: page =>
        page
          .locator(`${MAIN} [role="tablist"]`)
          .nth(1)
          .locator('[role="tab"]')
          .nth(NET_WORTH_YEAR_TAB)
          .click(),
      fragment: {
        id: 'chart',
        frame: 'hero',
        target: page => page.locator(shot('net-worth-chart')),
      },
    },
    {
      id: 'advice',
      path: '/advice',
      // The list of plain observations: two whole cards, one a dry fact (the savings rate).
      // The app writes their age relative to today ("3 hours ago"), which a demo shot
      // should not carry, so that line is left out. The list above it is hidden: its rows
      // come back in any order, and their summed heights moved this one by a pixel; the
      // margin keeps the strip over the page out of the picture.
      css: `${narrow(500)} .seneca-advice__main > div > p:last-child { display: none; } ${MAIN} section:first-of-type { display: none; } ${MAIN} section { margin-top: 32px; }`,
      fragment: {
        id: 'info',
        frame: 'pair',
        target: page => page.locator(`${MAIN} section`).nth(1),
      },
    },
    {
      id: 'taxDeclaration',
      path: '/tax-declaration',
      css: `${shot('tax-declaration-gate')} { max-width: 560px; }`,
      fragment: {
        id: 'gate',
        frame: 'pair',
        target: page => page.locator(shot('tax-declaration-gate')),
      },
    },
    {
      id: 'crypto',
      path: '/crypto',
      // Room above the buttons inside the picture, so the strip over the page stays out.
      css: `${narrow(520)} ${shot('crypto-actions')} { padding-top: 16px; }`,
      // The page as a new workspace sees it: the two ways in and the empty state.
      fragment: {
        id: 'wallets',
        frame: 'pair',
        target: page => page.locator(shot('crypto-actions')),
        width: 520,
        pad: 0,
      },
    },
    {
      id: 'roi',
      path: '/roi',
      prepare: async page => {
        const inputs = page.locator(`${shot('roi-inputs')} input`);
        await inputs.nth(0).fill('50000');
        await inputs.nth(1).fill('350');
        await inputs.nth(1).blur();
      },
      fragment: { id: 'chart', frame: 'hero', target: page => page.locator(shot('roi-chart')) },
    },
    {
      id: 'tables',
      // The demo's one table, "Client projects": rows the way a spreadsheet shows them.
      path: `/custom-tables/${demo.tableId}`,
      viewport: { width: 1024, height: 900 },
      fragment: {
        id: 'grid',
        frame: 'pair',
        target: page => page.locator('[role="grid"], table').first(),
        width: 600,
      },
    },
    {
      id: 'workspaces',
      path: '/workspaces/list',
      viewport: { width: 1024, height: 900 },
      css: `${shot('workspaces-list')} { max-width: 600px; }`,
      fragment: {
        id: 'list',
        frame: 'hero',
        target: page => page.locator(shot('workspaces-list')),
      },
    },
  ];
}
