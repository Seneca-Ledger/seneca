type Labels = Record<string, { value: string }>;

type PageContent = {
  labels: Record<string, { value?: string; toString?: () => string } | string | undefined>;
  errors: {
    loadData: { value: string };
    saveTransaction: { value: string };
    deleteTransaction: { value: string };
    updateTransactions: { value: string };
    deleteTransactions: { value: string };
    assignCategory: { value: string };
  };
};

type Messages = {
  loadDataError: string;
  saveTransactionError: string;
  deleteTransactionError: string;
  updateTransactionsError: string;
  deleteTransactionsError: string;
  assignCategoryError: string;
  exportLoading: string;
  exportSuccess: string;
  exportFailure: string;
  exportDescription: string;
  statementNamePrefix: string;
  categoryUpdated: string;
  categoryUpdateFailed: string;
};

export function buildMessages(t: PageContent, labels: Labels): Messages {
  const tl = t.labels as Labels;
  return {
    loadDataError: t.errors.loadData.value,
    saveTransactionError: t.errors.saveTransaction.value,
    deleteTransactionError: t.errors.deleteTransaction.value,
    updateTransactionsError: t.errors.updateTransactions.value,
    deleteTransactionsError: t.errors.deleteTransactions.value,
    assignCategoryError: t.errors.assignCategory.value,
    exportLoading: tl.exportLoading.value,
    exportSuccess: tl.exportSuccess.value,
    exportFailure: tl.exportFailure.value,
    exportDescription: tl.exportDescription.value,
    statementNamePrefix: tl.statementNamePrefix.value,
    categoryUpdated: labels.categoryUpdated.value,
    categoryUpdateFailed: labels.categoryUpdateFailed.value,
  };
}

type HeaderT = {
  labels: {
    back: string;
    transactionsCount: { value?: string };
    requireCategory: { value: string };
    selectCategoryHint: { value: string };
    disabledSuffix: { value: string };
    exportButton: { value: string };
  };
};

export function buildHeaderT(t: PageContent): HeaderT {
  const tl = t.labels as Labels;
  return {
    labels: {
      back: tl.back.value,
      transactionsCount: { value: tl.transactionsCount.value },
      requireCategory: { value: tl.requireCategory.value },
      selectCategoryHint: {
        value: tl.selectCategoryHint.value,
      },
      disabledSuffix: { value: tl.disabledSuffix.value },
      exportButton: { value: tl.exportButton.value },
    },
  };
}

type ExportDialogLabels = {
  exportConfirmTitle: { value: string };
  exportConfirmBody: { value: string };
  cancel: { value: string };
  exportConfirmConfirm: { value: string };
};

export function buildExportDialogLabels(t: PageContent): ExportDialogLabels {
  const tl = t.labels as Labels;
  return {
    exportConfirmTitle: { value: tl.exportConfirmTitle.value },
    exportConfirmBody: {
      value: tl.exportConfirmBody.value,
    },
    cancel: { value: tl.cancel.value },
    exportConfirmConfirm: { value: tl.exportConfirmConfirm.value },
  };
}

export function buildCategoryDrawerLabels(labels: Labels): {
  title: string;
  searchPlaceholder: string;
  allOption: string;
  noResults: string;
} {
  return {
    title: labels.categoryDrawerTitle.value,
    searchPlaceholder: labels.categorySearchPlaceholder.value,
    allOption: labels.categoryAllOption.value,
    noResults: labels.categoryNoResults.value,
  };
}

export function buildUiLabels(
  t: PageContent,
  labels: Labels,
): {
  headerT: ReturnType<typeof buildHeaderT>;
  exportDialog: ReturnType<typeof buildExportDialogLabels>;
  categoryDrawer: ReturnType<typeof buildCategoryDrawerLabels>;
  changesSaved: string;
} {
  return {
    headerT: buildHeaderT(t),
    exportDialog: buildExportDialogLabels(t),
    categoryDrawer: buildCategoryDrawerLabels(labels),
    changesSaved: labels.changesSaved.value,
  };
}
