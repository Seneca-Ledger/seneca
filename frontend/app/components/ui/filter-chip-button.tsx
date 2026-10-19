'use client';

import Chip from '@mui/material/Chip';
import type { MouseEventHandler, ReactNode } from 'react';
import { forwardRef } from 'react';

type FilterChipButtonProps = {
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLElement>;
  className?: string;
  style?: React.CSSProperties;
  type?: 'button' | 'submit' | 'reset';
  'aria-pressed'?: boolean;
  'aria-label'?: string;
  id?: string;
};

export const FilterChipButton = forwardRef<HTMLDivElement, FilterChipButtonProps>(
  ({ children, active = false, className, disabled, onClick, style, ...props }, ref) => {
    return (
      <Chip
        ref={ref}
        label={children}
        clickable={!disabled}
        disabled={disabled}
        onClick={onClick as MouseEventHandler<HTMLDivElement> | undefined}
        variant={active ? 'filled' : 'outlined'}
        color={active ? 'primary' : 'default'}
        size="small"
        className={className}
        style={style}
        {...(props as object)}
      />
    );
  },
);

FilterChipButton.displayName = 'FilterChipButton';
