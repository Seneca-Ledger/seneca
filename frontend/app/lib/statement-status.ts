export const isStatementProcessingStatus = (status?: string | null): boolean => {
  const normalized = (status || '').toLowerCase();
  return normalized === 'processing' || normalized === 'uploaded';
};

type StatementParsingDetails = {
  detectedBy?: string | null;
  parserUsed?: string | null;
  importPreview?: {
    source?: string | null;
    merchant?: string | null;
  } | null;
  metadataExtracted?: { institution?: string | null } | null;
};

type StatementLike = {
  bankName?: string | null;
  parsingDetails?: StatementParsingDetails | null;
};

const MANUAL_EXPENSE_SOURCE = 'manual-expense';

export const hasProcessingStatements = (statements: Array<{ status?: string | null }>): boolean => {
  return statements.some(statement => isStatementProcessingStatus(statement.status));
};

export const getStatementMerchantLabel = (
  status: string | null | undefined,
  merchant: string,
  scanningLabel: string,
): string => (isStatementProcessingStatus(status) ? scanningLabel : merchant);

export const isManualExpenseStatement = (statement: StatementLike): boolean => {
  const detectedBy = statement.parsingDetails?.detectedBy?.toLowerCase();
  const parserUsed = statement.parsingDetails?.parserUsed?.toLowerCase();
  const source = statement.parsingDetails?.importPreview?.source?.toLowerCase();

  return (
    detectedBy === MANUAL_EXPENSE_SOURCE ||
    parserUsed === MANUAL_EXPENSE_SOURCE ||
    source === MANUAL_EXPENSE_SOURCE
  );
};

export const getStatementDisplayMerchant = (
  statement: StatementLike,
  fallbackMerchant: string,
): string => {
  const manualMerchant = statement.parsingDetails?.importPreview?.merchant?.trim();
  if (manualMerchant) {
    return manualMerchant;
  }
  // A bank no parser knows goes by the name its statement prints (taught by the user).
  const institution = statement.parsingDetails?.metadataExtracted?.institution?.trim();
  return statement.bankName === 'other' && institution ? institution : fallbackMerchant;
};
