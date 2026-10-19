'use client';

import MenuItem from '@mui/material/MenuItem';
import MuiSelect, { type SelectProps as MuiSelectProps } from '@mui/material/Select';
import * as React from 'react';
import { useIsMobile } from '@/app/hooks/useIsMobile';

/**
 * Chip-sized dropdown for dense toolbars and filter bars. Pair with `size="small"`.
 * The font size has to be set on the inner element: the theme sizes small inputs
 * through a compound selector that plain `sx` keys lose to.
 */
export const COMPACT_SELECT_SX = {
  color: 'var(--text-secondary)',
  backgroundColor: 'var(--card-bg)',
  '& .MuiSelect-select': { fontSize: 12 },
};

export type SelectOption = {
  value: string | number;
  label: React.ReactNode;
  disabled?: boolean;
};

export type SelectProps = Omit<
  MuiSelectProps<string | number>,
  'children' | 'native' | 'onChange'
> & {
  options: SelectOption[];
  onChange: (value: string) => void;
};

/**
 * Dropdown built on MUI's Select. Phones keep the platform picker — a real
 * `<select>`, which beats any custom menu on touch — while wider screens get
 * the themed MUI menu.
 */
const Select = ({ options, onChange, ...props }: SelectProps): React.ReactElement => {
  const isMobile = useIsMobile();

  return (
    <MuiSelect
      {...props}
      native={isMobile}
      displayEmpty={options.some(option => option.value === '')}
      onChange={event => onChange(String(event.target.value))}
    >
      {options.map(option =>
        isMobile ? (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ) : (
          <MenuItem key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </MenuItem>
        ),
      )}
    </MuiSelect>
  );
};

export { Select };
