'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Pencil } from '@/app/components/icons';
import { Button } from '@/app/components/ui/button';
import { PRIVATE_CLASS } from '@/app/components/ui/private-amount';
import { useCategoryName } from '@/app/lib/use-category-name';
import { formatStoredDate } from '@/app/lib/user-format-store';
import type { TableMoneyTotal } from '../hooks/useTableMoneyTotal';
import { formatCellNumber } from '../utils/numberFormat';
import type { CustomTable } from '../utils/tableTypes';

export interface TablePageHeaderLabels {
  back: string;
  /** Under the balance when some rows have no exchange rate; `{{currencies}}` lists them. */
  balanceMissingRates: string;
  rename: string;
  rows: string;
  sources: Record<string, string>;
  /** Names of app data sources a table can be filled from. */
  sourceKinds: Record<string, string>;
  syncedAt: string;
  untitled: string;
}

interface TablePageHeaderProps {
  table: CustomTable;
  total: number | null;
  /** The table's balance, drawn under the title; null until loaded or without a money column. */
  moneyTotal?: TableMoneyTotal | null;
  onBack: () => void;
  onRename: (name: string) => Promise<void>;
  /** The toolbar, drawn on the title's line so the grid starts higher. */
  actions?: ReactNode;
  labels: TablePageHeaderLabels;
}

const balanceTone = (total: number): string =>
  total > 0 ? ' seneca-ct__balance-value--up' : total < 0 ? ' seneca-ct__balance-value--down' : '';

/** The balance under the title: sage when positive, soft terracotta when negative, ink at zero. */
function TableBalance({
  total,
  currency,
  missing,
  missingLabel,
}: {
  total: number;
  currency: string;
  missing: readonly string[];
  missingLabel: string;
}) {
  return (
    <p className="seneca-ct__balance">
      <span className={`${PRIVATE_CLASS}${balanceTone(total)}`}>
        {/* A typographic minus, as in the grid's cells. */}
        {formatCellNumber(total, { currency, precision: 2 }).replace('-', '−')}
      </span>
      {missing.length ? (
        <span className="seneca-ct__balance-note">
          {missingLabel.replace('{{currencies}}', missing.join(', '))}
        </span>
      ) : null}
    </p>
  );
}

/** Back arrow and editable title with a short meta line under it; the toolbar sits to the right. */
export function TablePageHeader({
  table,
  total,
  moneyTotal,
  onBack,
  onRename,
  actions,
  labels,
}: TablePageHeaderProps) {
  const categoryName = useCategoryName();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(table.name);
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
    }
  }, [editing]);
  const kind = table.sourceBinding?.kind;
  const source = kind
    ? (labels.sourceKinds[kind] ?? kind)
    : (labels.sources[table.source] ?? table.source);
  const syncedAt = table.sourceBinding?.syncedAt;

  const commit = async () => {
    const next = name.trim();
    setEditing(false);
    if (next && next !== table.name) {
      await onRename(next);
    } else {
      setName(table.name);
    }
  };

  return (
    <header className="seneca-ct__header">
      <Button
        variant="ghost"
        size="icon"
        type="button"
        onClick={onBack}
        className="seneca-ct__back"
        aria-label={labels.back}
        title={labels.back}
      >
        <ArrowLeft size={18} aria-hidden />
      </Button>
      <div className="seneca-ct__title-row">
        {editing ? (
          <input
            className="seneca-ct__title-input"
            value={name}
            aria-label={labels.rename}
            ref={inputRef}
            onChange={event => setName(event.target.value)}
            onBlur={() => void commit()}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                void commit();
              } else if (event.key === 'Escape') {
                setName(table.name);
                setEditing(false);
              }
            }}
          />
        ) : (
          <h1 className="seneca-ct__title">
            {table.name || labels.untitled}
            <button
              type="button"
              className="seneca-ct__title-edit"
              aria-label={labels.rename}
              onClick={() => {
                setName(table.name);
                setEditing(true);
              }}
            >
              <Pencil size={14} aria-hidden />
            </button>
          </h1>
        )}
        {moneyTotal && moneyTotal.total !== null ? (
          <TableBalance
            total={moneyTotal.total}
            currency={moneyTotal.currency}
            missing={moneyTotal.missing}
            missingLabel={labels.balanceMissingRates}
          />
        ) : null}
        <p className="seneca-ct__meta">
          {/* "Transactions · 860 rows" under a table named Transactions says it twice. */}
          {source && source !== table.name ? <span>{source}</span> : null}
          {total !== null ? <span>{labels.rows.replace('{{count}}', String(total))}</span> : null}
          {table.category ? <span>{categoryName(table.category.name)}</span> : null}
          {syncedAt ? (
            <span>{labels.syncedAt.replace('{{date}}', formatStoredDate(new Date(syncedAt)))}</span>
          ) : null}
        </p>
        {table.description ? <p className="seneca-ct__description">{table.description}</p> : null}
      </div>
      {actions}
    </header>
  );
}
