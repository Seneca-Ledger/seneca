import type { renderTemplateLabels } from './report-template.translations';

/** Every word a template document prints, in the reader's language. */
export type TemplateLabels = ReturnType<typeof renderTemplateLabels>;

/** A transaction flattened for template aggregation, already in workspace currency. */
export interface TemplateReportRow {
  id: string;
  date: string;
  /** The category id, or '' for an uncategorized row. */
  categoryKey: string;
  categoryName: string;
  /** The parent category's name; empty for a top-level category. */
  groupName: string;
  counterparty: string;
  accountName: string;
  comment: string;
  tags: string[];
  isIncome: boolean;
  /** Converted to the workspace currency. */
  amount: number;
  /** As recorded on the transaction, kept so the register can show both. */
  originalAmount: number;
  originalCurrency: string;
}
