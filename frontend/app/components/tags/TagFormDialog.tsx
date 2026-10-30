'use client';

import { Button, OutlinedInput } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import { Input } from '@/app/components/ui/input';
import { FULL_SCREEN_ON_PHONE, ModalShell } from '@/app/components/ui/modal-shell';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import type { StorageTag } from '@/app/lib/contracts';
import { type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

interface TagFormDialogProps {
  open: boolean;
  /** The tag to edit; null creates a new one. */
  tag: StorageTag | null;
  onClose: () => void;
  /** A tag just created, as the server stored it. */
  onCreated?: (tag: StorageTag) => void;
}

const formFrom = (tag: StorageTag | null) => ({
  name: tag?.name ?? '',
  description: tag?.description ?? '',
  tagDate: tag?.tagDate ?? '',
});

/** Create or edit a tag: a name, and optionally a description and a date. */
export function TagFormDialog({ open, tag, onClose, onCreated }: TagFormDialogProps) {
  const t = useIntlayer('tagsPage');
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => formFrom(tag));
  const [saving, setSaving] = useState(false);
  const named = form.name.trim() !== '';

  // Every opening starts from the tag handed in (or a blank form).
  useEffect(() => {
    if (open) {
      setForm(formFrom(tag));
    }
  }, [open, tag]);

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    const description = form.description.trim();
    await (async () => {
      if (tag) {
        await apiClient.patch(`/tags/${tag.id}`, {
          name: form.name.trim(),
          // null clears a description or date the tag had.
          description: description || null,
          tagDate: form.tagDate || null,
        } satisfies ContractInput<'UpdateTagBody'>);
        toast.success(t.toasts.updated.value);
        // Document rows carry tag names: refresh them, not only the tag list.
        void queryClient.invalidateQueries({ queryKey: ['statements'] });
        void queryClient.invalidateQueries({ queryKey: ['receipt-documents'] });
      } else {
        const response = await apiClient.post('/tags', {
          name: form.name.trim(),
          description: description || undefined,
          tagDate: form.tagDate || undefined,
        } satisfies ContractInput<'CreateTagBody'>);
        toast.success(t.toasts.created.value);
        onCreated?.(await checkContract('StorageTag', response.data, '/tags'));
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.tags(workspaceId) });
      onClose();
    })()
      .catch(async error => {
        console.error('Failed to save tag:', error);
        toast.error(t.toasts.saveFailed.value);
      })
      .finally(() => setSaving(false));
  };

  return (
    <ModalShell
      isOpen={open}
      onClose={onClose}
      size="sm"
      paperSx={{ maxWidth: 480, ...FULL_SCREEN_ON_PHONE }}
      title={
        <span style={{ fontWeight: 500 }}>{tag ? t.dialog.editTitle : t.dialog.createTitle}</span>
      }
      footer={
        <>
          <Button
            type="button"
            variant="text"
            onClick={onClose}
            sx={{ color: 'var(--text-muted)', fontWeight: 500 }}
          >
            {t.dialog.cancel}
          </Button>
          <Button
            type="button"
            variant={named ? 'contained' : 'outlined'}
            onClick={() => void handleSave()}
            disabled={!named || saving}
          >
            {t.dialog.save}
          </Button>
        </>
      }
    >
      <form
        className="seneca-tag-dialog"
        onSubmit={event => {
          event.preventDefault();
          if (named && !saving) {
            void handleSave();
          }
        }}
      >
        <div className="seneca-tag-dialog__field">
          <label htmlFor="tag-name" className="seneca-tag-dialog__label">
            {t.columns.name}
          </label>
          <Input
            id="tag-name"
            autoFocus
            maxLength={64}
            value={form.name}
            placeholder={t.dialog.namePlaceholder.value}
            onChange={event => setForm({ ...form, name: event.target.value })}
          />
        </div>
        <div className="seneca-tag-dialog__field">
          <label htmlFor="tag-description" className="seneca-tag-dialog__label">
            {t.dialog.descriptionLabel}{' '}
            <span className="seneca-tag-dialog__optional">({t.dialog.optional})</span>
          </label>
          <OutlinedInput
            id="tag-description"
            multiline
            minRows={2}
            maxRows={5}
            value={form.description}
            inputProps={{ maxLength: 500 }}
            onChange={event => setForm({ ...form, description: event.target.value })}
            sx={{ width: '100%', fontSize: 16 }}
          />
        </div>
        <div className="seneca-tag-dialog__field">
          <label htmlFor="tag-date" className="seneca-tag-dialog__label">
            {t.columns.date}{' '}
            <span className="seneca-tag-dialog__optional">({t.dialog.optional})</span>
          </label>
          <CustomDatePicker
            id="tag-date"
            large
            value={form.tagDate}
            onChange={tagDate => setForm({ ...form, tagDate })}
            containerTestId="tag-date-picker"
          />
        </div>
      </form>
    </ModalShell>
  );
}
