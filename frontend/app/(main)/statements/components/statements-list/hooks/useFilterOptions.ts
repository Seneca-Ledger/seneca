'use client';

import { useMemo } from 'react';
import {
  getBankDisplayName,
  isGmailStatement,
  isStoreReceiptStatement,
  resolveStatementCurrency,
} from '@/app/(main)/statements/components/StatementsListView.utils';

interface StatementForOptions {
  id: string;
  source?: string;
  bankName: string;
  currency?: string | null;
  parsedData?: { currency?: string };
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
  } | null;
}

interface FromOption {
  id: string;
  label: string;
  description?: string | null;
  avatarUrl?: string | null;
  iconUrl?: string | null;
  bankName?: string | null;
}

interface UseFilterOptionsResult {
  fromOptions: FromOption[];
  currencyOptions: string[];
}

function buildUserOption(s: StatementForOptions): FromOption | null {
  if (!s.user?.id) {
    return null;
  }
  return {
    id: `user:${s.user.id}`,
    label: s.user.name || s.user.email || 'User',
    description: s.user.email ? `@${s.user.email.split('@')[0]}` : null,
    avatarUrl: s.user.avatarUrl || null,
  };
}

function buildBankLabel(s: StatementForOptions): string {
  if (isGmailStatement(s as Parameters<typeof isGmailStatement>[0])) {
    return 'Gmail';
  }
  if (isStoreReceiptStatement(s as Parameters<typeof isStoreReceiptStatement>[0])) {
    return 'Receipt';
  }
  return getBankDisplayName(s.bankName);
}

function buildBankOption(s: StatementForOptions): FromOption | null {
  if (!s.bankName) {
    return null;
  }
  return {
    id: `bank:${s.bankName}`,
    label: buildBankLabel(s),
    description: null,
    iconUrl: isGmailStatement(s as Parameters<typeof isGmailStatement>[0])
      ? '/icons/gmail.png'
      : null,
    bankName: s.bankName,
  };
}

export function useFilterOptions({
  stagedStatements,
}: {
  stagedStatements: StatementForOptions[];
}): UseFilterOptionsResult {
  const fromOptions = useMemo((): FromOption[] => {
    const seen = new Map<string, FromOption>();

    for (const s of stagedStatements) {
      const userOpt = buildUserOption(s);
      if (userOpt && !seen.has(userOpt.id)) {
        seen.set(userOpt.id, userOpt);
      }

      const bankOpt = buildBankOption(s);
      if (bankOpt && !seen.has(bankOpt.id)) {
        seen.set(bankOpt.id, bankOpt);
      }
    }

    return Array.from(seen.values());
  }, [stagedStatements]);

  const currencyOptions = useMemo((): string[] => {
    const unique = new Set<string>();
    for (const s of stagedStatements) {
      const cur = resolveStatementCurrency(s as Parameters<typeof resolveStatementCurrency>[0]);
      if (cur) {
        unique.add(cur);
      }
    }
    return Array.from(unique.values());
  }, [stagedStatements]);

  return { fromOptions, currencyOptions };
}
