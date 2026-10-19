import clsx from 'clsx';
import Link from 'next/link';
import type React from 'react';
import { forwardRef } from 'react';

export type ChipTone = 'default' | 'success' | 'warning' | 'danger' | 'info';

export interface ChipProps {
  active?: boolean;
  disabled?: boolean;
  /** Visually de-emphasised (e.g. a month with no data) but still focusable unless disabled. */
  muted?: boolean;
  size?: 'sm' | 'md';
  /** Static status pill colouring; ignored when `active`. */
  tone?: ChipTone;
  /** Renders a Link when set; otherwise a button (or a span when there is no handler). */
  href?: string;
  onClick?: () => void;
  /** Trailing muted count, e.g. saved-view sizes. */
  count?: number;
  'aria-pressed'?: boolean;
  'aria-label'?: string;
  title?: string;
  children: React.ReactNode;
}

function chipClassName(props: ChipProps): string {
  const { active, muted, size, tone } = props;
  return clsx(
    'seneca-chip',
    active && 'seneca-chip--active',
    muted && 'seneca-chip--muted',
    size === 'sm' && 'seneca-chip--sm',
    !active && tone && tone !== 'default' && `seneca-chip--tone-${tone}`,
  );
}

function ChipContent({
  children,
  count,
}: Pick<ChipProps, 'children' | 'count'>): React.JSX.Element {
  return (
    <>
      {children}
      {count !== undefined && <span className="seneca-chip__count">{count}</span>}
    </>
  );
}

export function Chip(props: ChipProps): React.JSX.Element {
  const { href, onClick, disabled, active, children, count, title } = props;
  const className = chipClassName(props);
  const ariaLabel = props['aria-label'];
  if (href && !disabled) {
    return (
      <Link href={href} className={className} aria-label={ariaLabel} title={title}>
        <ChipContent count={count}>{children}</ChipContent>
      </Link>
    );
  }
  if (!(onClick || href)) {
    return (
      <span className={className} title={title}>
        <ChipContent count={count}>{children}</ChipContent>
      </span>
    );
  }
  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={props['aria-pressed'] ?? Boolean(active)}
      aria-label={ariaLabel}
      title={title}
    >
      <ChipContent count={count}>{children}</ChipContent>
    </button>
  );
}

export interface ChipGroupProps {
  children: React.ReactNode;
  size?: 'sm' | 'md';
  /** Single horizontal row that scrolls on narrow screens. */
  scroll?: boolean;
  /** Wrap onto multiple lines. */
  wrap?: boolean;
  'aria-label'?: string;
  className?: string;
}

export const ChipGroup = forwardRef<HTMLDivElement, ChipGroupProps>(
  function ChipGroup(props, ref): React.JSX.Element {
    const { children, size, scroll, wrap, className } = props;
    return (
      // biome-ignore lint/a11y/useSemanticElements: a fieldset adds default borders/margins and is meant for form controls; these chips are filters/links
      <div
        ref={ref}
        role="group"
        aria-label={props['aria-label']}
        // Chrome leaves a partly visible element in place on focus, so in a scrolling row a
        // keyboard-focused chip (and its ring) stays cut at the edge; bring it into view.
        onFocus={
          scroll
            ? event => event.target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
            : undefined
        }
        className={clsx(
          'seneca-chip-group',
          scroll && 'seneca-chip-group--scroll',
          wrap && 'seneca-chip-group--wrap',
          size === 'sm' && 'seneca-chip-group--sm',
          className,
        )}
      >
        {children}
      </div>
    );
  },
);
