import { useRef, useState } from 'react';
import type { CategoryOption, Statement, Transaction } from '../editHelpers';
import type { CategoryTarget } from './category-target';

type MetaForm = {
  balanceStart: string;
  balanceEnd: string;
  statementDateFrom: string;
  statementDateTo: string;
};

export type StatementFormStateResult = {
  statement: Statement | null;
  setStatement: React.Dispatch<React.SetStateAction<Statement | null>>;
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  exportingToTable: boolean;
  setExportingToTable: React.Dispatch<React.SetStateAction<boolean>>;
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  saving: boolean;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  error: string;
  setError: React.Dispatch<React.SetStateAction<string>>;
  success: boolean;
  setSuccess: React.Dispatch<React.SetStateAction<boolean>>;
  selectedRows: Set<string>;
  setSelectedRows: React.Dispatch<React.SetStateAction<Set<string>>>;
  categories: CategoryOption[];
  setCategories: React.Dispatch<React.SetStateAction<CategoryOption[]>>;
  optionsLoading: boolean;
  setOptionsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  bulkCategoryDialogOpen: boolean;
  setBulkCategoryDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  categoryTarget: CategoryTarget | null;
  setCategoryTarget: React.Dispatch<React.SetStateAction<CategoryTarget | null>>;
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
};

export function useStatementFormState(): StatementFormStateResult {
  const [statement, setStatement] = useState<Statement | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [exportingToTable, setExportingToTable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [bulkCategoryDialogOpen, setBulkCategoryDialogOpen] = useState(false);
  // The rows a category chip opened the drawer for; null while it serves the selection.
  const [categoryTarget, setCategoryTarget] = useState<CategoryTarget | null>(null);
  const [bulkCategoryId, setBulkCategoryId] = useState('');
  const [metadataForm, setMetadataForm] = useState({
    balanceStart: '',
    balanceEnd: '',
    statementDateFrom: '',
    statementDateTo: '',
  });
  const [exportConfirmOpen, setExportConfirmOpen] = useState(false);
  // null = the user hasn't toggled it yet; the page opens it only when parsing flagged something.
  const [parsingDetailsExpanded, setParsingDetailsExpanded] = useState<boolean | null>(null);
  const balanceStartInputRef = useRef<HTMLInputElement | null>(null);
  const balanceEndInputRef = useRef<HTMLInputElement | null>(null);
  return {
    statement,
    setStatement,
    transactions,
    setTransactions,
    exportingToTable,
    setExportingToTable,
    loading,
    setLoading,
    saving,
    setSaving,
    error,
    setError,
    success,
    setSuccess,
    selectedRows,
    setSelectedRows,
    categories,
    setCategories,
    optionsLoading,
    setOptionsLoading,
    bulkCategoryDialogOpen,
    setBulkCategoryDialogOpen,
    categoryTarget,
    setCategoryTarget,
    bulkCategoryId,
    setBulkCategoryId,
    metadataForm,
    setMetadataForm,
    exportConfirmOpen,
    setExportConfirmOpen,
    parsingDetailsExpanded,
    setParsingDetailsExpanded,
    balanceStartInputRef,
    balanceEndInputRef,
  };
}
