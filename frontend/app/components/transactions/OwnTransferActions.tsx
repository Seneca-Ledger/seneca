'use client';

import { useIntlayer } from '@/app/i18n';
import { AccountPickSection } from './AccountPickSection';
import { useTransferToAccount } from './hooks/useTransferToAccount';
import { ActionRow } from './TransactionActionRow';
import type { Transaction } from './types';

interface OwnTransferActionsProps {
  transaction: Transaction;
  /** Opens the list of rows the transfer's other leg could be. */
  onLink: () => void;
  linkDisabled: boolean;
  onDone: () => void | Promise<void>;
}

/**
 * A transfer between the user's own accounts: link the other leg that is
 * already booked, or name the account the money went to (the leg is booked
 * there when it is missing).
 */
export function OwnTransferActions({
  transaction,
  onLink,
  linkDisabled,
  onDone,
}: OwnTransferActionsProps): React.JSX.Element {
  const t = useIntlayer('transactionsDrawer');
  const toAccount = useTransferToAccount(transaction, onDone);
  const split = Boolean(transaction.splitGroupId);
  return (
    <>
      <ActionRow
        label={t.transfer.link.value}
        hint={t.sheet.transferHint}
        onClick={onLink}
        disabled={linkDisabled || split}
      />
      <ActionRow
        label={t.transfer.toAccount.value}
        hint={t.sheet.toAccountHint}
        onClick={() => toAccount.setOpen(true)}
        disabled={toAccount.saving || split}
      />
      {toAccount.open && !toAccount.loading && (
        <AccountPickSection
          testId="transfer-accounts"
          title={t.transfer.pickAccount.value}
          empty={t.transfer.noAccounts.value.replace('{{currency}}', transaction.currency ?? '')}
          accounts={toAccount.options}
          saving={toAccount.saving}
          onPick={id => void toAccount.move(id)}
          onCancel={() => toAccount.setOpen(false)}
          cancelLabel={t.transfer.cancel.value}
        />
      )}
    </>
  );
}
