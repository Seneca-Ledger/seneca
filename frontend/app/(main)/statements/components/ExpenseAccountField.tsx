'use client';

import { useQuery } from '@tanstack/react-query';
import { Select } from '@/app/components/ui/select';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

/**
 * Which account a manual expense left. Only accounts in the expense's currency
 * are offered (a euro payment cannot leave a dollar account), and nothing is
 * shown while the workspace has none.
 */
export function ExpenseAccountField({
  currency,
  value,
  onChange,
}: {
  currency: string;
  value: string | undefined;
  onChange: (walletId: string | undefined) => void;
}): React.JSX.Element | null {
  const t = useIntlayer('statementsCreateExpenseDrawer');
  const workspaceId = useWorkspaceId();
  const accounts = useQuery({
    queryKey: queryKeys.wallets(workspaceId),
    queryFn: ({ signal }) => apiQueryDecoded({ url: '/wallets', signal, contract: 'WalletList' }),
    enabled: Boolean(workspaceId),
  });
  const options = (accounts.data ?? []).filter(
    account => account.isActive && account.currency.toUpperCase() === currency.toUpperCase(),
  );
  if (options.length === 0) {
    return null;
  }
  return (
    <div className="seneca-expense-drawer__field">
      <label htmlFor="expense-manual-account" className="seneca-expense-drawer__label">
        {t.account}
      </label>
      <Select
        id="expense-manual-account"
        size="small"
        fullWidth
        value={value ?? ''}
        options={[
          { value: '', label: t.noAccount.value },
          ...options.map(account => ({ value: account.id, label: account.name })),
        ]}
        onChange={next => onChange(next || undefined)}
      />
    </div>
  );
}
