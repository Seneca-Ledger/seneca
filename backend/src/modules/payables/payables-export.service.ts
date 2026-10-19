import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as xlsx from 'xlsx';
import { resolveUploadsDir } from '../../common/utils/uploads.util';
import { Payable } from '../../entities/payable.entity';
import { ExportFormat } from './dto/filter-payables.dto';

@Injectable()
export class PayablesExportService {
  async exportPayables(
    payables: Payable[],
    format: ExportFormat = ExportFormat.EXCEL,
  ): Promise<{ filePath: string; fileName: string; contentType: string }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const extension = format === ExportFormat.CSV ? 'csv' : 'xlsx';
    const fileName = `payables-${timestamp}.${extension}`;
    const filePath = path.join(resolveUploadsDir(), 'reports', fileName);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });

    const rows = payables.map(payable => ({
      Vendor: payable.vendor,
      Amount: Number(payable.amount),
      Currency: payable.currency,
      'Due Date': payable.dueDate ? this.toDateString(payable.dueDate) : '',
      Status: payable.status,
      Source: payable.source,
      Recurring: payable.isRecurring ? 'Yes' : 'No',
      Comment: payable.comment || '',
      'Linked Transaction ID': payable.linkedTransactionId || '',
      'Statement ID': payable.statementId || '',
      'Created At': payable.createdAt?.toISOString() || '',
      'Updated At': payable.updatedAt?.toISOString() || '',
    }));

    if (format === ExportFormat.CSV) {
      const worksheet = xlsx.utils.json_to_sheet(rows);
      const csv = xlsx.utils.sheet_to_csv(worksheet);
      fs.writeFileSync(filePath, csv, 'utf-8');
      return {
        filePath,
        fileName,
        contentType: 'text/csv',
      };
    }

    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(rows);
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Payables');
    xlsx.writeFile(workbook, filePath);

    return {
      filePath,
      fileName,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
  }

  private toDateString(value: Date | string): string {
    if (typeof value === 'string') {
      return value.split('T')[0];
    }

    return value.toISOString().split('T')[0];
  }
}
