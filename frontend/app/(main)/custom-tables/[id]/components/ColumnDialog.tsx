'use client';

import { Checkbox } from '@/app/components/ui/checkbox';
import { ModalFooter, ModalShell } from '@/app/components/ui/modal-shell';
import { Select } from '@/app/components/ui/select';
import type { ColumnDialogState, ColumnDraft } from '../hooks/useColumnEditor';
import { COLOR_PRESETS } from '../utils/colorPalette';
import type { ColumnType, CustomTableColumn, SelectOptionDef } from '../utils/types';
import { OptionChip } from './cells/SelectEditors';
import { FormulaEditor } from './FormulaEditor';

export interface ColumnDialogLabels {
  addTitle: string;
  editTitle: string;
  name: string;
  namePlaceholder: string;
  type: string;
  types: Record<ColumnType, string>;
  currency: string;
  precision: string;
  format: string;
  formatPlain: string;
  formatPercent: string;
  expression: string;
  expressionHint: string;
  formulaPreview: string;
  formulaNoRows: string;
  formulaChecking: string;
  options: string;
  optionPlaceholder: string;
  addOption: string;
  removeOption: string;
  relationTarget: string;
  prompt: string;
  required: string;
  unique: string;
  save: string;
  cancel: string;
}

interface ColumnDialogProps {
  state: ColumnDialogState;
  draft: ColumnDraft;
  setDraft: React.Dispatch<React.SetStateAction<ColumnDraft>>;
  saving: boolean;
  tableId: string | null;
  /** Existing columns: formula autocomplete offers them by title. */
  columns: CustomTableColumn[];
  relationTargets: Array<{ id: string; name: string }>;
  onSave: () => void;
  onClose: () => void;
  labels: ColumnDialogLabels;
}

const COLUMN_TYPES: ColumnType[] = [
  'text',
  'number',
  'currency',
  'date',
  'boolean',
  'select',
  'multi_select',
  'formula',
  'relation',
  'ai',
];

const NUMERIC: ReadonlySet<ColumnType> = new Set(['number', 'currency', 'formula']);

function OptionsEditor({
  options,
  onChange,
  labels,
}: {
  options: SelectOptionDef[];
  onChange: (next: SelectOptionDef[]) => void;
  labels: ColumnDialogLabels;
}) {
  const add = (raw: string) => {
    const value = raw.trim();
    if (value && !options.some(option => option.value === value)) {
      onChange([...options, { value }]);
    }
  };
  return (
    <div className="lumio-ct__field lumio-ct__field--wide">
      <span className="lumio-ct__label">{labels.options}</span>
      <ul className="lumio-ct__options">
        {options.map((option, index) => (
          <li key={option.value} className="lumio-ct__option-row">
            <OptionChip option={option} />
            <span className="lumio-ct__swatches">
              {COLOR_PRESETS.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  aria-label={preset.id}
                  aria-pressed={option.color === preset.base}
                  className="lumio-ct__swatch"
                  style={{ backgroundColor: preset.base }}
                  onClick={() =>
                    onChange(
                      options.map((o, i) => (i === index ? { ...o, color: preset.base } : o)),
                    )
                  }
                />
              ))}
            </span>
            <button
              type="button"
              className="lumio-ct__link-btn"
              onClick={() => onChange(options.filter((_, i) => i !== index))}
            >
              {labels.removeOption}
            </button>
          </li>
        ))}
      </ul>
      <input
        className="lumio-ct__input"
        placeholder={labels.optionPlaceholder}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault();
            add(event.currentTarget.value);
            event.currentTarget.value = '';
          }
        }}
        onBlur={event => {
          add(event.currentTarget.value);
          event.currentTarget.value = '';
        }}
      />
    </div>
  );
}

