import type React from 'react';
import {
  AlertLineIcon,
  ArrowsLineIcon,
  BellLineIcon,
  BulbLineIcon,
  CalendarLineIcon,
  ChartLineIcon,
  ClockLineIcon,
  CoinsLineIcon,
  DocumentLineIcon,
  FlagLineIcon,
  InvoiceLineIcon,
  LayersLineIcon,
  LockLineIcon,
  PeopleLineIcon,
  PieLineIcon,
  PlugLineIcon,
  ReceiptLineIcon,
  SearchLineIcon,
  StarLineIcon,
  TableLineIcon,
  TrashLineIcon,
} from './empty-state-icons';

/**
 * What each empty screen shows: one line icon in the neutral circle, the same
 * set everywhere, in place of the picture illustrations the app used to draw.
 * The names stay so every caller keeps saying what its screen is about.
 */
const ICONS = {
  activity: ClockLineIcon,
  advice: BulbLineIcon,
  'cash-bundle': CoinsLineIcon,
  clients: PeopleLineIcon,
  dashboard: PieLineIcon,
  favorites: StarLineIcon,
  goals: FlagLineIcon,
  integrations: PlugLineIcon,
  'load-error': AlertLineIcon,
  'money-bag': CoinsLineIcon,
  'net-worth': ChartLineIcon,
  'no-data': DocumentLineIcon,
  'no-results': SearchLineIcon,
  notifications: BellLineIcon,
  'page-error': AlertLineIcon,
  password: LockLineIcon,
  payables: InvoiceLineIcon,
  plugins: PlugLineIcon,
  receivables: InvoiceLineIcon,
  reports: DocumentLineIcon,
  security: LockLineIcon,
  sessions: LockLineIcon,
  'spend-over-time': ChartLineIcon,
  statements: DocumentLineIcon,
  storage: LayersLineIcon,
  subscriptions: CalendarLineIcon,
  tables: TableLineIcon,
  'top-categories': PieLineIcon,
  transactions: ArrowsLineIcon,
  trash: TrashLineIcon,
  'unapproved-cash': ReceiptLineIcon,
  workspaces: LayersLineIcon,
} as const satisfies Record<string, () => React.JSX.Element>;

export type EmptyStateIllustrationName = keyof typeof ICONS;

interface EmptyStateIllustrationProps {
  name: EmptyStateIllustrationName;
  /** Circle size: sm 56px, md 64px, lg 72px. */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function EmptyStateIllustration({
  name,
  size = 'md',
  className,
}: EmptyStateIllustrationProps): React.JSX.Element {
  const Icon = ICONS[name];
  return (
    <span
      aria-hidden="true"
      className={['lumio-empty-state__icon', `lumio-empty-state__icon--${size}`, className]
        .filter(Boolean)
        .join(' ')}
    >
      <Icon />
    </span>
  );
}
