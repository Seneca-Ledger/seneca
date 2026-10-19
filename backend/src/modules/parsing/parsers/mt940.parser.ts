import * as fs from 'node:fs';
import { type BankName, FileType } from '../../../entities/statement.entity';
import type { ParsedStatement } from '../interfaces/parsed-statement.interface';
import { BaseParser } from './base.parser';
import { parseMt940 } from './statement-formats.util';

/** File-backed wrapper over the pure `parseMt940`; the format itself is detected at upload. */
export class Mt940Parser extends BaseParser {
  async canParse(_bankName: BankName, fileType: FileType): Promise<boolean> {
    return fileType === FileType.MT940;
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const text = cachedText ?? (await fs.promises.readFile(filePath, 'utf-8'));
    return parseMt940(text);
  }
}
