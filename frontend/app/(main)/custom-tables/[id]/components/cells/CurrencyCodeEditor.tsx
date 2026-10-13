'use client';

import { CurrencyDrawer } from '@/app/components/receipts/components/CurrencyDrawer';
import { useCurrencyPickerState } from '@/app/hooks/useCurrencyPickerState';
import type { CustomTableCellValue } from '../../utils/types';

interface CurrencyCodeEditorProps {
  value: CustomTableCellValue;
  clearLabel: string;
  onChange: (code: string | null) => void;
  onClose: () => void;
}

/** Currency-code cells: the app's currency drawer opens at once; a pick saves and closes it. */
export function CurrencyCodeEditor({
  value,
  clearLabel,
  onChange,
  onClose,
}: CurrencyCodeEditorProps) {
  const current = typeof value === 'string' ? value : '';
  const picker = useCurrencyPickerState(current);
  const pick = (code: string | null) => {
    if (code !== (current.trim().toUpperCase() || null)) {
      onChange(code);
    }
    if (code) {
      picker.pushRecentCurrency(code);
    }
    onClose();
  };
  return (
    <CurrencyDrawer
      isOpen
      onClose={onClose}
      currencySearch={picker.currencySearch}
      setCurrencySearch={picker.setCurrencySearch}
      selectedCurrencyItem={picker.selectedCurrencyItem}
      selectedMatchesSearch={picker.selectedMatchesSearch}
      currencyQuery={picker.currencyQuery}
      recentCurrencyItems={picker.recentCurrencyItems}
      allCurrencyItems={picker.allCurrencyItems}
      handleSelectCurrency={code => pick(code)}
      noneOption={
        current ? { label: clearLabel, selected: false, onSelect: () => pick(null) } : undefined
      }
    />
  );
}
