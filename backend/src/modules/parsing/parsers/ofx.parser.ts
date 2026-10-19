import * as fs from 'node:fs';
import { type BankName, FileType } from '../../../entities/statement.entity';
import type { ParsedStatement } from '../interfaces/parsed-statement.interface';
import { BaseParser } from './base.parser';
import { parseOfx } from './statement-formats.util';

/** File-backed wrapper over the pure `parseOfx`; the format itself is detected at upload. */
export class OfxParser extends BaseParser {
  async canParse(_bankName: BankName, fileType: FileType): Promise<boolean> {
    return fileType === FileType.OFX;
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    const text = cachedText ?? (await fs.promises.readFile(filePath, 'utf-8'));
    return parseOfx(text);
  }
}
