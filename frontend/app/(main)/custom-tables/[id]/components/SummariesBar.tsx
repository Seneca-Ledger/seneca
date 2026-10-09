'use client';

import { useState } from 'react';
import { Pencil, Trash2 } from '@/app/components/icons';
import { Button } from '@/app/components/ui/button';
import { ModalFooter, ModalShell } from '@/app/components/ui/modal-shell';
import { formatStoredDate } from '@/app/lib/user-format-store';
import type { SummaryInput, SummaryItem } from '../hooks/useTableSummaries';
import { formatCellNumber } from '../utils/numberFormat';
import type { CustomTableColumn } from '../utils/types';
import { FormulaEditor, type FormulaEditorLabels } from './FormulaEditor';

export interface SummariesLabels extends FormulaEditorLabels {
  title: string;
  add: string;
  edit: string;
  remove: string;
  empty: string;
  name: string;
  namePlaceholder: string;
  save: string;
  cancel: string;
  loadFailed: string;
  saveFailed: string;
}

interface SummariesBarProps {
  tableId: string | null;
  columns: CustomTableColumn[];
  items: SummaryItem[];
  saving: boolean;
  onUpsert: (input: SummaryInput) => Promise<boolean>;
  onRemove: (id: string) => Promise<boolean>;
  labels: SummariesLabels;
}

const formatValue = (item: SummaryItem): string => {
  if (item.error) {
    return item.error;
  }
  const { value } = item;
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'number') {
    return formatCellNumber(value, { precision: 2 });
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  if (item.resultType === 'date' && !Number.isNaN(new Date(value).getTime())) {
    return formatStoredDate(new Date(value));
  }
  return value;
};

type Draft = { id?: string; title: string; expression: string };

/** Formulas over the whole table, shown under the grid and edited in a small dialog. */
export function SummariesBar({
  tableId,
  columns,
  items,
  saving,
  onUpsert,
  onRemove,
  labels,
}: SummariesBarProps) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const canSave = Boolean(draft?.title.trim() && draft?.expression.trim());

  const submit = async () => {
    if (!(draft && canSave)) {
      return;
    }
    const ok = await onUpsert({
      id: draft.id,
      title: draft.title.trim(),
      expression: draft.expression.trim(),
    });
    if (ok) {
      setDraft(null);
    }
  };

  return (
    <section className="lumio-ct__summaries" aria-label={labels.title}>
      <div className="lumio-ct__section-head">
        <h3 className="lumio-ct__section-title">{labels.title}</h3>
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => setDraft({ title: '', expression: '' })}
        >
          {labels.add}
        </Button>
      </div>
      {items.length ? (
        <ul className="lumio-ct__summary-list">
          {items.map(item => (
            <li
              key={item.id}
              className={`lumio-ct__summary${item.error ? ' lumio-ct__summary--error' : ''}`}
            >
              <span className="lumio-ct__summary-title">{item.title}</span>
              <span className="lumio-ct__summary-value" title={item.expression}>
                {formatValue(item)}
              </span>
              <span className="lumio-ct__summary-actions">
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  aria-label={`${labels.edit}: ${item.title}`}
                  onClick={() =>
                    setDraft({ id: item.id, title: item.title, expression: item.expression })
                  }
                >
                  <Pencil size={14} aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  aria-label={`${labels.remove}: ${item.title}`}
                  disabled={saving}
                  onClick={() => void onRemove(item.id)}
                >
                  <Trash2 size={14} aria-hidden />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="lumio-ct__hint">{labels.empty}</p>
      )}
      <ModalShell
        isOpen={draft !== null}
        onClose={() => setDraft(null)}
        size="md"
        title={draft?.id ? labels.edit : labels.add}
        footer={
          <ModalFooter
            onCancel={() => setDraft(null)}
            onConfirm={() => void submit()}
            cancelText={labels.cancel}
            confirmText={labels.save}
            isConfirmLoading={saving}
            isConfirmDisabled={!canSave}
          />
        }
      >
        {draft ? (
          <form
            className="lumio-ct__form"
            onSubmit={event => {
              event.preventDefault();
              void submit();
            }}
          >
            <label className="lumio-ct__field lumio-ct__field--wide">
              <span className="lumio-ct__label">{labels.name}</span>
              <input
                className="lumio-ct__input"
                value={draft.title}
                placeholder={labels.namePlaceholder}
                onChange={event => setDraft({ ...draft, title: event.target.value })}
              />
            </label>
            <FormulaEditor
              tableId={tableId}
              columnKey={null}
              columns={columns}
              scope="table"
              value={draft.expression}
              onChange={expression => setDraft({ ...draft, expression })}
              labels={labels}
            />
          </form>
        ) : null}
      </ModalShell>
    </section>
  );
}
