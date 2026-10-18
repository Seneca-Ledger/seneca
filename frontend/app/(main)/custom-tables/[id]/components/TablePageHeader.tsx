'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Pencil } from '@/app/components/icons';
import { Button } from '@/app/components/ui/button';
import { useCategoryName } from '@/app/lib/use-category-name';
import { formatStoredDate } from '@/app/lib/user-format-store';
import type { CustomTable } from '../utils/tableTypes';

export interface TablePageHeaderLabels {
  back: string;
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
  onBack: () => void;
  onRename: (name: string) => Promise<void>;
  /** The toolbar, drawn on the title's line so the grid starts higher. */
  actions?: ReactNode;
  labels: TablePageHeaderLabels;
}

/** Back arrow and editable title with a short meta line under it; the toolbar sits to the right. */
export function TablePageHeader({
  table,
  total,
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
    <header className="lumio-ct__header">
      <Button
        variant="ghost"
        size="icon"
        type="button"
        onClick={onBack}
        className="lumio-ct__back"
        aria-label={labels.back}
        title={labels.back}
      >
        <ArrowLeft size={18} aria-hidden />
      </Button>
      <div className="lumio-ct__title-row">
        {editing ? (
          <input
            className="lumio-ct__title-input"
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
          <h1 className="lumio-ct__title">
            {table.name || labels.untitled}
            <button
              type="button"
              className="lumio-ct__title-edit"
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
        <p className="lumio-ct__meta">
          {/* "Transactions · 860 rows" under a table named Transactions says it twice. */}
          {source && source !== table.name ? <span>{source}</span> : null}
          {total !== null ? <span>{labels.rows.replace('{{count}}', String(total))}</span> : null}
          {table.category ? <span>{categoryName(table.category.name)}</span> : null}
          {syncedAt ? (
            <span>{labels.syncedAt.replace('{{date}}', formatStoredDate(new Date(syncedAt)))}</span>
          ) : null}
        </p>
        {table.description ? <p className="lumio-ct__description">{table.description}</p> : null}
      </div>
      {actions}
    </header>
  );
}
