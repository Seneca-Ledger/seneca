import * as fs from 'node:fs';
import { type BankName, FileType } from '../../../entities/statement.entity';
import type { ParsedStatement } from '../interfaces/parsed-statement.interface';
import { BaseParser } from './base.parser';
import { parseCamt053 } from './statement-formats.util';

/** File-backed wrapper over the pure `parseCamt053`; the format itself is detected at upload. */
export class Camt053Parser extends BaseParser {
  async canParse(_bankName: BankName, fileType: FileType): Promise<boolean> {
    return fileType === FileType.CAMT;
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const text = cachedText ?? (await fs.promises.readFile(filePath, 'utf-8'));
    return parseCamt053(text);
  }
}
