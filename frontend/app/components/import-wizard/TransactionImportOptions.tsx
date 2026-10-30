'use client';

import { useQuery } from '@tanstack/react-query';
import { Checkbox } from '@/app/components/ui/checkbox';
import { Select } from '@/app/components/ui/select';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

/**
 * What an imported bank export also needs: the account it came from (picking
 * one sets the sheet's currency to the account's) and whether rows without a
 * category are categorized. With no account picked, the server files the sheet
 * where earlier exports with the same header row went.
 */
export function TransactionImportOptions({
  categorize,
  onCategorizeChange,
  walletId,
  onWalletChange,
  onCurrencyChange,
}: {
  categorize: boolean;
  onCategorizeChange: (value: boolean) => void;
  walletId: string;
  onWalletChange: (walletId: string) => void;
  onCurrencyChange: (currency: string) => void;
}): React.JSX.Element {
  const t = useIntlayer('importWizard');
  const expense = useIntlayer('statementsCreateExpenseDrawer');
  const workspaceId = useWorkspaceId();
  const accounts = useQuery({
    queryKey: queryKeys.wallets(workspaceId),
    queryFn: ({ signal }) => apiQueryDecoded({ url: '/wallets', signal, contract: 'WalletList' }),
    enabled: Boolean(workspaceId),
  });
  const active = (accounts.data ?? []).filter(
    account => account.isActive || account.id === walletId,
  );

  return (
    <>
      {active.length > 0 && (
        <div className="seneca-iw__control">
          <span className="seneca-iw__label">{expense.account}</span>
          <Select
            size="small"
            fullWidth
            aria-label={expense.account.value}
            value={walletId}
            options={[
              { value: '', label: expense.noAccount.value },
              ...active.map(account => ({
                value: account.id,
                label: `${account.name} · ${account.currency}`,
              })),
            ]}
            onChange={next => {
              onWalletChange(next);
              const picked = active.find(account => account.id === next);
              if (picked) {
                onCurrencyChange(picked.currency.toUpperCase());
              }
            }}
            data-testid="import-wizard-account"
          />
        </div>
      )}
      <div className="seneca-iw__check">
        <Checkbox checked={categorize} onCheckedChange={onCategorizeChange} />
        <span>{t.categorize}</span>
      </div>
    </>
  );
}
