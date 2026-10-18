/**
 * First-visit hints, per page. Each step points at a live element through a
 * `data-hint` attribute on it, and is shown once: the server stores, per page,
 * the highest `since` the person has closed (`users.page_hints_seen`), and a page
 * shows only its steps with a higher `since`. Adding a step later with the next
 * number shows that step alone to everyone who has seen the others.
 *
 * Texts live in page-hints.content.ts under `pages.<page>.<step>`: a title of at
 * most six words and exactly one sentence.
 */

export type PageHintPlacement = 'bottom' | 'top' | 'right' | 'left';

export interface PageHintStep {
  /** Key of the texts under the page in page-hints.content.ts. */
  id: string;
  /** The hint version that introduced the step. */
  since: number;
  /** CSS selector of the element the hint points at. */
  anchor: string;
  /** Pointed at instead when `anchor` is not on the page (an empty workspace). */
  fallback?: string;
  placement?: PageHintPlacement;
}

export interface PageHintsPage {
  match: (pathname: string) => boolean;
  steps: readonly PageHintStep[];
}

const at =
  (...paths: string[]) =>
  (pathname: string): boolean =>
    paths.some(path => pathname === path || pathname === `${path}/`);

const hint = (name: string): string => `[data-hint="${name}"]`;

// The Review item in the sidebar: where unconfirmed rows wait, even before there are any.
const REVIEW_NAV = hint('nav-review');

export const PAGE_HINTS = {
  dashboard: {
    match: at('/dashboard'),
    steps: [
      { id: 'month', since: 1, anchor: hint('dashboard-month') },
      { id: 'unconfirmed', since: 1, anchor: hint('unconfirmed'), fallback: REVIEW_NAV },
    ],
  },
  statements: {
    // `/statements` only redirects here.
    match: at('/statements/submit'),
    steps: [
      { id: 'upload', since: 1, anchor: hint('statements-upload') },
      { id: 'confirm', since: 1, anchor: hint('statements-to-review'), fallback: REVIEW_NAV },
    ],
  },
  review: {
    match: at('/review'),
    steps: [{ id: 'approve', since: 1, anchor: hint('review-approve') }],
  },
  budgets: {
    match: at('/budgets'),
    steps: [
      { id: 'limit', since: 1, anchor: hint('budgets-new') },
      { id: 'stoic', since: 1, anchor: hint('stoic-balance'), placement: 'top' },
    ],
  },
  subscriptions: {
    match: at('/subscriptions'),
    steps: [
      { id: 'add', since: 1, anchor: hint('subscriptions-add') },
      { id: 'detected', since: 1, anchor: hint('subscriptions-detected') },
    ],
  },
  reports: {
    match: at('/reports'),
    steps: [
      { id: 'cashFlow', since: 1, anchor: hint('reports-cash-flow') },
      { id: 'templates', since: 1, anchor: hint('reports-templates') },
    ],
  },
  goals: {
    match: at('/goals'),
    steps: [{ id: 'create', since: 1, anchor: hint('goals-create') }],
  },
  netWorth: {
    match: at('/net-worth'),
    steps: [
      { id: 'total', since: 1, anchor: hint('net-worth-total') },
      { id: 'holdings', since: 1, anchor: hint('net-worth-holdings'), placement: 'top' },
    ],
  },
  forecast: {
    match: at('/forecast'),
    steps: [
      { id: 'inputs', since: 1, anchor: hint('forecast-horizon') },
      { id: 'exclude', since: 1, anchor: hint('forecast-exclude') },
    ],
  },
  advice: {
    match: at('/advice'),
    steps: [{ id: 'source', since: 1, anchor: hint('advice-main') }],
  },
  taxDeclaration: {
    match: at('/tax-declaration'),
    steps: [
      { id: 'collected', since: 1, anchor: hint('tax-steps'), fallback: hint('tax-gate') },
      {
        id: 'notAdvice',
        since: 1,
        anchor: hint('tax-accuracy'),
        fallback: hint('tax-gate-points'),
      },
    ],
  },
  crypto: {
    match: at('/crypto'),
    steps: [
      { id: 'connect', since: 1, anchor: hint('crypto-connect') },
      { id: 'import', since: 1, anchor: hint('crypto-import') },
    ],
  },
  roi: {
    match: at('/roi'),
    steps: [{ id: 'amounts', since: 1, anchor: hint('roi-inputs') }],
  },
  tables: {
    match: at('/custom-tables'),
    steps: [
      { id: 'templates', since: 1, anchor: hint('tables-new') },
      { id: 'fill', since: 1, anchor: hint('tables-new') },
    ],
  },
  workspaces: {
    match: at('/workspaces/overview'),
    steps: [
      { id: 'switch', since: 1, anchor: hint('workspaces-all') },
      { id: 'invite', since: 1, anchor: hint('workspaces-members') },
    ],
  },
} as const satisfies Record<string, PageHintsPage>;

export type PageHintsPageId = keyof typeof PAGE_HINTS;

export const PAGE_HINT_IDS = Object.keys(PAGE_HINTS) as PageHintsPageId[];

export function resolveHintPage(pathname: string): PageHintsPageId | null {
  return PAGE_HINT_IDS.find(id => PAGE_HINTS[id].match(pathname)) ?? null;
}

/** The page's hint version: what closing its hints stores. */
export function pageHintsVersion(page: PageHintsPageId): number {
  return Math.max(...PAGE_HINTS[page].steps.map(step => step.since));
}

/** The steps added after `version`: a step with a higher `since` shows on its own. */
export function stepsNewerThan(steps: readonly PageHintStep[], version: number): PageHintStep[] {
  return steps.filter(step => step.since > version);
}

/** The steps newer than what the person has seen on this page. */
export function unseenSteps(
  page: PageHintsPageId,
  seen: Readonly<Record<string, number>>,
): PageHintStep[] {
  return stepsNewerThan(PAGE_HINTS[page].steps, seen[page] ?? 0);
}
