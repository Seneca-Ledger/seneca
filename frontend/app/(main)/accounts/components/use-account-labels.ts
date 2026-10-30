'use client';

import { useIntlayer } from '@/app/i18n';
import type { WalletType } from '@/app/lib/contracts';
import type { AccountGroup } from '../account-types';

/** The words for account types and the page's groups, from the page dictionary. */
export function useAccountLabels() {
  const t = useIntlayer('accountsPage');
  const types: Record<WalletType, string> = {
    checking: t.typeChecking.value,
    cash: t.typeCash.value,
    savings: t.typeSavings.value,
    deposit: t.typeDeposit.value,
    brokerage: t.typeBrokerage.value,
    credit_card: t.typeCreditCard.value,
    loan: t.typeLoan.value,
  };
  const groups: Record<AccountGroup, string> = {
    everyday: t.groupEveryday.value,
    savings: t.groupSavings.value,
    investments: t.groupInvestments.value,
    debts: t.groupDebts.value,
  };
  return { types, groups };
}
