import { Receipt } from '../../../../src/entities';
import { GmailMerchantReparseService } from '../../../../src/modules/gmail/services/gmail-merchant-reparse.service';

describe('GmailMerchantReparseService', () => {
  const makeReceipt = (overrides: Partial<Receipt> = {}): Receipt =>
    ({
      id: 'receipt-1',
      userId: 'user-1',
      workspaceId: 'workspace-1',
      gmailMessageId: 'gmail-message-1',
      gmailThreadId: 'gmail-thread-1',
      subject: 'Your receipt',
      sender: 'GitHub <noreply@github.com>',
      receivedAt: new Date('2026-02-16T10:57:00.000Z'),
      status: 'draft' as any,
      metadata: { snippet: 'Thanks for using GitHub' },
      parsedData: { vendor: 'Date2026-02-16 10:57AM PST' },
      attachmentPaths: ['/tmp/receipt.pdf'],
      transactionId: null,
      transaction: null,
      taxAmount: null,
      duplicateOfId: null,
      duplicateOf: null,
      isDuplicate: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as Receipt;

  describe('needsReparse', () => {
    it('returns true for date-like vendor', () => {
      const service = new GmailMerchantReparseService({} as any, {} as any);

      expect((service as any).needsReparse({ vendor: 'Date2026-02-16 10:57AM PST' })).toBe(true);
    });

    it('returns true for missing vendor', () => {
      const service = new GmailMerchantReparseService({} as any, {} as any);

      expect((service as any).needsReparse({})).toBe(true);
    });

    it('returns true for generic vendor', () => {
      const service = new GmailMerchantReparseService({} as any, {} as any);

      expect((service as any).needsReparse({ vendor: 'Page 1 of 1' })).toBe(true);
    });

    it('returns false for valid brand vendor', () => {
      const service = new GmailMerchantReparseService({} as any, {} as any);

      expect((service as any).needsReparse({ vendor: 'GitHub' })).toBe(false);
    });
  });

  it('reparses receipts with bad vendor and saves new merchant', async () => {
    const receiptRepository = {
      find: jest.fn().mockResolvedValue([makeReceipt()]),
      save: jest.fn().mockImplementation(async (value: Receipt) => value),
    };

    const parserService = {
      parseReceipt: jest.fn().mockResolvedValue({ vendor: 'GitHub' }),
      parseFromEmailOnly: jest.fn(),
    };

    const service = new GmailMerchantReparseService(receiptRepository as any, parserService as any);

    const result = await service.reparseAll('ws-1');

    expect(receiptRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: 'ws-1' } }),
    );
    expect(parserService.parseReceipt).toHaveBeenCalled();
    expect(receiptRepository.save).toHaveBeenCalled();
    expect(result.reparsed).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.details[0]).toMatchObject({
      status: 'updated',
      oldVendor: 'Date2026-02-16 10:57AM PST',
      newVendor: 'GitHub',
    });
  });

  it('supports dry-run mode without saving changes', async () => {
    const receiptRepository = {
      find: jest.fn().mockResolvedValue([makeReceipt()]),
      save: jest.fn(),
    };

    const parserService = {
      parseReceipt: jest.fn().mockResolvedValue({ vendor: 'GitHub' }),
      parseFromEmailOnly: jest.fn(),
    };

    const service = new GmailMerchantReparseService(receiptRepository as any, parserService as any);

    const result = await service.reparseAll('ws-1', { dryRun: true });

    expect(receiptRepository.save).not.toHaveBeenCalled();
    expect(result.reparsed).toBe(1);
    expect(result.details[0].status).toBe('would_update');
  });

  it('uses email fallback when receipt has no attachment path', async () => {
    const receiptRepository = {
      find: jest.fn().mockResolvedValue([
        makeReceipt({
          attachmentPaths: [],
          parsedData: { vendor: 'Date2026-02-16 10:57AM PST' },
        }),
      ]),
      save: jest.fn().mockImplementation(async (value: Receipt) => value),
    };

    const parserService = {
      parseReceipt: jest.fn(),
      parseFromEmailOnly: jest.fn().mockResolvedValue({ vendor: 'GitHub' }),
    };

    const service = new GmailMerchantReparseService(receiptRepository as any, parserService as any);

    const result = await service.reparseAll('ws-1');

    expect(parserService.parseReceipt).not.toHaveBeenCalled();
    expect(parserService.parseFromEmailOnly).toHaveBeenCalled();
    expect(result.reparsed).toBe(1);
  });

  it('skips already-correct vendors', async () => {
    const receiptRepository = {
      find: jest.fn().mockResolvedValue([
        makeReceipt({
          id: 'receipt-2',
          parsedData: { vendor: 'GitHub' },
        }),
      ]),
      save: jest.fn(),
    };

    const parserService = {
      parseReceipt: jest.fn(),
      parseFromEmailOnly: jest.fn(),
    };

    const service = new GmailMerchantReparseService(receiptRepository as any, parserService as any);

    const result = await service.reparseAll('ws-1');

    expect(result.skipped).toBe(1);
    expect(parserService.parseReceipt).not.toHaveBeenCalled();
    expect(parserService.parseFromEmailOnly).not.toHaveBeenCalled();
    expect(receiptRepository.save).not.toHaveBeenCalled();
  });
});
