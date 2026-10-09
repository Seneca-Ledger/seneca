'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { ModalFooter, ModalShell } from '@/app/components/ui/modal-shell';
import { Select } from '@/app/components/ui/select';
import type { CreateTableForm } from '../hooks/useCreateTable';
import { useSourcePreview } from '../hooks/useSourcePreview';
import type { TableCategory } from '../hooks/useTablesList';
import { findSource, SOURCE_KINDS, type SourceKind } from '../sources';
import { TABLE_TEMPLATES, type TableTemplateId } from '../templates';
import { SourceFilterPanel, type SourceFilterPanelLabels } from './SourceFilterPanel';
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

/**
 * One card grid, switched between "blank or template" and "fill from app
 * data": the same nouns (Invoices, Payables…) exist in both, so showing them
 * side by side read as duplicates.
 */
function StartFromPicker({
  form,
  setForm,
  labels,
}: Pick<CreateTableDialogProps, 'form' | 'setForm' | 'labels'>) {
  const mode: StartMode = form.sourceKind ? 'source' : 'template';
  const pickTemplate = (id: TableTemplateId | null) =>
    setForm(prev => ({ ...prev, templateId: id, sourceKind: null }));
  const pickSource = (id: SourceKind) =>
    setForm(prev => ({
      ...prev,
      templateId: null,
      sourceKind: id,
      // A filled table is named after its source unless the user already typed a name.
      name: prev.name.trim() ? prev.name : (labels.sources[id]?.name ?? id),
    }));
  const tabs: Array<{ id: StartMode; label: string; onSelect: () => void }> = [
    { id: 'template', label: labels.groupTemplates, onSelect: () => pickTemplate(null) },
    {
      id: 'source',
      label: labels.groupSources,
      onSelect: () => pickSource(SOURCE_KINDS[0]?.id ?? 'transactions'),
    },
  ];
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
      <div className="lumio-ct__section-head">
        <h3 className="lumio-ct__section-title">{labels.templateLabel}</h3>
        <div className="lumio-ct__mode-tabs" role="tablist" aria-label={labels.templateLabel}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={mode === tab.id}
              className="lumio-ct__mode-tab"
              onClick={tab.onSelect}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
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
        <div className="lumio-ct__templates" role="radiogroup" aria-label={labels.groupSources}>
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
  const { open, form, setForm, creating, categories, onSubmit, onClose, labels } = props;
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
  const sourceBlocked = source !== null && (preview.preview?.count ?? 0) === 0;
  return (
    <ModalShell
      isOpen={open}
      onClose={onClose}
      size="lg"
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
        className="lumio-ct__form"
        onSubmit={event => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label className="lumio-ct__field lumio-ct__field--wide">
          <span className="lumio-ct__label">{labels.name}</span>
          <input
            className="lumio-ct__input"
            value={form.name}
            placeholder={labels.namePlaceholder}
            ref={nameRef}
            onChange={event => setForm(prev => ({ ...prev, name: event.target.value }))}
          />
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
        <StartFromPicker form={form} setForm={setForm} labels={labels} />
        {source ? (
          <div className="lumio-ct__field lumio-ct__field--wide">
            <SourceFilterPanel
              source={source}
              filters={form.sourceFilters}
              onChange={patch =>
                setForm(prev => ({ ...prev, sourceFilters: { ...prev.sourceFilters, ...patch } }))
              }
              categories={categories}
              preview={preview.preview}
              previewLoading={preview.loading}
              previewError={preview.error}
              labels={labels.sourcePanel}
            />
          </div>
        ) : null}
      </form>
    </ModalShell>
  );
}
