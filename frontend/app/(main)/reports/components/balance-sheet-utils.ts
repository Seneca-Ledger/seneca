import { resolveLocaleTag } from '@/app/lib/user-format';
import type { BalanceAccountNode } from './BalanceAccountRow';

export type BalanceLabels = Record<string, { value?: string } | undefined>;

export type BalanceSheetResponse = {
  date: string;
  currency: string;
  assets: { total: number; sections: BalanceAccountNode[] };
  liabilities: { total: number; sections: BalanceAccountNode[] };
  difference: number;
  isBalanced: boolean;
};

export type BalanceExportFormat = 'excel' | 'pdf';

export const resolveLocale = (locale: string): string => {
  return resolveLocaleTag(locale);
};

export const toDateInputValue = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const buildEditableValues = (sections: BalanceAccountNode[]): Record<string, string> => {
  const result: Record<string, string> = {};
  const collect = (accounts: BalanceAccountNode[]): void => {
    for (const account of accounts) {
      if (account.isEditable) {
        result[account.id] = account.amount.toFixed(2);
      }
      if (account.children.length > 0) {
        collect(account.children);
      }
    }
  };
  collect(sections);
  return result;
};

export const buildExpandableDefaults = (
  sections: BalanceAccountNode[],
): Record<string, boolean> => {
  const result: Record<string, boolean> = {};
  const collect = (accounts: BalanceAccountNode[]): void => {
    for (const account of accounts) {
      if (account.isExpandable || account.children.length > 0) {
        result[account.id] = true;
      }
      if (account.children.length > 0) {
        collect(account.children);
      }
    }
  };
  collect(sections);
  return result;
};

export const parseContentDispositionFileName = (contentDisposition?: string): string | null => {
  if (!contentDisposition) {
    return null;
  }
  const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1]);
  }
  const asciiMatch = /filename="?([^";]+)"?/i.exec(contentDisposition);
  return asciiMatch?.[1] ?? null;
};

export const getLabel =
  (labels: BalanceLabels) =>
  (key: string, fallback: string): string =>
    labels[key]?.value ?? fallback;

export const sortedByPosition = (nodes: BalanceAccountNode[]): BalanceAccountNode[] => {
  const indexed = nodes.map((node, i) => ({ node, pos: node.position, i }));
  indexed.sort((x, y) => x.pos - y.pos || x.i - y.i);
  return indexed.map(entry => entry.node);
};
