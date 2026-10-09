'use client';

import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import MuiSelect from '@mui/material/Select';
import * as React from 'react';

export type MultiSelectOption = {
  value: string;
  label: string;
};

export interface MultiSelectProps {
  value: string[];
  options: MultiSelectOption[];
  onChange: (value: string[]) => void;
  /** Shown when nothing is selected. */
  placeholder: string;
  /** Summary for three or more picks; `{{count}}` is replaced. */
  selectedLabel: string;
  'aria-label'?: string;
  disabled?: boolean;
}

const MAX_INLINE = 2;

/**
 * Compact multi-pick dropdown: selected names inline while they fit, a count
 * past that. Built on MUI's Select so it sits next to `Select` in forms.
 */
const MultiSelect = ({
  value,
  options,
  onChange,
  placeholder,
  selectedLabel,
  'aria-label': ariaLabel,
  disabled,
}: MultiSelectProps): React.ReactElement => {
  const labelOf = (item: string) => options.find(option => option.value === item)?.label ?? item;
  return (
    <MuiSelect
      multiple
      size="small"
      displayEmpty
      disabled={disabled}
      value={value}
      inputProps={{ 'aria-label': ariaLabel }}
      onChange={event => {
        const next = event.target.value;
        onChange(typeof next === 'string' ? next.split(',') : next);
      }}
      renderValue={selected => {
        if (!selected.length) {
          return <span className="lumio-multi-select__placeholder">{placeholder}</span>;
        }
        if (selected.length <= MAX_INLINE) {
          return selected.map(labelOf).join(', ');
        }
        return selectedLabel.replace('{{count}}', String(selected.length));
      }}
      MenuProps={{ slotProps: { paper: { sx: { maxHeight: 320 } } } }}
    >
      {options.map(option => (
        <MenuItem key={option.value} value={option.value} dense>
          <Checkbox size="small" checked={value.includes(option.value)} />
          <ListItemText
            primary={option.label}
            slotProps={{ primary: { noWrap: true, fontSize: 13 } }}
          />
        </MenuItem>
      ))}
    </MuiSelect>
  );
};

export { MultiSelect };
