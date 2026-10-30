'use client';

import Box from '@mui/material/Box';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { StatementTagsField } from '@/app/components/tags/RecordTagsField';
import { Select } from '@/app/components/ui/select';
import { ReadOnlyHint } from '@/app/components/versions/ReadOnlyHint';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { invalidateFinancialData } from '@/app/lib/invalidate-document-lists';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

type StatementRef = { id: string; currency?: string; walletId?: string | null };

/**
 * The account a statement belongs to, changed in place: picking another one
 * moves the statement with all its rows, "No account" takes it out. Only
 * accounts in the statement's currency are offered, and nothing is shown
 * while the workspace has none.
 */
function StatementAccountField({
  statement,
  onChanged,
}: {
  statement: StatementRef;
  onChanged: () => Promise<void>;
}): React.JSX.Element | null {
  const t = useIntlayer('statementsCreateExpenseDrawer');
  const accountsText = useIntlayer('accountsPage');
  const workspaceId = useWorkspaceId();
  const [saving, setSaving] = useState(false);
  const accounts = useQuery({
    queryKey: queryKeys.wallets(workspaceId),
    queryFn: ({ signal }) => apiQueryDecoded({ url: '/wallets', signal, contract: 'WalletList' }),
    enabled: Boolean(workspaceId),
  });
  const options = (accounts.data ?? []).filter(
    account =>
      account.id === statement.walletId ||
      (account.isActive && account.currency.toUpperCase() === statement.currency?.toUpperCase()),
  );
  if (options.length === 0) {
    return null;
  }

  const change = async (walletId: string) => {
    setSaving(true);
    try {
      if (walletId) {
        await apiClient.post(`/wallets/${walletId}/statements`, {
          statementIds: [statement.id],
        } satisfies ContractInput<'AttachStatementsBody'>);
      } else if (statement.walletId) {
        await apiClient.delete(`/wallets/${statement.walletId}/statements/${statement.id}`);
      }
      invalidateFinancialData();
      await onChanged();
    } catch (error) {
      toast.error(getApiErrorMessage(error, accountsText.failed.value));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ReadOnlyHint>
      <Box sx={{ display: 'grid', gap: 0.5, maxWidth: 320 }}>
        <label htmlFor="statement-account" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {t.account}
        </label>
        <Select
          id="statement-account"
          size="small"
          fullWidth
          disabled={saving}
          value={statement.walletId ?? ''}
          options={[
            { value: '', label: t.noAccount.value },
            ...options.map(account => ({ value: account.id, label: account.name })),
          ]}
          onChange={next => void change(next)}
        />
      </Box>
    </ReadOnlyHint>
  );
}

/** What the statement is filed under: its account and its tags. */
export function StatementDetailsFields({
  statement,
  onAccountChanged,
}: {
  statement: StatementRef;
  onAccountChanged: () => Promise<void>;
}): React.JSX.Element {
  return (
    <Box sx={{ mb: 2, display: 'grid', gap: 2 }}>
      <StatementAccountField statement={statement} onChanged={onAccountChanged} />
      <StatementTagsField statementId={statement.id} />
    </Box>
  );
}
