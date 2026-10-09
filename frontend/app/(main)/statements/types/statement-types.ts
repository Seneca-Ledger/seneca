/**
 * Shared domain types used across the Top Analysis Views
 * (TopMerchantsView, TopSpendersView, TopCategoriesView).
 */

export type StatementMeta = {
  id: string;
  status?: string;
  createdAt?: string | null;
  statementDateFrom?: string | null;
  statementDateTo?: string | null;
  bankName?: string | null;
  fileType?: string | null;
  currency?: string | null;
  exported?: boolean | null;
  paid?: boolean | null;
  workspaceId?: string;
  workspaceName?: string;
  parsingDetails?: {
    metadataExtracted?: {
      currency?: string;
      headerDisplay?: {
        currencyDisplay?: string;
      };
    };
  } | null;
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
  } | null;
};

export type Transaction = {
  id: string;
  statementId?: string | null;
  /** Set when the row came from a synced crypto wallet instead of a statement. */
  cryptoWalletId?: string | null;
  counterpartyName?: string | null;
  transactionDate?: string | null;
  debit?: number | string | null;
  credit?: number | string | null;
  amount?: number | string | null;
  currency?: string | null;
  paymentPurpose?: string | null;
  transactionType?: 'income' | 'expense' | null;
  /** Confirmed by a person in Review; only confirmed rows count in any number. */
  isVerified?: boolean;
  createdAt?: string | null;
  workspaceId?: string;
  workspaceName?: string;
  /** Present in category-aware views */
  categoryId?: string | null;
  category?: {
    id?: string | null;
    name?: string | null;
    color?: string | null;
    icon?: string | null;
  } | null;
};

export type GmailReceipt = {
  id: string;
  subject: string;
  sender: string;
  receivedAt: string;
  status: string;
  /** 'gmail' | 'upload' | 'telegram' | 'scan' | 'imap' — where the receipt originated. */
  source?: string;
  /** Present in category-aware views */
  transactionId?: string | null;
  parsedData?: {
    amount?: number;
    currency?: string;
    vendor?: string;
    date?: string;
    /** Present in category-aware views */
    category?: string;
    categoryId?: string;
    transactionType?: 'income' | 'expense' | 'transfer' | 'unknown';
  };
  gmailMessageId?: string;
  workspaceId?: string;
  workspaceName?: string;
};
