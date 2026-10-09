'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { resolveCurrencyCode } from '@/app/lib/format-money';
import {
  buildSourcePayload,
  EMPTY_SOURCE_FILTERS,
  findSource,
  type SourceFilters,
  type SourceKind,
} from '../sources';
import {
  applyTemplate,
  buildTemplateColumnPayloads,
  TABLE_TEMPLATES,
  type TableTemplateId,
} from '../templates';

export interface CreateTableForm {
  name: string;
  description: string;
  categoryId: string;
  templateId: TableTemplateId | null;
  /** App data to fill the table from; exclusive with `templateId`. */
  sourceKind: SourceKind | null;
  sourceFilters: SourceFilters;
}

const EMPTY_FORM: CreateTableForm = {
  name: '',
  description: '',
  categoryId: '',
  templateId: null,
  sourceKind: null,
  sourceFilters: EMPTY_SOURCE_FILTERS,
};

interface UseCreateTableParams {
  /** Translated column titles per template column key. */
  columnTitles: Record<string, string>;
  messages: {
    created: string;
    createdFromSource: string;
    createFailed: string;
    applying: string;
    partialFailed: string;
  };
}

/**
 * "New table" dialog: creates the table, then applies the template columns one
 * by one; or, for an app data source, lets the server build columns and rows.
 */
export function useCreateTable({ columnTitles, messages }: UseCreateTableParams) {
  const router = useRouter();
  const { currentWorkspace } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CreateTableForm>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    setForm(EMPTY_FORM);
  }, []);

  const submit = useCallback(async () => {
    const name = form.name.trim();
    if (!name || creating) {
      return;
    }
    setCreating(true);
    const template = TABLE_TEMPLATES.find(item => item.id === form.templateId) ?? null;
    const source = findSource(form.sourceKind);
    await (async () => {
      if (source) {
        const response = await apiClient.post(
          '/custom-tables/from-source',
          buildSourcePayload({
            source,
            filters: form.sourceFilters,
            name,
            description: form.description,
            categoryId: form.categoryId,
            currency: resolveCurrencyCode(currentWorkspace?.currency),
            titles: columnTitles,
          }),
        );
        const created = (response.data?.data ?? response.data) as { tableId?: string } | null;
        toast.success(messages.createdFromSource);
        close();
        if (created?.tableId) {
          router.push(`/custom-tables/${created.tableId}`);
        }
        return;
      }
      const response = await apiClient.post('/custom-tables', {
        name,
        description: form.description.trim() || undefined,
        categoryId: form.categoryId || undefined,
      });
      const created = (response.data?.data ?? response.data) as { id?: string } | null;
      if (created?.id && template) {
        const toastId = toast.loading(messages.applying);
        const { failed } = await applyTemplate({
          tableId: created.id,
          payloads: buildTemplateColumnPayloads(template, {
            titles: columnTitles,
            currency: resolveCurrencyCode(currentWorkspace?.currency),
          }),
          post: async (url, body) => {
            const columnResponse = await apiClient.post(url, body);
            return columnResponse.data?.data ?? columnResponse.data ?? null;
          },
        });
        if (failed.length) {
          toast.error(messages.partialFailed, { id: toastId });
        } else {
          toast.success(messages.created, { id: toastId });
        }
      } else {
        toast.success(messages.created);
      }
      close();
      if (created?.id) {
        router.push(`/custom-tables/${created.id}`);
      }
    })()
      .catch(async error => {
        console.error('Failed to create table:', error);
        toast.error(getApiErrorMessage(error, messages.createFailed));
      })
      .finally(async () => {
        setCreating(false);
      });
  }, [form, creating, columnTitles, currentWorkspace?.currency, messages, router, close]);

  return { open, setOpen, form, setForm, creating, close, submit };
}
