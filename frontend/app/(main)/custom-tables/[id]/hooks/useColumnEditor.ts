'use client';

import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import { normalizeSelectOptions } from '../utils/selectOptions';
import type {
  ColumnType,
  CustomTableColumn,
  CustomTableColumnConfig,
  SelectOptionDef,
} from '../utils/types';

export const DEFAULT_COLUMN_CURRENCY = FALLBACK_CURRENCY;

export interface ColumnDraft {
  title: string;
  type: ColumnType;
  currency: string;
  expression: string;
  isRequired: boolean;
  isUnique: boolean;
  targetTableId: string;
  prompt: string;
  /** Decimal places for number/currency/formula; empty means default. */
  precision: string;
  format: 'plain' | 'percent';
  options: SelectOptionDef[];
}

export const emptyColumnDraft = (currency = DEFAULT_COLUMN_CURRENCY): ColumnDraft => ({
  title: '',
  type: 'text',
  currency,
  expression: '',
  isRequired: false,
  isUnique: false,
  targetTableId: '',
  prompt: '',
  precision: '',
  format: 'plain',
  options: [],
});

export function draftFromColumn(
  column: CustomTableColumn,
  currency = DEFAULT_COLUMN_CURRENCY,
): ColumnDraft {
  const config = column.config ?? {};
  return {
    title: column.title,
    type: column.type,
    currency: typeof config.currency === 'string' ? config.currency : currency,
    expression: typeof config.expression === 'string' ? config.expression : '',
    isRequired: Boolean(column.isRequired),
    isUnique: Boolean(column.isUnique),
    targetTableId: typeof config.targetTableId === 'string' ? config.targetTableId : '',
    prompt: typeof config.prompt === 'string' ? config.prompt : '',
    precision: typeof config.precision === 'number' ? String(config.precision) : '',
    format: config.format === 'percent' ? 'percent' : 'plain',
    options: normalizeSelectOptions(config),
  };
}

const parsePrecision = (raw: string): number | undefined => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 8 ? parsed : undefined;
};

const numberFormatConfig = (draft: ColumnDraft): CustomTableColumnConfig => {
  const precision = parsePrecision(draft.precision);
  return {
    ...(precision === undefined ? {} : { precision }),
    ...(draft.format === 'percent' ? { format: 'percent' as const } : {}),
  };
};

export function buildColumnConfig(
  draft: ColumnDraft,
  defaultCurrency = DEFAULT_COLUMN_CURRENCY,
): CustomTableColumnConfig | undefined {
  switch (draft.type) {
    case 'currency':
      return {
        currency: (draft.currency || defaultCurrency).toUpperCase(),
        precision: parsePrecision(draft.precision) ?? 2,
      };
    case 'number': {
      const config = numberFormatConfig(draft);
      return Object.keys(config).length ? config : undefined;
    }
    case 'formula':
      return { expression: draft.expression.trim(), ...numberFormatConfig(draft) };
    case 'relation':
      return { targetTableId: draft.targetTableId };
    case 'ai':
      return { prompt: draft.prompt.trim() };
    case 'select':
    case 'multi_select':
      return { options: normalizeSelectOptions({ options: draft.options }) };
    default:
      return undefined;
  }
}

export type ColumnDialogState =
  | { mode: 'closed' }
  | { mode: 'add' }
  | { mode: 'edit'; column: CustomTableColumn };

interface UseColumnEditorParams {
  tableId: string | null;
  defaultCurrency: string;
  reloadTable: () => Promise<void>;
  messages: {
    saved: string;
    saveFailed: string;
    deleted: string;
    deleteFailed: string;
  };
}

export interface UseColumnEditorReturn {
  dialog: ColumnDialogState;
  draft: ColumnDraft;
  setDraft: React.Dispatch<React.SetStateAction<ColumnDraft>>;
  saving: boolean;
  openAdd: () => void;
  openEdit: (column: CustomTableColumn) => void;
  close: () => void;
  save: () => Promise<void>;
  deleteColumn: (column: CustomTableColumn) => Promise<void>;
}

const buildBody = (draft: ColumnDraft, currency: string) => {
  const config = buildColumnConfig(draft, currency);
  return {
    title: draft.title.trim(),
    type: draft.type,
    isRequired: draft.isRequired,
    isUnique: draft.isUnique,
    ...(config ? { config } : {}),
  };
};

/** One dialog state machine for adding and editing a column. */
export function useColumnEditor({
  tableId,
  defaultCurrency,
  reloadTable,
  messages,
}: UseColumnEditorParams): UseColumnEditorReturn {
  const [dialog, setDialog] = useState<ColumnDialogState>({ mode: 'closed' });
  const [draft, setDraft] = useState<ColumnDraft>(() => emptyColumnDraft(defaultCurrency));
  const [saving, setSaving] = useState(false);

  const openAdd = useCallback(() => {
    setDraft(emptyColumnDraft(defaultCurrency));
    setDialog({ mode: 'add' });
  }, [defaultCurrency]);

  const openEdit = useCallback(
    (column: CustomTableColumn) => {
      setDraft(draftFromColumn(column, defaultCurrency));
      setDialog({ mode: 'edit', column });
    },
    [defaultCurrency],
  );

  const close = useCallback(() => setDialog({ mode: 'closed' }), []);

  const save = useCallback(async () => {
    if (!tableId || dialog.mode === 'closed' || !draft.title.trim()) {
      return;
    }
    setSaving(true);
    const body = buildBody(draft, defaultCurrency);
    await (async () => {
      if (dialog.mode === 'add') {
        await apiClient.post(`/custom-tables/${tableId}/columns`, body);
      } else {
        await apiClient.patch(`/custom-tables/${tableId}/columns/${dialog.column.id}`, body);
      }
      toast.success(messages.saved);
      setDialog({ mode: 'closed' });
      await reloadTable();
    })()
      .catch(async error => {
        console.error('Failed to save column:', error);
        toast.error(getApiErrorMessage(error, messages.saveFailed));
      })
      .finally(async () => {
        setSaving(false);
      });
  }, [tableId, dialog, draft, defaultCurrency, reloadTable, messages]);

  const deleteColumn = useCallback(
    async (column: CustomTableColumn) => {
      if (!tableId) {
        return;
      }
      await (async () => {
        await apiClient.delete(`/custom-tables/${tableId}/columns/${column.id}`);
        toast.success(messages.deleted);
        await reloadTable();
      })().catch(async error => {
        console.error('Failed to delete column:', error);
        toast.error(getApiErrorMessage(error, messages.deleteFailed));
      });
    },
    [tableId, reloadTable, messages],
  );

  return { dialog, draft, setDraft, saving, openAdd, openEdit, close, save, deleteColumn };
}
