// What the guide shows of each page, captured from the demo workspace. One entry per guide
// step (TUTORIAL_SCREENS in welcome-tutorial-screens.ts, same ids, same fragments and frames —
// plan.test.mjs checks it). Elements are found by `data-tour-shot` (and a few other data
// attributes, roles or positions), never by visible text, so the same steps work in every
// language.
//
// A fragment starts at the top-left corner of the union of its `target` boxes (minus `pad`,
// default 16); it is `width` wide (default: the union's width) and as tall as its frame's
// proportions allow. It stays inside the page's main area unless `clamp` is false (dialogs
// and drawers). `css` narrows single-column pages so that a card fills its frame, `viewport`
// gives a page a smaller window. Keep a fragment about as wide as its frame is drawn
// (FRAME_WIDTH in plan.mjs) or more: much wider and its text shrinks below reading size.

export const MAIN = '#main-content';

const shot = name => `[data-tour-shot="${name}"]`;
const narrow = width => `${MAIN} > * { max-width: ${width}px; }`;
const dialog = page => page.locator('.MuiDialog-paper, .MuiDrawer-paper').last();

/** The second text-tabs row on the net worth page is the range; '1y' is its fourth option. */
const NET_WORTH_YEAR_TAB = 3;
/** Reports tabs: cash flow, templates, … */
const REPORTS_TEMPLATES_TAB = 1;

/**
 * @param {{ month: string }} demo the demo's anchor month (`YYYY-MM`)
 */
