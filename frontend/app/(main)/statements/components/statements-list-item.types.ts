import type { StatementParsingDetails } from '@/app/lib/contracts';
import type { StatementColumn } from './columns/statement-columns';

export type StatementListItem = {
  id: string;
  source?: 'statement' | 'scan';
  receiptSource?: string;
  fileName: string;
  subject?: string;
  sender?: string;
  status: string;
  totalDebit?: number | string | null;
  totalCredit?: number | string | null;
  createdAt: string;
  statementDateFrom?: string | null;
  statementDateTo?: string | null;
  bankName: string;
  fileType: string;
  currency?: string | null;
  exported?: boolean | null;
  paid?: boolean | null;
  processedAt?: string;
  receivedAt?: string;
  parsedData?: {
    amount?: number;
    currency?: string;
    vendor?: string;
    date?: string;
    category?: string;
    categoryId?: string;
    lineItems?: Array<{ description: string; amount?: number }>;
  };
  category?: {
    id?: string | null;
    name?: string | null;
    color?: string | null;
    icon?: string | null;
  } | null;
  tags?: Array<{ id?: string; name?: string; color?: string | null }>;
  transactionSummary?: {
    description?: string | null;
    exchangeRate?: string | number | null;
    exchangeRateMixed?: boolean;
    cardLabel?: string | null;
    uncategorizedCount?: number;
  } | null;
  user?: {
    id: string;
    name?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
  } | null;
  errorMessage?: string | null;
  parsingDetails?: StatementParsingDetails | null;
};

export type DuplicateRole = 'primary' | 'suspected';

export type StatementsListItemProps = {
  dataTourId?: string;
  statement: StatementListItem;
  viewLabel: string;
  duplicateActionLabel?: string;
  isReceipt: boolean;
  isProcessing: boolean;
  merchantLabel: string;
  amountLabel: string;
  dateLabel: string;
  onView: () => void;
  onIconClick: () => void;
  onToggleSelect?: () => void;
  selected?: boolean;
  selectionDisabled?: boolean;
  typeLabel?: string;
  isManualExpense?: boolean;
  isPossibleDuplicate?: boolean;
  duplicatePosition?: number;
  duplicateGroupSize?: number;
  duplicateRole?: DuplicateRole;
  duplicateGroupLabel?: string;
  /** The row opens or closes a run of its duplicate group: the line on the left stops there. */
  duplicateGroupStart?: boolean;
  duplicateGroupEnd?: boolean;
  duplicateReason?: string;
  viewDisabled?: boolean;
  columns?: StatementColumn[];
  currentExchangeRateLabels?: Record<string, string>;
  workspaceCurrency?: string | null;
  /** Rows of this statement still in Review, or 1 for a receipt not yet approved. */
  pendingReview?: number;
  /** Rows the statement holds; with more than one, they open under the line. */
  transactionCount?: number;
  expanded?: boolean;
  onToggleExpand?: () => void;
  /** Opens the category drawer for a document that has none yet. */
  onAddCategory?: () => void;
};
