import { toast } from 'react-hot-toast';
import apiClient, { type UncheckedResponse } from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { invalidateDocumentLists } from '@/app/lib/invalidate-document-lists';
import { unwrapEnvelope } from '@/app/lib/query-fn';
import { type ContractInput, checkBody, checkContract } from '@/app/lib/query-fn-schema';
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
  toEditableTransaction,
} from '../editHelpers';

type MetaForm = {
  balanceStart: string;
  balanceEnd: string;
  statementDateFrom: string;
  statementDateTo: string;
};

/** Some answers come wrapped in `{ data }`; the caller's contract checks what is inside. */
const payloadOf = (response: UncheckedResponse): unknown => unwrapEnvelope(response.data);

/** The statement as the editor reads it. */
async function readStatement(statementId: string): Promise<Statement> {
  const response = await apiClient.get(`/statements/${statementId}`);
  return checkContract('StatementDetail', payloadOf(response), '/statements/:id');
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
    const transactionsUrl = `/transactions?statement_id=${statementId}&limit=1000`;
    const [statementData, tRes, cRes, bRes, wRes] = await Promise.all([
      readStatement(statementId),
      apiClient.get(transactionsUrl),
      apiClient.get('/categories'),
      apiClient.get('/branches'),
      apiClient.get('/wallets'),
    ]);
    set.setStatement(statementData);
    const rows = await checkContract('TransactionList', payloadOf(tRes), transactionsUrl);
    set.setTransactions(rows.map(toEditableTransaction));
    set.setCategories(await checkContract('CategoryList', payloadOf(cRes), '/categories'));
    set.setBranches(await checkContract('BranchList', payloadOf(bRes), '/branches'));
    set.setWallets(await checkContract('WalletList', payloadOf(wRes), '/wallets'));
    set.setMetadataForm(buildMetadataForm(statementData, extractMeta(statementData)));
  } catch (err: unknown) {
    set.setError(getApiErrorMessage(err, messages.loadDataError));
  } finally {
    set.setLoading(false);
    set.setOptionsLoading(false);
  }
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
    } satisfies ContractInput<'CreateCustomTableFromSourceBody'>);
    const { tableId } = await checkContract(
      'CreatedFromSource',
      response.data,
      '/custom-tables/from-source',
    );
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

type ConvertArgs = {
  statementId: string;
  sample: { transaction?: unknown };
  index: number;
  warning?: string;
  loadData: () => Promise<void>;
  setSuccess: (v: boolean) => void;
};

export async function convertDroppedSampleAction({
  statementId,
  sample,
  index,
  warning,
  loadData,
  setSuccess,
}: ConvertArgs): Promise<void> {
  // The sample is the parser's own record, typed only as unknown here.
  const body = await checkBody(
    'ConvertDroppedSampleBody',
    { index, warning, transaction: sample.transaction },
    '/statements/:id/convert-dropped-sample',
  );
  await apiClient.post(`/statements/${statementId}/convert-dropped-sample`, body);
  // The answer is the raw rows; reading them back goes through the editor's contracts.
  await loadData();
  setSuccess(true);
  setTimeout(() => setSuccess(false), 3000);
}

function canUpdateCategory(statement: Statement | null, saving: boolean): statement is Statement {
  return Boolean(statement?.id) && !saving;
}

type CategoryArgs = {
  statement: Statement | null;
  categoryId: string;
  messages: { categoryUpdated: string; categoryUpdateFailed: string };
  statementCategorySaving: boolean;
  setStatementCategorySaving: (v: boolean) => void;
  setStatement: React.Dispatch<React.SetStateAction<Statement | null>>;
  setError: (v: string) => void;
};

export async function updateStatementCategoryAction({
  statement,
  categoryId,
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
    } satisfies ContractInput<'UpdateFileCategoryBody'>);
    const updated = await checkContract(
      'FileCategoryUpdate',
      response.data,
      '/storage/files/:id/category',
    );
    setStatement(prev =>
      prev ? { ...prev, categoryId: updated.categoryId, category: updated.category } : prev,
    );
    invalidateDocumentLists();
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
    await apiClient.patch(
      `/statements/${statementId}`,
      payload satisfies ContractInput<'UpdateStatementBody'>,
    );
    setStatement(await readStatement(statementId));
    invalidateDocumentLists();
  } catch (err) {
    console.error('Metadata autosave failed:', err);
  }
}
