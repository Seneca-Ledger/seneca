'use client';

import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useIntlayer } from '@/app/i18n';
import type { PayeeChoice, PayeeRef } from './types';
import { usePayeesList } from './usePayees';

const SUGGESTIONS = 20;
/** A drawer has the room for a longer list. */
const INLINE_SUGGESTIONS = 50;

/**
 * The list as part of the drawer rather than a layer over the page: always
 * shown, as long as it needs to be, scrolled with the drawer, and leaving with
 * it when the drawer slides away.
 */
function InlineList({
  open,
  className,
  children,
}: {
  open: boolean;
  className?: string;
  children?: React.ReactNode;
}): React.JSX.Element | null {
  return open ? <div className={className}>{children}</div> : null;
}

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
  inline = false,
  existingOnly = false,
}: {
  current: PayeeRef | null;
  onPick: (choice: PayeeChoice, name: string) => void;
  disabled?: boolean;
  /** In a drawer: the list opens under the field, inside the drawer, as wide as the field. */
  inline?: boolean;
  /** Only payees that exist: no "create" option (merging needs one to fold in). */
  existingOnly?: boolean;
}) {
  const t = useIntlayer('payees');
  const [input, setInput] = useState('');
  const search = useDeferredValue(input);
  const { data, isFetching } = usePayeesList(search, inline ? INLINE_SUGGESTIONS : SUGGESTIONS);
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
    return typed && !exists && !existingOnly
      ? [...payees, { kind: 'create', name: typed }]
      : payees;
  }, [data, current?.id, input, existingOnly]);

  const choose = (option: Option | string | null) => {
    if (!option) return;
    if (typeof option === 'string') {
      const typed = option.trim();
      const match = (data?.data ?? []).find(
        payee => payee.name.toLowerCase() === typed.toLowerCase(),
      );
      if (match) onPick({ payeeId: match.id }, match.name);
      else if (typed && !existingOnly) onPick({ name: typed }, typed);
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
      {...(inline
        ? {
            open: true,
            slots: { popper: InlineList },
            slotProps: {
              paper: { elevation: 0, sx: { bgcolor: 'transparent', mt: 1 } },
              listbox: { sx: { maxHeight: 'none', p: 0 } },
            },
          }
        : {})}
      sx={{ minWidth: 260 }}
    />
  );
}