function TypeFields({
  state,
  draft,
  setDraft,
  tableId,
  columns,
  relationTargets,
  labels,
}: Omit<ColumnDialogProps, 'saving' | 'onSave' | 'onClose'>) {
  const patch = (next: Partial<ColumnDraft>) => setDraft(prev => ({ ...prev, ...next }));
  return (
    <>
      {draft.type === 'currency' ? (
        <label className="lumio-ct__field">
          <span className="lumio-ct__label">{labels.currency}</span>
          <input
            className="lumio-ct__input"
            value={draft.currency}
            maxLength={3}
            onChange={event => patch({ currency: event.target.value.toUpperCase() })}
          />
        </label>
      ) : null}
      {NUMERIC.has(draft.type) ? (
        <label className="lumio-ct__field">
          <span className="lumio-ct__label">{labels.precision}</span>
          <input
            className="lumio-ct__input"
            type="number"
            min={0}
            max={8}
            value={draft.precision}
            onChange={event => patch({ precision: event.target.value })}
          />
        </label>
      ) : null}
      {draft.type === 'number' || draft.type === 'formula' ? (
        <div className="lumio-ct__field">
          <span className="lumio-ct__label">{labels.format}</span>
          <Select
            size="small"
            value={draft.format}
            onChange={next => patch({ format: next === 'percent' ? 'percent' : 'plain' })}
            options={[
              { value: 'plain', label: labels.formatPlain },
              { value: 'percent', label: labels.formatPercent },
            ]}
          />
        </div>
      ) : null}
      {draft.type === 'formula' ? (
        <FormulaEditor
          tableId={tableId}
          columnKey={state.mode === 'edit' ? state.column.key : null}
          columns={columns}
          value={draft.expression}
          onChange={expression => patch({ expression })}
          labels={labels}
        />
      ) : null}
      {draft.type === 'relation' ? (
        <div className="lumio-ct__field lumio-ct__field--wide">
          <span className="lumio-ct__label">{labels.relationTarget}</span>
          <Select
            size="small"
            value={draft.targetTableId}
            onChange={next => patch({ targetTableId: next })}
            options={[
              { value: '', label: '—' },
              ...relationTargets.map(t => ({ value: t.id, label: t.name })),
            ]}
          />
        </div>
      ) : null}
      {draft.type === 'ai' ? (
        <label className="lumio-ct__field lumio-ct__field--wide">
          <span className="lumio-ct__label">{labels.prompt}</span>
          <textarea
            className="lumio-ct__input"
            rows={3}
            value={draft.prompt}
            onChange={event => patch({ prompt: event.target.value })}
          />
        </label>
      ) : null}
      {draft.type === 'select' || draft.type === 'multi_select' ? (
        <OptionsEditor
          options={draft.options}
          onChange={options => patch({ options })}
          labels={labels}
        />
      ) : null}
    </>
  );
}

/** Add / edit column form; the type list is fixed by the backend. */
export function ColumnDialog(props: ColumnDialogProps) {
  const { state, draft, setDraft, saving, onSave, onClose, labels } = props;
  const patch = (next: Partial<ColumnDraft>) => setDraft(prev => ({ ...prev, ...next }));
  const open = state.mode !== 'closed';
  return (
    <ModalShell
      isOpen={open}
      onClose={onClose}
      size="md"
      title={state.mode === 'edit' ? labels.editTitle : labels.addTitle}
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={onSave}
          cancelText={labels.cancel}
          confirmText={labels.save}
          isConfirmLoading={saving}
          isConfirmDisabled={!draft.title.trim()}
        />
      }
    >
      <form
        className="lumio-ct__form"
        onSubmit={event => {
          event.preventDefault();
          onSave();
        }}
      >
        <label className="lumio-ct__field lumio-ct__field--wide">
          <span className="lumio-ct__label">{labels.name}</span>
          <input
            className="lumio-ct__input"
            value={draft.title}
            placeholder={labels.namePlaceholder}
            onChange={event => patch({ title: event.target.value })}
          />
        </label>
        <div className="lumio-ct__field">
          <span className="lumio-ct__label">{labels.type}</span>
          <Select
            size="small"
            value={draft.type}
            disabled={state.mode === 'edit'}
            onChange={next => patch({ type: next as ColumnType })}
            options={COLUMN_TYPES.map(type => ({ value: type, label: labels.types[type] }))}
          />
        </div>
        <TypeFields {...props} />
        <div className="lumio-ct__field lumio-ct__field--wide lumio-ct__checks">
          <Checkbox
            label={labels.required}
            checked={draft.isRequired}
            onCheckedChange={isRequired => patch({ isRequired })}
          />
          <Checkbox
            label={labels.unique}
            checked={draft.isUnique}
            onCheckedChange={isUnique => patch({ isUnique })}
          />
        </div>
      </form>
    </ModalShell>
  );
}
