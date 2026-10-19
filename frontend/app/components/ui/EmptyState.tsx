import type React from 'react';
import { EmptyStateIllustration, type EmptyStateIllustrationName } from './EmptyStateIllustration';

type EmptyStatePicture =
  | { illustration: EmptyStateIllustrationName; icon?: never }
  /** A line icon from empty-state-icons, in a small circle: the quiet variant. */
  | { icon: React.ReactNode; illustration?: never };

export type EmptyStateProps = EmptyStatePicture & {
  /** Icon circle: sm 56px, md 64px, lg 72px. */
  size?: 'sm' | 'md' | 'lg';
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Usually a CTA button or link. */
  action?: React.ReactNode;
  /** One grey line under the action on what to start with, e.g. "Examples: …". */
  hint?: React.ReactNode;
  /** The whole page is empty: centre the block in the space below the header. */
  fill?: boolean;
  /** Tighter vertical padding for empty states inside a card. */
  compact?: boolean;
};

/** Empty state: line icon in a circle, optional title, one-line description, optional CTA. */
export function EmptyState({
  illustration,
  icon,
  size = 'md',
  title,
  description,
  action,
  hint,
  compact,
  fill,
}: EmptyStateProps): React.JSX.Element {
  return (
    <div
      className={[
        'seneca-empty-state',
        compact && 'seneca-empty-state--compact',
        fill && 'seneca-empty-state--fill',
        // Named illustrations are line icons now too: one look for every empty screen.
        'seneca-empty-state--icon',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {illustration ? (
        <EmptyStateIllustration name={illustration} size={size} />
      ) : (
        <span className="seneca-empty-state__icon">{icon}</span>
      )}
      {title && <h2 className="seneca-empty-state__title">{title}</h2>}
      {description && <p className="seneca-empty-state__desc">{description}</p>}
      {action && <div className="seneca-empty-state__action">{action}</div>}
      {hint && <p className="seneca-empty-state__hint">{hint}</p>}
    </div>
  );
}
