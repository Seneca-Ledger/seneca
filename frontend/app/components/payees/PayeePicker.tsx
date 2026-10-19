'use client';

import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useIntlayer } from '@/app/i18n';
import type { PayeeChoice, PayeeRef } from './types';
import { usePayeesList } from './usePayees';

const SUGGESTIONS = 20;

type Option = { kind: 'payee'; id: string; name: string } | { kind: 'create'; name: string };

function fill(template: string, params: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => params[key] ?? '');
}

/**
 * Picks the payee for a row: an existing one by name, or a new one typed in.
 * Typing a name that already exists picks that payee rather than a duplicate.
 */
export function PayeePicker({
  current,
  onPick,
  disabled,
}: {
  current: PayeeRef | null;
  onPick: (choice: PayeeChoice, name: string) => void;
  disabled?: boolean;
}) {
  const t = useIntlayer('payees');
  const [input, setInput] = useState('');
  const search = useDeferredValue(input);
  const { data, isFetching } = usePayeesList(search, SUGGESTIONS);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Opened in a popover, whose transition starts hidden: focusing on mount
  // (autoFocus) is lost, so focus once the popover has painted.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const options = useMemo<Option[]>(() => {
    const payees: Option[] = (data?.data ?? [])
      .filter(payee => payee.id !== current?.id)
      .map(payee => ({ kind: 'payee', id: payee.id, name: payee.name }));
    const typed = input.trim();
    const exists = (data?.data ?? []).some(
      payee => payee.name.toLowerCase() === typed.toLowerCase(),
    );
    return typed && !exists ? [...payees, { kind: 'create', name: typed }] : payees;
  }, [data, current?.id, input]);

  const choose = (option: Option | string | null) => {
    if (!option) return;
    if (typeof option === 'string') {
      const typed = option.trim();
      const match = (data?.data ?? []).find(
        payee => payee.name.toLowerCase() === typed.toLowerCase(),
      );
      if (match) onPick({ payeeId: match.id }, match.name);
      else if (typed) onPick({ name: typed }, typed);
      return;
    }
    if (option.kind === 'payee') onPick({ payeeId: option.id }, option.name);
    else onPick({ name: option.name }, option.name);
  };

  return (
    <Autocomplete<Option, false, false, true>
      freeSolo
      autoHighlight
      openOnFocus
      size="small"
      disabled={disabled}
      loading={isFetching}
      options={options}
      filterOptions={items => items}
      inputValue={input}
      onInputChange={(_event, value) => setInput(value)}
      onChange={(_event, option) => choose(option)}
      getOptionLabel={option =>
        typeof option === 'string'
          ? option
          : option.kind === 'create'
            ? fill(t.createPayee.value, { name: option.name })
            : option.name
      }
      isOptionEqualToValue={(option, value) =>
        option.kind === value.kind && option.name === value.name
      }
      renderInput={params => (
        <TextField
          {...params}
          inputRef={inputRef}
          placeholder={current?.name ?? t.searchPlaceholder.value}
          inputProps={{ ...params.inputProps, 'aria-label': t.payee.value }}
        />
      )}
      sx={{ minWidth: 260 }}
    />
  );
}
