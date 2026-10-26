import type { SvgIconProps } from '@mui/material/SvgIcon';
import clsx from 'clsx';
import type React from 'react';

export interface CardEmptyProps {
  /** An MUI icon that says what the card would show, drawn large above the text. */
  icon: React.ComponentType<SvgIconProps>;
  children: React.ReactNode;
  /** Fills the box of a chart, so the card keeps its height with or without data. */
  fill?: boolean;
  className?: string;
}

/** What a dashboard card says when it has nothing to show: a large icon and one line. */
export function CardEmpty({
  icon: Icon,
  children,
  fill,
  className,
}: CardEmptyProps): React.JSX.Element {
  return (
    <div
      className={clsx(
        'seneca-dashboard__card-empty',
        fill && 'seneca-dashboard__card-empty--fill',
        className,
      )}
    >
      <span className="seneca-dashboard__card-empty-icon" aria-hidden="true">
        <Icon sx={{ fontSize: 32 }} />
      </span>
      <p className="seneca-dashboard__card-empty-text">{children}</p>
    </div>
  );
}
