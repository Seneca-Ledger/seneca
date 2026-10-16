import type React from 'react';

/**
 * Line icons for empty states: one 1.5px stroke with round ends, no fill, drawn
 * on a 24px grid. They sit in the EmptyState circle and take its colour, so
 * every empty screen reads as one set rather than a gallery of pictures.
 */
function LineIcon({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** A month with one day marked: subscriptions. */
export const CalendarLineIcon = (): React.JSX.Element => (
  <LineIcon>
    <rect x="3.75" y="5.25" width="16.5" height="15" rx="2.25" />
    <path d="M3.75 9.75h16.5M8.25 3.75v3M15.75 3.75v3" />
    <rect x="13.5" y="13.5" width="3" height="3" rx="0.75" />
  </LineIcon>
);

/** A till receipt: receipts. */
export const ReceiptLineIcon = (): React.JSX.Element => (
  <LineIcon>
    <path d="M6 3.75h12v16.5l-2-1.25-2 1.25-2-1.25-2 1.25-2-1.25-2 1.25z" />
    <path d="M9 8.25h6M9 11.25h6M9 14.25h3.75" />
  </LineIcon>
);

/** Two sheets, one behind the other: duplicates. */
export const DuplicateLineIcon = (): React.JSX.Element => (
  <LineIcon>
    <rect x="8.25" y="8.25" width="12" height="12" rx="2" />
    <path d="M15.75 8.25v-2.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2.5" />
  </LineIcon>
);

/** A tray with a tick: nothing left to review. */
export const InboxLineIcon = (): React.JSX.Element => (
  <LineIcon>
    <path d="M3.75 13.5 6 5.25h12l2.25 8.25v5.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5z" />
    <path d="M3.75 13.5h4.5l1.5 2.25h4.5l1.5-2.25h4.5" />
    <path d="m9.75 9.75 1.5 1.5 3-3" />
  </LineIcon>
);

/** A magnifier: filters found nothing. */
export const SearchLineIcon = (): React.JSX.Element => (
  <LineIcon>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="m15 15 5.25 5.25" />
  </LineIcon>
);

/** A flag on a pole, as in the sidebar: goals. */
export const FlagLineIcon = (): React.JSX.Element => (
  <LineIcon>
    <path d="M5.25 20.25V4.5" />
    <path d="M5.25 4.5h11.25l-2.25 4.125 2.25 4.125H5.25" />
  </LineIcon>
);

/** A light bulb: advice. */
export const BulbLineIcon = (): React.JSX.Element => (
  <LineIcon>
    <path d="M9 17.25h6M9.75 20.25h4.5" />
    <path d="M12 3.75a6 6 0 0 0-3.75 10.69c.47.38.75.94.75 1.54v1.27h6v-1.27c0-.6.28-1.16.75-1.54A6 6 0 0 0 12 3.75z" />
  </LineIcon>
);

/** A page with a folded corner and a total line: invoices. */
export const InvoiceLineIcon = (): React.JSX.Element => (
  <LineIcon>
    <path d="M14.25 3.75H6.75a1.5 1.5 0 0 0-1.5 1.5v13.5a1.5 1.5 0 0 0 1.5 1.5h10.5a1.5 1.5 0 0 0 1.5-1.5V8.25z" />
    <path d="M14.25 3.75v4.5h4.5M8.25 12h7.5M8.25 15.75h4.5" />
  </LineIcon>
);

/** Two people: clients. */
export const PeopleLineIcon = (): React.JSX.Element => (
  <LineIcon>
    <circle cx="9" cy="8.25" r="3" />
    <path d="M3.75 19.5a5.25 5.25 0 0 1 10.5 0" />
    <path d="M15.75 5.5a3 3 0 0 1 0 5.5M17.25 14.5a5.25 5.25 0 0 1 3 5" />
  </LineIcon>
);

/** A flat piggy bank: budgets. */
export const PiggyLineIcon = (): React.JSX.Element => (
  <LineIcon>
    <path d="M19.5 11.25c0-3.73-3.36-6-7.5-6S4.5 7.52 4.5 11.25c0 1.92.9 3.6 2.25 4.7v2.8h3v-1.5h4.5v1.5h3v-2.8a5.6 5.6 0 0 0 1.5-1.95h1.5v-3h-1.24A5 5 0 0 0 19.5 11.25z" />
    <path d="M10.5 8.25h3M15.75 10.5h.01" />
  </LineIcon>
);

/** A rising line on two axes: net worth, trends, spending over time. */
export const ChartLineIcon = (): React.JSX.Element => (
  <LineIcon>
    <path d="M4.5 4.5v15h15" />
    <path d="m7.5 15 3.75-4.5 3 2.25 4.5-6" />
  </LineIcon>
);

/** A grid: tables. */
export const TableLineIcon = (): React.JSX.Element => (
  <LineIcon>
    <rect x="3.75" y="4.5" width="16.5" height="15" rx="2" />
    <path d="M3.75 9.75h16.5M3.75 14.625h16.5M9.75 9.75v9.75" />
  </LineIcon>
);

/** A page with lines: statements, documents. */
export const DocumentLineIcon = (): React.JSX.Element => (
  <LineIcon>
    <path d="M14.25 3.75H6.75a1.5 1.5 0 0 0-1.5 1.5v13.5a1.5 1.5 0 0 0 1.5 1.5h10.5a1.5 1.5 0 0 0 1.5-1.5V8.25z" />
    <path d="M14.25 3.75v4.5h4.5M8.25 12.75h7.5M8.25 16.125h7.5" />
  </LineIcon>
);

/** A bin: trash. */
export const TrashLineIcon = (): React.JSX.Element => (
  <LineIcon>
    <path d="M4.5 6.75h15M9.75 6.75V4.5h4.5v2.25" />
    <path d="M6.75 6.75l.75 12a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5l.75-12" />
    <path d="M10.5 10.5v6M13.5 10.5v6" />
  </LineIcon>
);

/** A bell: notifications. */
export const BellLineIcon = (): React.JSX.Element => (
  <LineIcon>
    <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" />
    <path d="M10.125 20.25a2 2 0 0 0 3.75 0" />
  </LineIcon>
);

/** A padlock: password, security, sessions. */
export const LockLineIcon = (): React.JSX.Element => (
  <LineIcon>
    <rect x="5.25" y="10.5" width="13.5" height="9.75" rx="2" />
    <path d="M8.25 10.5V7.5a3.75 3.75 0 0 1 7.5 0v3M12 14.25v2.25" />
  </LineIcon>
);

/** A plug: integrations, plugins. */
export const PlugLineIcon = (): React.JSX.Element => (
  <LineIcon>
    <path d="M9 3.75v4.5M15 3.75v4.5" />
    <path d="M6.75 8.25h10.5v3a5.25 5.25 0 0 1-10.5 0z" />
    <path d="M12 16.5v3.75" />
  </LineIcon>
);

/** Stacked layers: workspaces, storage. */
export const LayersLineIcon = (): React.JSX.Element => (
  <LineIcon>
    <path d="m12 3.75 8.25 4.5-8.25 4.5-8.25-4.5z" />
    <path d="m3.75 12.375 8.25 4.5 8.25-4.5M3.75 16.125l8.25 4.5 8.25-4.5" />
  </LineIcon>
);

/** A clock: activity, history. */
export const ClockLineIcon = (): React.JSX.Element => (
  <LineIcon>
    <circle cx="12" cy="12" r="8.25" />
    <path d="M12 7.5V12l3 2.25" />
  </LineIcon>
);

/** Two coins: cash, money flows, top lists. */
export const CoinsLineIcon = (): React.JSX.Element => (
  <LineIcon>
    <ellipse cx="9.75" cy="7.5" rx="5.25" ry="2.25" />
    <path d="M4.5 7.5v4.5c0 1.24 2.35 2.25 5.25 2.25M4.5 12v4.5c0 1.24 2.35 2.25 5.25 2.25" />
    <ellipse cx="15" cy="14.25" rx="4.5" ry="2" />
    <path d="M10.5 14.25v3.75c0 1.1 2.01 2 4.5 2s4.5-.9 4.5-2v-3.75" />
  </LineIcon>
);

/** A triangle with a mark: could not load. */
export const AlertLineIcon = (): React.JSX.Element => (
  <LineIcon>
    <path d="M10.7 4.5 3.3 17.25a1.5 1.5 0 0 0 1.3 2.25h14.8a1.5 1.5 0 0 0 1.3-2.25L13.3 4.5a1.5 1.5 0 0 0-2.6 0z" />
    <path d="M12 9.75v3.75M12 16.5h.01" />
  </LineIcon>
);

/** A star: favourites. */
export const StarLineIcon = (): React.JSX.Element => (
  <LineIcon>
    <path d="m12 3.75 2.55 5.17 5.7.83-4.13 4.02.98 5.68L12 16.77l-5.1 2.68.98-5.68-4.13-4.02 5.7-.83z" />
  </LineIcon>
);

/** A pie with a slice out: categories, the dashboard. */
export const PieLineIcon = (): React.JSX.Element => (
  <LineIcon>
    <path d="M11.25 4.5a7.5 7.5 0 1 0 8.25 8.25h-8.25z" />
    <path d="M14.25 3.75v6h6a6 6 0 0 0-6-6z" />
  </LineIcon>
);

/** Two arrows passing: transactions, payables and receivables. */
export const ArrowsLineIcon = (): React.JSX.Element => (
  <LineIcon>
    <path d="M4.5 8.25h14.25L15 4.5" />
    <path d="M19.5 15.75H5.25L9 19.5" />
  </LineIcon>
);
