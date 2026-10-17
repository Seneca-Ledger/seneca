'use client';

import type React from 'react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { ModalFooter, ModalShell } from '@/app/components/ui/modal-shell';
import {
  useReadOnlyWorkspace,
  useWorkspace,
  type WorkspaceVersionRef,
} from '@/app/contexts/WorkspaceContext';
import { useIntlayer, useLocale } from '@/app/i18n';
import { api } from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import { formatStoredDate, formatStoredDateTime } from '@/app/lib/user-format-store';

const BAR_STYLE: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '4px 12px',
  padding: '6px 16px',
  background: 'var(--surface-soft)',
  borderBottom: '1px solid var(--border)',
  color: 'var(--text-muted)',
  fontSize: 13,
};

/**
 * A slim strip across the top of the app while it shows an opened past
 * version: when it was taken, that nothing here can change, and the two ways
 * out (keep it as an ordinary workspace, or go back to the live one).
 */
export function VersionBanner(): React.JSX.Element | null {
  const { version } = useReadOnlyWorkspace();
  if (!version) {
    return null;
  }
  return <VersionBar version={version} />;
}

function VersionBar({ version }: { version: WorkspaceVersionRef }): React.JSX.Element {
  const t = useIntlayer('versionBanner');
  const { locale } = useLocale();
  const { currentWorkspace, switchWorkspace } = useWorkspace();
  const [copyOpen, setCopyOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [before = '', after = ''] = t.viewing.value.split('{{date}}');
  const defaultName = `${currentWorkspace?.name ?? ''} — ${formatStoredDate(version.takenAt, locale)}`;

  const goBack = (): void => {
    setLeaving(true);
    switchWorkspace(version.sourceWorkspaceId)
      // Done looking: the opened copy goes now rather than after a day idle.
      .then(() => api.delete(`/versions/${version.id}/open`).catch(() => undefined))
      .catch((error: unknown) => {
        setLeaving(false);
        toast.error(getApiErrorMessage(error));
      });
  };

  return (
    <div role="status" style={BAR_STYLE}>
      <span>
        {before}
        <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>
          {formatStoredDateTime(version.takenAt, locale)}
        </span>
        {after} · {t.readOnly}
      </span>
      <span style={{ display: 'inline-flex', gap: 8 }}>
        <Button variant="outline" size="sm" onClick={() => setCopyOpen(true)}>
          {t.saveAsCopy}
        </Button>
        <Button variant="ghost" size="sm" onClick={goBack} disabled={leaving}>
          {t.back}
        </Button>
      </span>
      {copyOpen && (
        <SaveCopyDialog
          versionId={version.id}
          defaultName={defaultName}
          onClose={() => setCopyOpen(false)}
        />
      )}
    </div>
  );
}

function SaveCopyDialog(props: {
  versionId: string;
  defaultName: string;
  onClose: () => void;
}): React.JSX.Element {
  const t = useIntlayer('versionBanner');
  const { refreshWorkspaces } = useWorkspace();
  const [name, setName] = useState(props.defaultName);
  const [saving, setSaving] = useState(false);

  const save = async (): Promise<void> => {
    setSaving(true);
    try {
      // Asked from inside the version: it is this workspace that becomes ordinary.
      const response = await api.post(`/versions/${props.versionId}/copy`, {
        name: name.trim(),
      } satisfies ContractInput<'CopyWorkspaceVersionBody'>);
      await checkContract('OpenedWorkspaceVersion', response.data, '/versions/:id/copy');
      props.onClose();
      toast(t.copied.value);
      await refreshWorkspaces();
    } catch (error: unknown) {
      setSaving(false);
      toast.error(getApiErrorMessage(error, t.copyFailed.value));
    }
  };

  return (
    <ModalShell
      isOpen
      onClose={props.onClose}
      size="sm"
      title={<span style={{ fontSize: 15, fontWeight: 500 }}>{t.copyTitle}</span>}
      footer={
        <ModalFooter
          onCancel={props.onClose}
          onConfirm={() => void save()}
          cancelText={t.cancel.value}
          confirmText={t.save.value}
          isConfirmLoading={saving}
          isConfirmDisabled={!name.trim()}
        />
      }
    >
      <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--text-muted)' }}>{t.copyHint}</p>
      <label
        htmlFor="version-copy-name"
        style={{ display: 'block', marginBottom: 6, fontSize: 13, color: 'var(--text-muted)' }}
      >
        {t.nameLabel}
      </label>
      <Input
        id="version-copy-name"
        value={name}
        maxLength={255}
        onChange={event => setName(event.target.value)}
      />
    </ModalShell>
  );
}
