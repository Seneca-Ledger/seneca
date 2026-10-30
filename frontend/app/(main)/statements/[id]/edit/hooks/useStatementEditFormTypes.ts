import type { CategoryOption, Statement, Transaction } from '../editHelpers';
import type { CategoryTarget } from './category-target';

type MetaForm = {
  balanceStart: string;
  balanceEnd: string;
  statementDateFrom: string;
  statementDateTo: string;
};

export interface UseStatementEditFormReturn {
  statement: Statement | null;
  setStatement: React.Dispatch<React.SetStateAction<Statement | null>>;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  loading: boolean;
  saving: boolean;
  exportingToTable: boolean;
  optionsLoading: boolean;
  error: string;
  setError: React.Dispatch<React.SetStateAction<string>>;
  success: boolean;
  setSuccess: React.Dispatch<React.SetStateAction<boolean>>;
  selectedRows: Set<string>;
  setSelectedRows: React.Dispatch<React.SetStateAction<Set<string>>>;
  categories: CategoryOption[];
  bulkCategoryDialogOpen: boolean;
  setBulkCategoryDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  /** The rows the category drawer is open for; null when it serves the selection. */
  categoryTarget: CategoryTarget | null;
  bulkCategoryId: string;
  setBulkCategoryId: React.Dispatch<React.SetStateAction<string>>;
  metadataForm: MetaForm;
  setMetadataForm: React.Dispatch<React.SetStateAction<MetaForm>>;
  exportConfirmOpen: boolean;
  setExportConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>;
  parsingDetailsExpanded: boolean | null;
  setParsingDetailsExpanded: React.Dispatch<React.SetStateAction<boolean | null>>;
  balanceStartInputRef: React.RefObject<HTMLInputElement | null>;
  balanceEndInputRef: React.RefObject<HTMLInputElement | null>;
  loadData: () => Promise<void>;
  handleExportToCustomTable: () => Promise<void>;
  handleRowSelect: (id: string) => void;
  handleSelectAll: () => void;
  handleMetadataChange: (field: string, value: string) => void;
  handleResolveParsingWarning: (warning: string) => void;
  handleConvertDroppedSample: (
    sample: { transaction?: unknown },
    index: number,
    warning?: string,
  ) => Promise<void>;
  handleDelete: (transactionId: string) => Promise<void>;
  handleBulkDelete: (confirmMessage: string) => Promise<void>;
  handleOpenBulkCategory: () => void;
  /** Opens the category drawer for one row, from a click on its category. */
  handleOpenRowCategory: (transaction: Transaction) => void;
  /** Opens the category drawer for a set of rows: one payee's, or all still to file. */
  handleOpenRowsCategory: (rows: Transaction[]) => void;
  handleCloseCategory: () => void;
  /** Applies `categoryId` (picked in the drawer) to its rows, or to every selected row. */
  handleApplyCategory: (categoryId: string) => Promise<void>;
}
