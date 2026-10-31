'use client';

import { useEffect, useRef } from 'react';
import apiClient from '@/app/lib/api';
import { checkContract } from '@/app/lib/query-fn-schema';
import type { Transaction } from '../editHelpers';
import { needsCategory } from '../helpers/payee-groups';

/**
 * Each time a statement is opened with rows still waiting, asks the server for
 * fresh suggestions: what payees' history learned since, receipts added since
 * and rules written since reach it. Reloads the rows only when something
 * changed.
 */
export function useResuggest(
  statementId: string,
  transactions: Transaction[],
  reload: () => Promise<void>,
): void {
  const askedFor = useRef<string | null>(null);
  const waiting = transactions.some(needsCategory);

  useEffect(() => {
    if (!(statementId && waiting) || askedFor.current === statementId) {
      return;
    }
    askedFor.current = statementId;
    const url = `/classification/statements/${statementId}/suggestions`;
    void apiClient
      .post(url)
      .then(response => checkContract('StatementSuggestionsResult', response.data, url))
      .then(result => (result.suggested > 0 ? reload() : undefined))
      // A missed suggestion leaves the rows as they are: nothing to tell the user.
      .catch(() => undefined);
  }, [statementId, waiting, reload]);
}
