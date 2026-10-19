'use client';

import MuiCheckbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import * as React from 'react';

export interface CheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  disabled?: boolean;
  indeterminate?: boolean;
  className?: string;
  label?: React.ReactNode;
  color?: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' | 'default';
  size?: 'small' | 'medium' | 'large';
  id?: string;
  name?: string;
  value?: string | number | readonly string[];
  required?: boolean;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  style?: React.CSSProperties;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
}

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  (
    {
      checked,
      defaultChecked,
      disabled,
      indeterminate,
      onCheckedChange,
      onChange,
      color = 'primary',
      size = 'small',
      label,
      className,
      style,
      'aria-label': ariaLabel,
      'aria-labelledby': ariaLabelledBy,
      ...props
    },
    ref,
  ) => {
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>, nextChecked: boolean) => {
      onCheckedChange?.(nextChecked);
      onChange?.(event);
    };

    const muiSize = size === 'large' ? 'medium' : (size as 'small' | 'medium');

    const checkbox = (
      <MuiCheckbox
        ref={ref}
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled}
        indeterminate={indeterminate}
        onChange={handleChange}
        color={color}
        size={muiSize}
        className={className}
        style={style}
        // MUI раскладывает неизвестные пропы на корневой span, поэтому подпись
        // нужно адресовать самому input — иначе чекбокс остаётся без имени и для
        // скринридеров, и для getByLabelText.
        slotProps={{ input: { 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy } }}
        {...props}
      />
    );

    if (label) {
      return <FormControlLabel control={checkbox} label={label} />;
    }

    return checkbox;
  },
);

Checkbox.displayName = 'Checkbox';

export { Checkbox };
