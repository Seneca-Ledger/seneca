'use client';

import Box from '@mui/material/Box';
import { useEffect, useState } from 'react';
import { FilterActions } from '@/app/(main)/statements/components/filters/FilterActions';
import { FilterDropdown } from '@/app/(main)/statements/components/filters/FilterDropdown';
import { FilterOptionRow } from '@/app/(main)/statements/components/filters/FilterOptionRow';
import { DollarSign } from '@/app/components/icons';
import { FilterChipButton } from '@/app/components/ui/filter-chip-button';
import { useIntlayer } from '@/app/i18n';

interface CurrencyFilterDropdownProps {
  /** All currency codes present in the current dataset (e.g. ['GBP', 'USD', 'EUR']). */
  currencies: string[];
  /** Currently selected currency code, or null for "all". */
  value: string | null;
  onChange: (value: string | null) => void;
}

/**
 * Single-select dropdown for filtering transactions by currency.
 * Currencies list is derived from the loaded dataset, not hardcoded.
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type, @typescript-eslint/explicit-module-boundary-types, max-lines-per-function
export function CurrencyFilterDropdown({
  currencies,
  value,
  onChange,
}: CurrencyFilterDropdownProps) {
  const t = useIntlayer('currencyDisplayToggle');
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(value);

  useEffect(() => {
    if (!open) setPending(value);
  }, [value, open]);

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const handleApply = () => {
    onChange(pending);
    setOpen(false);
  };

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  const handleReset = () => {
    setPending(null);
    onChange(null);
    setOpen(false);
  };

  const trigger = (
    <FilterChipButton active={!!value} onClick={() => setOpen(o => !o)}>
      <DollarSign size={14} />
      {value ?? t.currency.value}
    </FilterChipButton>
  );

  if (currencies.length === 0) return null;

  return (
    <FilterDropdown open={open} onOpenChange={setOpen} trigger={trigger}>
      <Box
        sx={{
          maxHeight: 280,
          overflowY: 'auto',
          paddingRight: '4px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        {currencies.map(code => (
          <FilterOptionRow
            key={code}
            label={code}
            selected={pending === code}
            onClick={() => setPending(prev => (prev === code ? null : code))}
            variant="radio"
          />
        ))}
      </Box>
      <FilterActions
        onReset={handleReset}
        onApply={handleApply}
        applyLabel="OK"
        resetLabel="Reset"
      />
    </FilterDropdown>
  );
}
