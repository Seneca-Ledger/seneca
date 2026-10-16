'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { Check } from '@/app/components/icons';
import { ModalFooter, ModalShell } from '@/app/components/ui/modal-shell';
import { Select } from '@/app/components/ui/select';
import { TextTabs } from '@/app/components/ui/text-tabs';
import type { CreateTableForm } from '../hooks/useCreateTable';
import { useSourcePreview } from '../hooks/useSourcePreview';
import type { TableCategory } from '../hooks/useTablesList';
import {
  EMPTY_SOURCE_FILTERS,
  findSource,
  normalizeSourceFilters,
  SOURCE_KINDS,
  type SourceKind,
} from '../sources';
import { TABLE_TEMPLATES, type TableTemplateId } from '../templates';
import {
  SourceFilterFields,
  type SourceFilterPanelLabels,
  SourcePreviewPanel,
} from './SourceFilterPanel';
import { SourceIcon, TemplateIcon } from './StartIcons';

export interface TemplateCard {
  id: TableTemplateId | null;
  name: string;
  description: string;
  columnCount: number;
}

export interface CreateTableDialogLabels {
  title: string;
  name: string;
  namePlaceholder: string;
  description: string;
  descriptionPlaceholder: string;
  category: string;
  noCategory: string;
  templateLabel: string;
  columnsCount: string;
  blankName: string;
  blankDescription: string;
  templates: Record<TableTemplateId, { name: string; description: string }>;
  groupTemplates: string;
  groupSources: string;
  /** The line under 'Fill from Lumio' saying what it does. */
  sourcesHint: string;
  nameTaken: string;
  sources: Record<SourceKind, { name: string; description: string }>;
  /** Translated titles per source field, sent to the server on creation. */
  sourceColumnTitles: Record<string, string>;
  sourcePanel: SourceFilterPanelLabels;
  submit: string;
  creating: string;
  cancel: string;
}

interface CreateTableDialogProps {
  open: boolean;
  form: CreateTableForm;
  setForm: React.Dispatch<React.SetStateAction<CreateTableForm>>;
  creating: boolean;
  categories: TableCategory[];
  /** The tables already there: a new one should not repeat a name or a source. */
  existingTables?: Array<{ id: string; name: string; sourceBinding?: { kind: string } | null }>;
  onSubmit: () => void;
  onClose: () => void;
  labels: CreateTableDialogLabels;
}

function StartCard({
  checked,
  icon,
  name,
  description,
  columnCount,
  columnsCountLabel,
  onClick,
}: {
  checked: boolean;
  icon: ReactNode;
  name: string;
  description: string;
  columnCount: number;
  columnsCountLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      className="lumio-ct__template"
      onClick={onClick}
    >
      {checked ? (
        <span className="lumio-ct__template-check" aria-hidden="true">
          <Check size={14} />
        </span>
      ) : null}
      <span className="lumio-ct__template-icon">{icon}</span>
      <span className="lumio-ct__template-name">{name}</span>
      <span className="lumio-ct__template-desc">{description}</span>
      {columnCount ? (
        <span className="lumio-ct__template-count">
          {columnsCountLabel.replace('{{count}}', String(columnCount))}
        </span>
      ) : null}
    </button>
  );
}

type StartMode = 'template' | 'source';

const isTaken = (name: string, names: string[]): boolean => {
  const key = name.trim().toLocaleLowerCase();
  return names.some(existing => existing.trim().toLocaleLowerCase() === key);
};

/** "Transactions", or "Transactions 2" when a table of that name is already there. */
export function distinctName(base: string, names: string[]): string {
  let candidate = base;
  for (let n = 2; isTaken(candidate, names); n++) {
    candidate = `${base} ${n}`;
  }
  return candidate;
}

/**
 * One card grid, switched between "blank or template" and "fill from app
 * data": the same nouns (Invoices, Payables…) exist in both, so showing them
 * side by side read as duplicates.
 */
