import type { BankName, FileType } from '../../../entities/statement.entity';
import type { ParsedStatement } from './parsed-statement.interface';

export interface IParser {
  canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean>;
  /**
   * @param ocrConfidence Confidence (0-1) of `cachedText` when it came from
   * OCR rather than a real text layer. Most parsers ignore this; parsers
   * that OCR images/scans themselves (e.g. Hapoalim) use it to decide
   * whether to trust OCR-derived text or fall back to a more robust
   * extraction path, instead of defaulting to "confidence 1.0" just because
   * the caller already ran OCR and handed them the resulting text.
   */
  parse(filePath: string, cachedText?: string, ocrConfidence?: number): Promise<ParsedStatement>;
  getVersion?(): string;
}
