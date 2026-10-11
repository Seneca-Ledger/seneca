/* eslint-disable no-console */
import * as fs from 'fs';
import * as path from 'path';
import { extractTablesFromPdf } from '../src/common/utils/pdf-parser.util';
import { FileType } from '../src/entities/statement.entity';
import { GenericPdfParser } from '../src/modules/parsing/parsers/generic-pdf.parser';
import { ParserFactoryService } from '../src/modules/parsing/services/parser-factory.service';

function guessFileType(filePath: string): FileType {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') return FileType.PDF;
  if (ext === '.xlsx' || ext === '.xls') return FileType.XLSX;
  if (ext === '.csv') return FileType.CSV;
  return FileType.PDF;
}

async function main() {
  const target = process.argv[2];
  if (!target) {
    console.error('Usage: ts-node -r tsconfig-paths/register scripts/parse-debug.ts <file>');
    process.exit(1);
  }

  const filePath = path.resolve(target);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const fileType = guessFileType(filePath);
  const factory = new ParserFactoryService();

  console.log(`[*] File: ${filePath}`);
  console.log(`[*] File type: ${fileType}`);

  const detectStarted = Date.now();
  const { bankName, formatVersion } = await factory.detectBankAndFormat(filePath, fileType);
  console.log(
    `[*] Detected bank: ${bankName} format: ${formatVersion || 'unknown'} (${Date.now() - detectStarted}ms)`,
  );

  const parser = await factory.getParser(bankName, fileType, filePath);
  if (!parser) {
    console.error('[!] No parser found for this file');
    process.exit(2);
  }

  const parserVersion = typeof parser.getVersion === 'function' ? parser.getVersion() : 'unknown';
  console.log(`[*] Using parser: ${parser.constructor.name} (version ${parserVersion})`);

  const parseStarted = Date.now();
  const parsed = await parser.parse(filePath);
  console.log(
    `[*] Parsed in ${Date.now() - parseStarted}ms with ${parsed.transactions.length} transactions`,
  );

  console.log('[*] Metadata:', parsed.metadata);
  console.log('[*] First 5 transactions sample:');
  parsed.transactions.slice(0, 5).forEach((t, idx) => {
    console.log(
      `${idx + 1}. ${t.transactionDate?.toISOString?.().slice(0, 10) || t.transactionDate} | ${t.documentNumber || '-'} | ${t.debit ?? t.credit ?? '-'} | ${(t.counterpartyName || '').slice(0, 80)}`,
    );
    if (t.paymentPurpose) {
      console.log(`    purpose: ${(t.paymentPurpose || '').slice(0, 160)}`);
    }
  });

  if (parsed.transactions.length === 0 && parser instanceof GenericPdfParser) {
    console.log(
      '[!] No transactions extracted. Consider enabling AI or checking table extraction.',
    );
    try {
      const tables = await extractTablesFromPdf(filePath);
      console.log(
        `[*] pdfplumber tables rowSets=${tables.rowSets.map(rows => rows.length).join('/') || 0}, structured=${tables.structured?.length || 0}`,
      );
    } catch (error) {
      console.error('[!] Failed to extract tables for debug:', error);
    }
  }
}

main().catch(error => {
  console.error('[!] Failed to parse file:', error);
  process.exit(1);
});
