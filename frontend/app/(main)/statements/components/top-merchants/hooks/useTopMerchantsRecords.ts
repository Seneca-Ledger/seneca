import { useMemo } from 'react';
import {
  applyStatementsFilters,
  type StatementFilterItem,
  type StatementFilters,
} from '@/app/(main)/statements/components/filters/statement-filters';
import type { AnalyticsFromOption } from '@/app/(main)/statements/components/shared-analytics.utils';
import {
  getBankDisplayName,
  mapGmailReceiptToMerchantRecord,
  mapTransactionToRecord,
} from '@/app/(main)/statements/components/top-merchants/helpers/top-merchants-mappers';
import type {
  TopMerchantFlowType,
  TopMerchantRecord,
} from '@/app/(main)/statements/components/top-merchants/top-merchants.types';
import type {
  GmailReceipt,
  StatementMeta,
  Transaction,
} from '@/app/(main)/statements/types/statement-types';
import { useIntlayer } from '@/app/i18n';

type StatementWithWorkspace = StatementMeta & StatementFilterItem;

type Params = {
  statements: StatementWithWorkspace[];
  transactions: Transaction[];
  gmailReceipts: GmailReceipt[];
  workspaceCurrency: string;
  appliedFilters: StatementFilters;
  searchInput: string;
  activeFlowType: TopMerchantFlowType;
};

export type FromOption = AnalyticsFromOption;

export type RecordsReturn = {
  allRecords: TopMerchantRecord[];
  flowFilteredRecords: TopMerchantRecord[];
  flowRecordsWithoutDateFilter: TopMerchantRecord[];
  fromOptions: FromOption[];
  currencyOptions: string[];
};

const orMatch = (s: string | null | undefined, q: string): boolean =>
  (s ?? '').toLowerCase().includes(q);

const matchesQuery = (r: TopMerchantRecord, query: string): boolean =>
  r.merchant.toLowerCase().includes(query) ||
  orMatch(r.sender, query) ||
  orMatch(r.subject, query) ||
  orMatch(r.paymentPurpose, query) ||
  orMatch(r.bankName, query);

const filterByQuery = (records: TopMerchantRecord[], searchInput: string): TopMerchantRecord[] => {
  const query = searchInput.trim().toLowerCase();
  if (!query) {
    return records;
  }
  return records.filter(r => matchesQuery(r, query));
};

const getUserLabel = (user: TopMerchantRecord['user'], userFallback: string): string =>
  user?.name ?? user?.email ?? userFallback;

const getUserDescription = (user: TopMerchantRecord['user']): string | null => {
  const email = user?.email;
  return email ? `@${email.split('@')[0]}` : null;
};

const buildUserOption = (record: TopMerchantRecord, userFallback: string): FromOption | null => {
  const uid = record.user?.id;
  if (!uid) {
    return null;
  }
  return {
    id: `user:${uid}`,
    label: getUserLabel(record.user, userFallback),
    description: getUserDescription(record.user),
  };
};

const buildBankOption = (bank: string): FromOption => ({
  id: `bank:${bank}`,
  label: bank === 'gmail' ? 'Gmail' : getBankDisplayName(bank),
  description: null,
  bankName: bank,
});

const buildFromOptions = (allRecords: TopMerchantRecord[], userFallback: string): FromOption[] => {
  const seen = new Map<string, FromOption>();
  allRecords.forEach(record => {
    const userOpt = buildUserOption(record, userFallback);
    if (userOpt && !seen.has(userOpt.id)) {
      seen.set(userOpt.id, userOpt);
    }
    const bank = record.bankName;
    if (bank && !seen.has(`bank:${bank}`)) {
      seen.set(`bank:${bank}`, buildBankOption(bank));
    }
  });
  return Array.from(seen.values());
};

export const useTopMerchantsRecords = ({
  statements,
  transactions,
  gmailReceipts,
  workspaceCurrency,
  appliedFilters,
  searchInput,
  activeFlowType,
}: Params): RecordsReturn => {
  const allRecords = useMemo<TopMerchantRecord[]>(() => {
    const statementById = new Map(statements.map(s => [s.id, s]));
    const mappedTransactions = transactions.map(item => {
      const meta = item.statementId ? statementById.get(item.statementId) : undefined;
      return mapTransactionToRecord(item, meta as StatementMeta | undefined, workspaceCurrency);
    });
    const txStatementIds = new Set(
      transactions.map(t => t.statementId).filter((id): id is string => Boolean(id)),
    );
    const mappedReceipts = gmailReceipts
      .filter(r => !txStatementIds.has(r.id))
      .map(r => mapGmailReceiptToMerchantRecord(r, workspaceCurrency));
    return [...mappedTransactions, ...mappedReceipts];
  }, [statements, transactions, gmailReceipts, workspaceCurrency]);

  const filteredRecords = useMemo(
    () =>
      filterByQuery(
        applyStatementsFilters<TopMerchantRecord>(allRecords, appliedFilters),
        searchInput,
      ),
    [allRecords, appliedFilters, searchInput],
  );

  const flowFilteredRecords = useMemo(
    () => filteredRecords.filter(r => r.flowType === activeFlowType),
    [filteredRecords, activeFlowType],
  );

  const recordsWithoutDateFilter = useMemo(
    () =>
      filterByQuery(
        applyStatementsFilters<TopMerchantRecord>(allRecords, { ...appliedFilters, date: null }),
        searchInput,
      ),
    [allRecords, appliedFilters, searchInput],
  );

  const flowRecordsWithoutDateFilter = useMemo(
    () => recordsWithoutDateFilter.filter(r => r.flowType === activeFlowType),
    [recordsWithoutDateFilter, activeFlowType],
  );

  const userFallback = useIntlayer('statementsAnalyticsRecords').userFallback.value;
  const fromOptions = useMemo(
    () => buildFromOptions(allRecords, userFallback),
    [allRecords, userFallback],
  );

  const currencyOptions = useMemo(
    () => Array.from(new Set(allRecords.map(r => r.currencyValue).filter(Boolean))),
    [allRecords],
  );

  return {
    allRecords,
    flowFilteredRecords,
    flowRecordsWithoutDateFilter,
    fromOptions,
    currencyOptions,
  };
};