export function buildSteps(demo) {
  const dashboard = `/dashboard?month=${demo.month}`;
  return [
    {
      id: 'dashboard',
      path: dashboard,
      fragments: [
        {
          id: 'categories',
          frame: 'hero',
          target: page => page.locator('[data-overview-section="top-categories"]'),
          pad: 0,
        },
        {
          id: 'month',
          frame: 'side',
          // The strip and the line under it about rows not confirmed yet.
          css: `${shot('dashboard-month')}, .lumio-dashboard__unconfirmed { max-width: 600px; }`,
          target: page => [
            page.locator(shot('dashboard-month')),
            page.locator('.lumio-dashboard__unconfirmed'),
          ],
        },
        {
          id: 'recent',
          frame: 'side',
          target: page => page.locator('[data-overview-section="recent-transactions"]'),
          pad: 0,
        },
      ],
    },
    {
      id: 'statements',
      path: '/statements',
      viewport: { width: 1180, height: 900 },
      fragments: [
        {
          id: 'list',
          frame: 'pair',
          target: page => page.locator('[data-tour-id="statements-table"]'),
          width: 620,
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
      id: 'budgets',
      path: '/budgets',
      css: narrow(552),
      fragments: [
        // The second budget with room left: the first sits right above the one that is over.
        { id: 'cards', frame: 'pair', target: page => page.locator(shot('budgets-calm')).nth(1) },
        { id: 'over', frame: 'pair', target: page => page.locator(shot('budgets-over')) },
      ],
    },
    {
      id: 'subscriptions',
      path: '/subscriptions',
      viewport: { width: 1180, height: 900 },
      fragments: [
        {
          id: 'calendar',
          frame: 'hero',
          prepare: page => page.locator('button[value="matrix"]').click(),
          target: page => page.locator('.lumio-charge-calendar'),
          width: 760,
        },
        {
          id: 'kpis',
          frame: 'side',
          target: page => page.locator(shot('subscriptions-kpis')),
          width: 560,
        },
        {
          id: 'list',
          frame: 'side',
          target: page => page.locator(shot('subscriptions-list')),
          width: 560,
        },
      ],
    },
    {
      id: 'reports',
      path: '/reports',
      viewport: { width: 1024, height: 900 },
      fragments: [
        { id: 'flow', frame: 'hero', target: page => page.locator(shot('reports-flow')) },
        {
          id: 'templates',
          frame: 'side',
          prepare: page =>
            page
              .locator('[data-tour-id="reports-tabs"] [role="tab"]')
              .nth(REPORTS_TEMPLATES_TAB)
              .click(),
          target: page => page.locator('[data-tour-id="reports-templates-grid"]'),
          width: 580,
        },
        {
          id: 'categories',
          frame: 'side',
          // The "By category" card: the third block of the cash-flow view.
          target: page => page.locator(`${shot('reports-flow')} > :nth-child(3)`),
          width: 580,
          pad: 0,
        },
      ],
    },
    {
      id: 'goals',
      path: '/goals',
      css: narrow(552),
      fragments: [
        { id: 'list', frame: 'pair', target: page => page.locator(shot('goals-list')) },
        {
          id: 'progress',
          frame: 'pair',
          // The dashboard's card: each goal's bar with what was put in this month.
          path: dashboard,
          css: '[data-overview-section="goals"] { max-width: 640px; }',
          target: page => page.locator('[data-overview-section="goals"]'),
          pad: 0,
        },
      ],
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
      fragments: [
        { id: 'chart', frame: 'hero', target: page => page.locator(shot('net-worth-chart')) },
        {
          id: 'allocation',
          frame: 'side',
          target: page => page.locator(shot('net-worth-allocation')),
        },
        { id: 'risk', frame: 'side', target: page => page.locator(shot('net-worth-risk')) },
      ],
    },
    {
      id: 'advice',
      path: '/advice',
      css: narrow(600),
      fragments: [
        // The two lists: what needs a look, then plain information.
        {
          id: 'attention',
          frame: 'pair',
          target: page => page.locator(`${MAIN} section`).first(),
        },
        { id: 'info', frame: 'pair', target: page => page.locator(`${MAIN} section`).nth(1) },
      ],
    },
    {
      id: 'taxDeclaration',
      path: '/tax-declaration',
      fragments: [
        {
          id: 'gate',
          frame: 'pair',
          target: page => page.locator(shot('tax-declaration-gate')),
          width: 712,
        },
        {
          id: 'steps',
          frame: 'pair',
          // Past the notice, without accepting it: only the browser is told it was.
          api: { '/income-tax/disclaimer': json => ({ ...json, accepted: true }) },
          target: page => page.locator(shot('tax-declaration-steps')),
          width: 660,
        },
      ],
    },
    {
      id: 'crypto',
      path: '/crypto',
      css: narrow(560),
      fragments: [
        // The page as a new workspace sees it: the two ways in and the empty state.
        {
          id: 'wallets',
          frame: 'pair',
          target: page => page.locator(shot('crypto-actions')),
          width: 560,
        },
        {
          id: 'connect',
          frame: 'pair',
          prepare: page => page.locator(shot('crypto-connect')).click(),
          target: dialog,
          clamp: false,
          pad: 0,
        },
      ],
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
      fragments: [
        { id: 'chart', frame: 'hero', target: page => page.locator(shot('roi-chart')) },
        { id: 'inputs', frame: 'side', target: page => page.locator(shot('roi-inputs')) },
        {
          id: 'table',
          frame: 'side',
          target: page => page.locator(shot('roi-table')),
          width: 520,
        },
      ],
    },
    {
      id: 'tables',
      path: '/custom-tables',
      viewport: { width: 1024, height: 900 },
      fragments: [
        {
          id: 'list',
          frame: 'pair',
          target: page => page.locator('[data-tour-id="tables-list"]'),
          width: 680,
        },
        {
          id: 'grid',
          frame: 'pair',
          path: ({ tableId }) => `/custom-tables/${tableId}`,
          target: page => page.locator('[role="grid"], table').first(),
          width: 680,
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
          target: page => page.locator(shot('workspaces-list')),
          width: 760,
        },
        {
          id: 'members',
          frame: 'side',
          path: '/workspaces/members',
          css: `${shot('workspaces-members')} { max-width: 600px; }`,
          target: page => page.locator(shot('workspaces-members')),
          pad: 0,
        },
        {
          id: 'categories',
          frame: 'side',
          path: '/workspaces/categories',
          target: page => page.locator('[data-tour-id="categories-list"]'),
          width: 560,
        },
      ],
    },
  ];
}
