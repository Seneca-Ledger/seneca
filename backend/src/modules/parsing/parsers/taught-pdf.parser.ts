import { extractTextAndLayoutFromPdf } from '../../../common/utils/pdf-parser.util';
import {
  type LayoutTemplate,
  labelledBalance,
  layoutReading,
} from '../helpers/layout-template.helper';
import type { ParsedStatement } from '../interfaces/parsed-statement.interface';
import { GenericPdfParser } from './generic-pdf.parser';

/**
 * The generic reading with a workspace's taught layout on top: its headings
 * read before the built-in ones, its columns for a table without a header,
 * its skipped lines left out, and its balances read beside their labels.
 */
export class TaughtPdfParser extends GenericPdfParser {
  constructor(private readonly template: LayoutTemplate) {
    super();
    this.reading = layoutReading(template);
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const read = await super.parse(filePath, cachedText);
    const parsed = this.template.institution
      ? { ...read, metadata: { ...read.metadata, institution: this.template.institution } }
      : read;
    const { start, end } = this.template.balances;
    if (!(start || end)) {
      return parsed;
    }
    const { rows } = await extractTextAndLayoutFromPdf(filePath);
    const balanceStart = labelledBalance(rows, start) ?? parsed.metadata.balanceStart;
    const balanceEnd = labelledBalance(rows, end) ?? parsed.metadata.balanceEnd;
    return { ...parsed, metadata: { ...parsed.metadata, balanceStart, balanceEnd } };
  }
}
