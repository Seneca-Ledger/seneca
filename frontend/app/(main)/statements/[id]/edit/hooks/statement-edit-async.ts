import { toast } from 'react-hot-toast';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type {
  BranchOption,
  CategoryOption,
  Statement,
  Transaction,
  WalletOption,
} from '../editHelpers';
import {
  formatDate,
  normalizeDateInput,
  normalizeNumberInput,
  parseNullableNumber,
} from '../editHelpers';

type MetaForm = {
  balanceStart: string;
  balanceEnd: string;
  statementDateFrom: string;
  statementDateTo: string;
};

function extractApiData<T>(res: { data?: { data?: T } | T }): T {
  const d = res.data as { data?: T } | undefined;
  return (d?.data ?? res.data) as T;
}

function extractListData<T>(res: { data?: { data?: T[] } | T[] }): T[] {
  const d = res.data as { data?: T[] } | undefined;
  return (d?.data ?? res.data ?? []) as T[];
}

function extractMeta(statementData: Statement | null): Record<string, unknown> {
  const details = statementData?.parsingDetails as
    | { metadataExtracted?: Record<string, unknown> }
    | undefined;
  return details?.metadataExtracted ?? {};
}

function resolveField<T>(primary: T | null | undefined, fallback: unknown): T | null | undefined {
  const value = primary ?? fallback;
  return (value as T) ?? null;
}

function buildMetadataForm(
  statementData: Statement | null,
  meta: Record<string, unknown>,
): MetaForm {
  return {
    balanceStart: normalizeNumberInput(
      resolveField(statementData?.balanceStart, meta.balanceStart),
    ),
    balanceEnd: normalizeNumberInput(resolveField(statementData?.balanceEnd, meta.balanceEnd)),
    statementDateFrom: normalizeDateInput(
      resolveField(statementData?.statementDateFrom, meta.dateFrom),
    ),
    statementDateTo: normalizeDateInput(resolveField(statementData?.statementDateTo, meta.dateTo)),
  };
}

type LoadSetters = {
  setLoading: (v: boolean) => void;
  setOptionsLoading: (v: boolean) => void;
  setStatement: (v: Statement | null) => void;
  setTransactions: (v: Transaction[]) => void;
  setCategories: (v: CategoryOption[]) => void;
  setBranches: (v: BranchOption[]) => void;
  setWallets: (v: WalletOption[]) => void;
  setMetadataForm: (v: MetaForm) => void;
  setError: (v: string) => void;
};
type LoadMessages = { loadDataError: string };

export async function loadStatementData(
  statementId: string,
  messages: LoadMessages,
  set: LoadSetters,
): Promise<void> {
  try {
    set.setLoading(true);
    set.setOptionsLoading(true);
    const [sRes, tRes, cRes, bRes, wRes] = await Promise.all([
      apiClient.get(`/statements/${statementId}`),
      apiClient.get(`/transactions?statement_id=${statementId}&limit=1000`),
      apiClient.get('/categories'),
      apiClient.get('/branches'),
      apiClient.get('/wallets'),
    ]);
    const statementData = extractApiData<Statement>(sRes);
    set.setStatement(statementData);
    set.setTransactions(extractApiData<Transaction[]>(tRes));
    set.setCategories(extractListData<CategoryOption>(cRes));
    set.setBranches(extractListData<BranchOption>(bRes));
    set.setWallets(extractListData<WalletOption>(wRes));
    set.setMetadataForm(buildMetadataForm(statementData, extractMeta(statementData)));
  } catch (err: unknown) {
    set.setError(getApiErrorMessage(err, messages.loadDataError));
  } finally {
    set.setLoading(false);
    set.setOptionsLoading(false);
  }
}

function getExportTableId(response: {
  data?: { tableId?: string; id?: string };
}): string | undefined {
  return response?.data?.tableId ?? response?.data?.id;
}

function buildExportName(prefix: string, fileName: string): string {
  const raw = `${prefix}${fileName}`;
  return raw.length > 120 ? raw.slice(0, 120) : raw;
}

type ExportMsgs = {
  exportLoading: string;
  exportSuccess: string;
  exportFailure: string;
  exportDescription: string;
  statementNamePrefix: string;
};
type ExportArgs = {
  /** Translated titles per source field (see custom-tables `buildSourceColumnTitles`). */
  columnTitles: Record<string, string>;
  statementId: string;
  statement: Statement | null;
  router: { push: (p: string) => void };
  messages: ExportMsgs;
  setExportingToTable: (v: boolean) => void;
};

