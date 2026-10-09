import csv = require('csv-parser');

import * as fs from 'fs';
import { appDefaultCurrency } from '../../../common/utils/currency.util';
import { type BankName, FileType } from '../../../entities/statement.entity';
import type { ParsedStatement, ParsedTransaction } from '../interfaces/parsed-statement.interface';
import { BaseTabularParser } from './base-tabular.parser';
import { type CsvPreset, findCsvPreset, presetColumnMapping } from './csv-presets';

export class CsvParser extends BaseTabularParser {
  async canParse(
    bankName: BankName,
    fileType: FileType,
    filePath: string,
    cachedText?: string,
  ): Promise<boolean> {
    return fileType === FileType.CSV;
  }

  async parse(filePath: string, cachedText?: string): Promise<ParsedStatement> {
    // Detect currency from raw file content before streaming rows
    const rawContent = fs.readFileSync(filePath, 'utf-8').slice(0, 4096);
    const detectedCurrency = this.detectCurrency(rawContent) || appDefaultCurrency();

    return new Promise((resolve, reject) => {
      const transactions: ParsedTransaction[] = [];
      let headers: string[] = [];
      let isFirstRow = true;
      let columnMapping: Record<string, number> = {};
      let preset: CsvPreset | null = null;

      const stream = fs
        .createReadStream(filePath)
        .pipe(csv({ separator: this.detectSeparator(filePath) }))
        .on('headers', (headerList: string[]) => {
          headers = headerList.map(h => h.toLowerCase().trim());
          // A known bank layout beats the header guesser; the guesser stays for the rest.
          preset = findCsvPreset(headers);
          columnMapping = preset ? presetColumnMapping(preset, headers) : this.mapColumns(headers);
        })
        .on('data', (row: Record<string, string>) => {
          if (isFirstRow) {
            isFirstRow = false;
            // Skip if first row looks like header
            const firstRowValues = Object.values(row);
            if (
              firstRowValues.some(
                v =>
                  typeof v === 'string' &&
                  (v.toLowerCase().includes('дата') || v.toLowerCase().includes('date')),
              )
            ) {
              return;
            }
          }

          const rowValues = Object.values(row);
          const transaction = this.parseRow(
            row,
            columnMapping,
            index => rowValues[index],
            preset ? `CSV:${preset.name}` : 'CSV',
            preset?.currency ?? detectedCurrency,
            preset?.unsignedAmountDirection ?? 'credit',
          );
          if (transaction) {
            transactions.push(transaction);
          }
        })
        .on('end', () => {
          const headerText = headers.join(' ').trim();
          const normalizedHeader = this.normalizeHeader(headerText);
          const localeInfo = this.detectLocale(headerText);
          resolve({
            metadata: {
              accountNumber: 'Unknown',
              dateFrom: new Date(),
              dateTo: new Date(),
              currency: preset?.currency ?? detectedCurrency,
              institution: preset?.name,
              rawHeader: headerText || undefined,
              normalizedHeader: normalizedHeader || undefined,
              locale: localeInfo.locale !== 'unknown' ? localeInfo.locale : undefined,
            },
            transactions,
          });
        })
        .on('error', reject);
    });
  }

  private detectSeparator(filePath: string): string {
    // Read first line to detect separator
    const content = fs.readFileSync(filePath, 'utf-8');
    const firstLine = content.split('\n')[0];

    if (firstLine.includes(';')) {
      return ';';
    }

    if (firstLine.includes(',')) {
      return ',';
    }

    if (firstLine.includes('\t')) {
      return '\t';
    }

    return ',';
  }
}
