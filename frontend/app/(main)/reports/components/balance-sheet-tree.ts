import type { BalanceAccountNode } from '@/app/lib/contracts';

/** The balance sheet's pure helpers: dates for the picker, the tree's defaults, the export's file name. */

export const toDateInputValue = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const collectEditableValues = (
  accounts: BalanceAccountNode[],
  result: Record<string, string>,
): void => {
  for (const account of accounts) {
    if (account.isEditable) {
      result[account.id] = account.amount.toFixed(2);
    }
    if (account.children.length > 0) {
      collectEditableValues(account.children, result);
    }
  }
};

export const collectExpandableDefaults = (
  accounts: BalanceAccountNode[],
  result: Record<string, boolean>,
): void => {
  for (const account of accounts) {
    // A group with nothing in it starts collapsed; the user's own choice wins on refresh.
    if (account.isExpandable || account.children.length > 0) {
      result[account.id] = account.amount !== 0;
    }
    if (account.children.length > 0) {
      collectExpandableDefaults(account.children, result);
    }
  }
};

export const parseContentDispositionFileName = (contentDisposition?: string): string | null => {
  if (!contentDisposition) return null;

  const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1]);
  }

  const asciiMatch = /filename="?([^";]+)"?/i.exec(contentDisposition);
  if (asciiMatch?.[1]) {
    return asciiMatch[1];
  }

  return null;
};