export async function exportToCustomTable({
  columnTitles,
  statementId,
  statement,
  router,
  messages,
  setExportingToTable,
}: ExportArgs): Promise<void> {
  if (!statement) {
    return;
  }
  setExportingToTable(true);
  const toastId = toast.loading(messages.exportLoading);
  try {
    const name = buildExportName(messages.statementNamePrefix, statement.fileName);
    const description = messages.exportDescription
      .replace('{{dateFrom}}', formatDate(statement.statementDateFrom))
      .replace('{{dateTo}}', formatDate(statement.statementDateTo));
    // A table bound to the statement: "Refresh from source" pulls new transactions later.
    const response = await apiClient.post('/custom-tables/from-source', {
      kind: 'transactions',
      filters: { statementIds: [statementId] },
      name,
      description,
      columnTitles,
    });
    const tableId = getExportTableId(response);
    if (tableId) {
      toast.success(messages.exportSuccess, { id: toastId });
      router.push(`/custom-tables/${tableId}`);
    } else {
      toast.error(messages.exportFailure, { id: toastId });
      router.push('/custom-tables');
    }
  } catch (err) {
    console.error('Export to custom table failed:', err);
    toast.error(messages.exportFailure, { id: toastId });
  } finally {
    setExportingToTable(false);
  }
}

type SampleResult = {
  statement?: Statement;
  data?: { statement?: Statement; transaction?: Transaction };
  transaction?: Transaction;
};
function resolveUpdatedStatement(data: SampleResult): Statement | undefined {
  return data?.statement ?? data?.data?.statement;
}
function resolveCreatedTransaction(data: SampleResult): Transaction | undefined {
  return data?.transaction ?? data?.data?.transaction;
}
function extractDroppedSampleResult(data: SampleResult): {
  updatedStatement?: Statement;
  createdTransaction?: Transaction;
} {
  return {
    updatedStatement: resolveUpdatedStatement(data),
    createdTransaction: resolveCreatedTransaction(data),
  };
}

type ConvertArgs = {
  statementId: string;
  sample: { transaction?: unknown };
  index: number;
  warning?: string;
  loadData: () => Promise<void>;
  setStatement: (v: Statement | null) => void;
  setTransactions: (fn: (prev: Transaction[]) => Transaction[]) => void;
  setSuccess: (v: boolean) => void;
};

export async function convertDroppedSampleAction({
  statementId,
  sample,
  index,
  warning,
  loadData,
  setStatement,
  setTransactions,
  setSuccess,
}: ConvertArgs): Promise<void> {
  const response = await apiClient.post(`/statements/${statementId}/convert-dropped-sample`, {
    index,
    warning,
    transaction: sample.transaction,
  });
  const { updatedStatement, createdTransaction } = extractDroppedSampleResult(response.data);
  if (updatedStatement) {
    setStatement(updatedStatement);
  }
  if (createdTransaction) {
    setTransactions(prev => [createdTransaction, ...prev]);
  } else {
    await loadData();
  }
  setSuccess(true);
  setTimeout(() => setSuccess(false), 3000);
}

function resolveSelectedCategory(
  responseCategory: unknown,
  flatCategories: { id: string; name: string }[],
  categoryId: string,
): Statement['category'] {
  return (responseCategory ??
    flatCategories.find(c => c.id === categoryId) ??
    null) as Statement['category'];
}

function canUpdateCategory(statement: Statement | null, saving: boolean): statement is Statement {
  return Boolean(statement?.id) && !saving;
}

type CategoryArgs = {
  statement: Statement | null;
  categoryId: string;
  flatCategories: { id: string; name: string }[];
  messages: { categoryUpdated: string; categoryUpdateFailed: string };
  statementCategorySaving: boolean;
  setStatementCategorySaving: (v: boolean) => void;
  setStatement: React.Dispatch<React.SetStateAction<Statement | null>>;
  setError: (v: string) => void;
};

export async function updateStatementCategoryAction({
  statement,
  categoryId,
  flatCategories,
  messages,
  statementCategorySaving,
  setStatementCategorySaving,
  setStatement,
  setError,
}: CategoryArgs): Promise<void> {
  if (!canUpdateCategory(statement, statementCategorySaving)) {
    return;
  }
  try {
    setStatementCategorySaving(true);
    const response = await apiClient.patch(`/storage/files/${statement.id}/category`, {
      categoryId: categoryId || null,
    });
    const selectedCategory = resolveSelectedCategory(
      response.data?.category,
      flatCategories,
      categoryId,
    );
    setStatement(prev =>
      prev
        ? {
            ...prev,
            categoryId: response.data?.categoryId ?? (categoryId || null),
            category: selectedCategory,
          }
        : prev,
    );
    toast.success(messages.categoryUpdated);
  } catch (err: unknown) {
    setError(getApiErrorMessage(err, '') || messages.categoryUpdateFailed);
  } finally {
    setStatementCategorySaving(false);
  }
}

type AutoSaveArgs = {
  statementId: string;
  formData: MetaForm;
  setStatement: (v: Statement | null) => void;
};

export async function metadataAutoSave({
  statementId,
  formData,
  setStatement,
}: AutoSaveArgs): Promise<void> {
  try {
    const payload = {
      balanceStart: parseNullableNumber(formData.balanceStart),
      balanceEnd: parseNullableNumber(formData.balanceEnd),
      statementDateFrom: formData.statementDateFrom || null,
      statementDateTo: formData.statementDateTo || null,
    };
    const response = await apiClient.patch(`/statements/${statementId}`, payload);
    const updatedStatement = response.data?.data || response.data;
    setStatement(updatedStatement as Statement);
  } catch (err) {
    console.error('Metadata autosave failed:', err);
  }
}
