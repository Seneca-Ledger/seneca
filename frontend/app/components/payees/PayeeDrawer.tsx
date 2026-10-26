'use client';

import { useDeferredValue, useEffect, useState } from 'react';
import { Check, ChevronLeft, Plus, Search } from '@/app/components/icons';
import { DrawerShell } from '@/app/components/ui/drawer-shell';
import { VendorIcon } from '@/app/components/VendorIcon';
import { useIntlayer } from '@/app/i18n';
import type { PayeeChoice, PayeeRef } from './types';
import { usePayeesList } from './usePayees';

/** A drawer has room for a long list; the search narrows it from there. */
const SHOWN = 50;

const fill = (template: string, params: Record<string, string>): string =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => params[key] ?? '');

/**
 * Picks a payee in a right-hand drawer, the way categories are picked
 * (StatementCategoryDrawer): search on top, the payees with their marks below,
 * a tick on the current one, and "Create …" for a name nobody has yet.
 */
export function PayeeDrawer({
  open,
  title,
  current,
  onClose,
  onPick,
  busy = false,
  existingOnly = false,
  hint,
}: {
  open: boolean;
  title: string;
  current: PayeeRef | null;
  onClose: () => void;
  onPick: (choice: PayeeChoice, name: string) => void;
  busy?: boolean;
  /** Only payees that exist: no "Create" row (merging needs one to fold in). */
  existingOnly?: boolean;
  /** A line under the search on what picking does. */
  hint?: React.ReactNode;
}): React.JSX.Element {
  const t = useIntlayer('payees');
  const [query, setQuery] = useState('');
  const search = useDeferredValue(query);
  // Loaded once opened; the list stays while the drawer slides away.
  const { data } = usePayeesList(search, SHOWN, 1, open);

  useEffect(() => {
    if (!open) {
      setQuery('');
    }
  }, [open]);

  const payees = (data?.data ?? []).filter(payee => !(existingOnly && payee.id === current?.id));
  const typed = query.trim();
  const canCreate =
    !existingOnly &&
    typed.length > 0 &&
    !payees.some(payee => payee.name.toLowerCase() === typed.toLowerCase());

  return (
    <DrawerShell
      isOpen={open}
      onClose={onClose}
      position="right"
      width="sm"
      showCloseButton={false}
      className="bg-card border-l-0"
      title={
        <div className="seneca-payable-drawer__title-wrap">
          <button
            type="button"
            onClick={onClose}
            className="seneca-col-drawer__back-btn"
            aria-label={t.cancel.value}
          >
            <ChevronLeft size={20} />
          </button>
          <span style={{ fontSize: 18, fontWeight: 600 }}>{title}</span>
        </div>
      }
    >
      <div className="seneca-cat-drawer">
        <div className="seneca-cat-drawer__search">
          <label className="seneca-cat-drawer__search-label">
            <Search size={18} className="seneca-cat-drawer__search-icon" />
            <input
              type="text"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={t.searchPlaceholder.value}
              aria-label={t.searchPlaceholder.value}
              className="seneca-cat-drawer__search-input"
            />
          </label>
          {hint && (
            <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>{hint}</p>
          )}
        </div>

        <div className="seneca-cat-drawer__list">
          {canCreate && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onPick({ name: typed }, typed)}
              className="seneca-cat-drawer__option"
            >
              <Plus size={18} aria-hidden />
              <span className="seneca-cat-drawer__option-name">
                {fill(t.createPayee.value, { name: typed })}
              </span>
            </button>
          )}
          {payees.length === 0 && !canCreate ? (
            <div className="seneca-cat-drawer__no-results">{t.noMatches}</div>
          ) : (
            payees.map(payee => {
              const selected = payee.id === current?.id;
              return (
                <button
                  key={payee.id}
                  type="button"
                  disabled={busy}
                  onClick={() => onPick({ payeeId: payee.id }, payee.name)}
                  className={`seneca-cat-drawer__option${selected ? ' seneca-cat-drawer__option--selected' : ''}`}
                >
                  <VendorIcon vendorName={payee.name} size={20} />
                  <span className="seneca-cat-drawer__option-name">{payee.name}</span>
                  {selected ? <Check size={18} color="var(--primary)" /> : null}
                </button>
              );
            })
          )}
        </div>
      </div>
    </DrawerShell>
  );
}
