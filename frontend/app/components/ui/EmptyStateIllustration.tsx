import Image from 'next/image';
import type React from 'react';

/**
 * Decorative illustrations shown when a page has no user content yet, or could not load it.
 * Sources: unDraw (https://undraw.co) — free for commercial use, no attribution required;
 * `load-error` (a broken app window) and `page-error` (a window under repair) are
 * drawn in-house in the same flat style.
 * Recolored to the Lumio palette so they read on both light and dark themes.
 * An entry with a `darkSrc` ships a second file instead, swapped by CSS on `.dark`.
 */
const ILLUSTRATIONS = {
  activity: { src: '/images/empty-states/activity.svg', width: 929, height: 744 },
  advice: {
    src: '/images/empty-states/advice.svg',
    darkSrc: '/images/empty-states/advice-dark.svg',
    width: 377,
    height: 379,
  },
  'cash-bundle': {
    src: '/images/empty-states/cash-bundle.svg',
    darkSrc: '/images/empty-states/cash-bundle-dark.svg',
    width: 367,
    height: 336,
  },
  clients: {
    src: '/images/empty-states/clients.svg',
    darkSrc: '/images/empty-states/clients-dark.svg',
    width: 375,
    height: 368,
  },
  dashboard: {
    src: '/images/empty-states/dashboard.svg',
    darkSrc: '/images/empty-states/dashboard-dark.svg',
    width: 357,
    height: 368,
  },
  favorites: { src: '/images/empty-states/favorites.svg', width: 675, height: 424 },
  goals: {
    src: '/images/empty-states/goals.svg',
    darkSrc: '/images/empty-states/goals-dark.svg',
    width: 435,
    height: 738,
  },
  integrations: {
    src: '/images/empty-states/integrations.svg',
    darkSrc: '/images/empty-states/integrations-dark.svg',
    width: 530,
    height: 888,
  },
  'load-error': { src: '/images/empty-states/load-error.svg', width: 640, height: 480 },
  'money-bag': {
    src: '/images/empty-states/money-bag.svg',
    darkSrc: '/images/empty-states/money-bag-dark.svg',
    width: 376,
    height: 361,
  },
  'net-worth': {
    src: '/images/empty-states/net-worth.svg',
    darkSrc: '/images/empty-states/net-worth-dark.svg',
    width: 570,
    height: 743,
  },
  'no-data': {
    src: '/images/empty-states/no-data.svg',
    darkSrc: '/images/empty-states/no-data-dark.svg',
    width: 370,
    height: 353,
  },
  'no-results': { src: '/images/empty-states/no-results.svg', width: 619, height: 800 },
  notifications: {
    src: '/images/empty-states/notifications.svg',
    darkSrc: '/images/empty-states/notifications-dark.svg',
    width: 489,
    height: 522,
  },
  'page-error': { src: '/images/empty-states/page-error.svg', width: 640, height: 480 },
  password: {
    src: '/images/empty-states/password.svg',
    darkSrc: '/images/empty-states/password-dark.svg',
    width: 343,
    height: 601,
  },
  payables: {
    src: '/images/empty-states/payables.svg',
    darkSrc: '/images/empty-states/payables-dark.svg',
    width: 740,
    height: 624,
  },
  plugins: { src: '/images/empty-states/plugins.svg', width: 960, height: 644 },
  receivables: {
    src: '/images/empty-states/receivables.svg',
    darkSrc: '/images/empty-states/receivables-dark.svg',
    width: 407,
    height: 348,
  },
  reports: {
    src: '/images/empty-states/reports.svg',
    darkSrc: '/images/empty-states/reports-dark.svg',
    width: 384,
    height: 389,
  },
  security: {
    src: '/images/empty-states/security.svg',
    darkSrc: '/images/empty-states/security-dark.svg',
    width: 365,
    height: 387,
  },
  sessions: {
    src: '/images/empty-states/sessions.svg',
    darkSrc: '/images/empty-states/sessions-dark.svg',
    width: 320,
    height: 373,
  },
  'spend-over-time': { src: '/images/empty-states/spend-over-time.svg', width: 711, height: 611 },
  statements: {
    src: '/images/empty-states/statements.svg',
    darkSrc: '/images/empty-states/statements-dark.svg',
    width: 336,
    height: 366,
  },
  storage: { src: '/images/empty-states/storage.svg', width: 858, height: 610 },
  subscriptions: {
    src: '/images/empty-states/subscriptions.svg',
    darkSrc: '/images/empty-states/subscriptions-dark.svg',
    width: 415,
    height: 372,
  },
  tables: {
    src: '/images/empty-states/tables.svg',
    darkSrc: '/images/empty-states/tables-dark.svg',
    width: 384,
    height: 389,
  },
  'top-categories': {
    src: '/images/empty-states/top-categories.svg',
    darkSrc: '/images/empty-states/top-categories-dark.svg',
    width: 564,
    height: 735,
  },
  transactions: { src: '/images/empty-states/transactions.svg', width: 799, height: 618 },
  trash: { src: '/images/empty-states/trash.svg', width: 960, height: 727 },
  'unapproved-cash': { src: '/images/empty-states/unapproved-cash.svg', width: 961, height: 880 },
  workspaces: { src: '/images/empty-states/workspaces.svg', width: 525, height: 531 },
} as const;

export type EmptyStateIllustrationName = keyof typeof ILLUSTRATIONS;

interface EmptyStateIllustrationProps {
  name: EmptyStateIllustrationName;
  /** Controls the rendered max width: sm 120px, md 180px, lg 240px. */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/** A `darkSrc` entry renders both files; CSS shows the one for the active theme. */
function themeVariants(
  illustration: (typeof ILLUSTRATIONS)[EmptyStateIllustrationName],
): readonly (readonly [string, string])[] {
  return 'darkSrc' in illustration
    ? [
        [illustration.src, 'lumio-empty-illustration--light-only'],
        [illustration.darkSrc, 'lumio-empty-illustration--dark-only'],
      ]
    : [[illustration.src, '']];
}

export function EmptyStateIllustration({
  name,
  size = 'md',
  className,
}: EmptyStateIllustrationProps): React.JSX.Element {
  const illustration = ILLUSTRATIONS[name];

  return (
    <>
      {themeVariants(illustration).map(([src, themeClass]) => (
        <Image
          key={src}
          src={src}
          alt=""
          aria-hidden="true"
          width={illustration.width}
          height={illustration.height}
          unoptimized
          className={[
            'lumio-empty-illustration',
            `lumio-empty-illustration--${size}`,
            themeClass,
            className,
          ]
            .filter(Boolean)
            .join(' ')}
        />
      ))}
    </>
  );
}
