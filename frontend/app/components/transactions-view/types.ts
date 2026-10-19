'use client';

import type React from 'react';
import type { useIntlayer } from '@/app/i18n';

export type TransactionsViewT = ReturnType<typeof useIntlayer<'transactionsView'>>;

export type ColumnDef = {
  key: string;
  label: string;
  render?: (tx: import('../TransactionsView').Transaction) => React.ReactNode;
};