function StartFromPicker({
  form,
  setForm,
  labels,
  existingNames,
}: Pick<CreateTableDialogProps, 'form' | 'setForm' | 'labels'> & { existingNames: string[] }) {
  const mode: StartMode = form.sourceKind ? 'source' : 'template';
  const pickTemplate = (id: TableTemplateId | null) =>
    setForm(prev => ({ ...prev, templateId: id, sourceKind: null }));
  const pickSource = (id: SourceKind, suggestPeriod = false) =>
    setForm(prev => ({
      ...prev,
      templateId: null,
      sourceKind: id,
      // A first fill suggests this year; "All time" stays one click away.
      sourceFilters:
        suggestPeriod &&
        findSource(id)?.filterFields.includes('dateRange') &&
        !prev.sourceFilters.dateFrom &&
        !prev.sourceFilters.dateTo &&
        !prev.sourceFilters.ids.length
          ? { ...prev.sourceFilters, dateFrom: `${new Date().getFullYear()}-01-01` }
          : prev.sourceFilters,
      // A filled table is named after its source unless the user already typed a name.
      name: prev.name.trim()
        ? prev.name
        : distinctName(labels.sources[id]?.name ?? id, existingNames),
    }));
  const switchMode = (next: StartMode) => {
    if (next === mode) {
      return;
    }
    if (next === 'template') {
      pickTemplate(null);
    } else {
      pickSource(SOURCE_KINDS[0]?.id ?? 'transactions', true);
    }
  };
  const templateCards: TemplateCard[] = [
    { id: null, name: labels.blankName, description: labels.blankDescription, columnCount: 0 },
    ...TABLE_TEMPLATES.map(template => ({
      id: template.id,
      name: labels.templates[template.id]?.name ?? template.name,
      description: labels.templates[template.id]?.description ?? template.description,
      columnCount: template.columns.length,
    })),
  ];
  return (
    <div className="lumio-ct__field lumio-ct__field--wide lumio-ct__start">
      <span className="lumio-ct__label">{labels.templateLabel}</span>
      <TextTabs
        value={mode}
        onChange={switchMode}
        ariaLabel={labels.templateLabel}
        options={[
          { value: 'template', label: labels.groupTemplates },
          { value: 'source', label: labels.groupSources },
        ]}
      />
      {mode === 'source' ? <p className="lumio-ct__start-hint">{labels.sourcesHint}</p> : null}
      {mode === 'template' ? (
        <div className="lumio-ct__templates" role="radiogroup" aria-label={labels.groupTemplates}>
          {templateCards.map(card => (
            <StartCard
              key={card.id ?? 'blank'}
              checked={form.templateId === card.id}
              icon={<TemplateIcon id={card.id} />}
              name={card.name}
              description={card.description}
              columnCount={card.columnCount}
              columnsCountLabel={labels.columnsCount}
              onClick={() => pickTemplate(card.id)}
            />
          ))}
        </div>
      ) : (
        <div
          className="lumio-ct__templates lumio-ct__templates--compact"
          role="radiogroup"
          aria-label={labels.groupSources}
        >
          {SOURCE_KINDS.map(source => (
            <StartCard
              key={source.id}
              checked={form.sourceKind === source.id}
              icon={<SourceIcon id={source.id} />}
              name={labels.sources[source.id]?.name ?? source.name}
              description={labels.sources[source.id]?.description ?? source.description}
              columnCount={source.columnFields.length}
              columnsCountLabel={labels.columnsCount}
              onClick={() => pickSource(source.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Name, description, category and a template or app data source to start from. */
export function CreateTableDialog(props: CreateTableDialogProps) {
  const {
    open,
    form,
    setForm,
    creating,
    categories,
    existingTables = [],
    onSubmit,
    onClose,
    labels,
  } = props;
  const existingNames = existingTables.map(table => table.name);
  const nameRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (open) {
      window.setTimeout(() => nameRef.current?.focus(), 0);
    }
  }, [open]);
  const source = findSource(form.sourceKind);
  const preview = useSourcePreview({
    kind: form.sourceKind,
    filters: form.sourceFilters,
    columnTitles: labels.sourceColumnTitles,
  });
  const filtered = Object.keys(normalizeSourceFilters(form.sourceFilters)).some(
    key => key !== 'ids',
  );
  // The whole source, unfiltered: the "of N" of the count and the currency options.
  const whole = useSourcePreview({
    kind: form.sourceKind,
    filters: EMPTY_SOURCE_FILTERS,
    columnTitles: labels.sourceColumnTitles,
  });
  const sameSource = existingTables.find(table => table.sourceBinding?.kind === form.sourceKind);
  const sourceBlocked = source !== null && (preview.preview?.count ?? 0) === 0;
  const nameTaken = form.name.trim() !== '' && isTaken(form.name, existingNames ?? []);
  return (
    <ModalShell
      isOpen={open}
      onClose={onClose}
      size={source ? 'lg' : 'md'}
      paperSx={{ maxWidth: source ? 960 : 720 }}
      title={labels.title}
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={onSubmit}
          cancelText={labels.cancel}
          confirmText={creating ? labels.creating : labels.submit}
          isConfirmLoading={creating}
          isConfirmDisabled={!form.name.trim() || sourceBlocked}
        />
      }
    >
      <form
        className={source ? 'lumio-ct__create lumio-ct__create--split' : 'lumio-ct__create'}
        onSubmit={event => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="lumio-ct__form">
          <label className="lumio-ct__field lumio-ct__field--wide">
            <span className="lumio-ct__label">{labels.name}</span>
            <input
              className="lumio-ct__input"
              value={form.name}
              placeholder={labels.namePlaceholder}
              ref={nameRef}
              aria-invalid={nameTaken || undefined}
              aria-describedby={nameTaken ? 'ct-name-taken' : undefined}
              onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
            />
            {nameTaken ? (
              <span id="ct-name-taken" className="lumio-ct__field-note">
                {labels.nameTaken}
              </span>
            ) : null}
          </label>
          <label className="lumio-ct__field lumio-ct__field--wide">
            <span className="lumio-ct__label">{labels.description}</span>
            <input
              className="lumio-ct__input"
              value={form.description}
              placeholder={labels.descriptionPlaceholder}
              onChange={event => setForm(prev => ({ ...prev, description: event.target.value }))}
            />
          </label>
          <div className="lumio-ct__field lumio-ct__field--wide">
            <span className="lumio-ct__label">{labels.category}</span>
            <Select
              size="small"
              value={form.categoryId}
              onChange={categoryId => setForm(prev => ({ ...prev, categoryId }))}
              options={[
                { value: '', label: labels.noCategory },
                ...categories.map(category => ({ value: category.id, label: category.name })),
              ]}
            />
          </div>
          <StartFromPicker
            form={form}
            setForm={setForm}
            labels={labels}
            existingNames={existingNames}
          />
          {source ? (
            <div className="lumio-ct__field lumio-ct__field--wide">
              <SourceFilterFields
                source={source}
                filters={form.sourceFilters}
                onChange={patch =>
                  setForm(prev => ({ ...prev, sourceFilters: { ...prev.sourceFilters, ...patch } }))
                }
                categories={categories}
                currencies={whole.preview?.currencies ?? []}
                labels={labels.sourcePanel}
              />
            </div>
          ) : null}
        </div>
        {source ? (
          <aside className="lumio-ct__create-side">
            <SourcePreviewPanel
              source={source}
              sourceName={labels.sources[source.id]?.name ?? source.name}
              preview={preview.preview}
              total={filtered ? (whole.preview?.count ?? null) : null}
              loading={preview.loading}
              error={preview.error}
              existing={sameSource ? { id: sameSource.id, name: sameSource.name } : null}
              onResetFilters={
                filtered
                  ? () => setForm(prev => ({ ...prev, sourceFilters: EMPTY_SOURCE_FILTERS }))
                  : null
              }
              labels={labels.sourcePanel}
            />
          </aside>
        ) : null}
      </form>
    </ModalShell>
  );
}
